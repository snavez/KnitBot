// === State ===
const state = {
    rows: 20,
    cols: 20,
    grid: [],           // 2D array: null = empty, string = color
    stitchGrid: [],     // 2D array: null = knit, 'purl', or {type,dir,width,pos,id}
    activeColor: null,
    activeTool: 'paint', // 'paint', 'erase', 'fill', 'select', 'stitch'
    activeStitch: null,  // null, 'knit', 'purl', 'left-cross', 'right-cross', 'stitch-erase'
    isPainting: false,
    // Drag-vs-click detection: the initial cell on mousedown, and whether
    // we've moved to another cell (= dragging). Drag-mode paints additively
    // (never toggles off) so sweeping across cells doesn't flicker them.
    paintStartCell: null,
    paintDragged: false,
    history: [],
    historyIndex: -1,
    maxHistory: 50,
    patternName: '',
    knittingMode: 'flat', // 'flat' or 'round'
    firstRow: 'RS', // 'RS' or 'WS' — which side is Row 1 on (flat only)
    customInstructions: null, // user-edited instruction text, saved with pattern
    // Selection / copy-paste
    selection: null,
    clipboard: null,
    isSelecting: false,
    isPasting: false,
    pasteGhostPos: null,
    // Cable placement
    cableDragStart: null, // { row, col } when dragging a cable
    cableDragEnd: null,
};

// Atelier palette — warm, natural, earthy tones.
// Each hue occupies the same 1:1 slot as the old bright palette.
const COLORS = [
    '#c8392d', // madder (red)
    '#c76b2b', // rust (orange)
    '#d9a441', // ochre (yellow)
    '#7a8a5a', // sage (green)
    '#5a8a82', // verdigris (teal)
    '#4f6e88', // indigo (blue)
    '#7a5a8a', // heather (purple)
    '#b85c6e', // rose (pink)
    '#6b4a2f', // walnut (brown)
    '#e0d5b0', // cream (deeper oat)
    '#2a2e3c', // midnight (navy)
    '#1b1612', // soot (black)
];

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
    state.activeColor = COLORS[0];
    initPalette();
    initGrid(state.rows, state.cols);
    bindEvents();
    pushHistory();
});

// === Palette ===
function initPalette() {
    const palette = document.getElementById('color-palette');
    palette.innerHTML = '';

    COLORS.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch' + (color === state.activeColor ? ' active' : '');
        swatch.style.background = color;
        swatch.dataset.color = color;
        swatch.addEventListener('click', () => selectColor(color));
        palette.appendChild(swatch);
    });

    // Custom color picker
    const customBtn = document.createElement('button');
    customBtn.className = 'color-swatch-custom';
    customBtn.textContent = '+';
    customBtn.title = 'Custom colour';
    const customInput = document.createElement('input');
    customInput.type = 'color';
    customInput.id = 'custom-color-input';
    customInput.value = '#ff6600';
    customBtn.appendChild(customInput);
    customBtn.addEventListener('click', () => customInput.click());
    customInput.addEventListener('input', (e) => {
        selectColor(e.target.value);
    });
    customInput.addEventListener('click', (e) => e.stopPropagation());
    palette.appendChild(customBtn);
}

function selectColor(color) {
    state.activeColor = color;
    state.activeTool = 'paint';
    updateToolButtons();
    document.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color === color);
    });
}

// === Grid ===
function initGrid(rows, cols) {
    state.rows = rows;
    state.cols = cols;

    // Preserve existing data where possible
    const oldGrid = state.grid;
    const oldStitchGrid = state.stitchGrid;
    state.grid = [];
    state.stitchGrid = [];
    for (let r = 0; r < rows; r++) {
        state.grid[r] = [];
        state.stitchGrid[r] = [];
        for (let c = 0; c < cols; c++) {
            state.grid[r][c] = (oldGrid[r] && oldGrid[r][c]) || null;
            state.stitchGrid[r][c] = (oldStitchGrid[r] && oldStitchGrid[r][c]) || null;
        }
    }

    renderGrid();
}

function renderGrid() {
    const container = document.getElementById('grid-container');
    container.style.gridTemplateColumns = `repeat(${state.cols}, var(--cell-size))`;
    container.style.gridTemplateRows = `repeat(${state.rows}, var(--cell-size))`;
    container.innerHTML = '';

    for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            if (state.grid[r][c]) {
                cell.classList.add('painted');
                cell.style.background = state.grid[r][c];
            }
            container.appendChild(cell);
        }
    }

    renderNumbers();
    // Render stitch overlay if cables.js is loaded
    if (typeof renderStitchOverlay === 'function') {
        renderStitchOverlay();
    }
    updateStatusBar();
}

function renderNumbers() {
    const leftNums = document.getElementById('row-numbers-left');
    const rightNums = document.getElementById('row-numbers-right');
    const colNumsTop = document.getElementById('col-numbers');
    const colNumsBot = document.getElementById('col-numbers-bottom');
    leftNums.innerHTML = '';
    rightNums.innerHTML = '';
    colNumsTop.innerHTML = '';
    if (colNumsBot) colNumsBot.innerHTML = '';

    function makeArrow(arrow) {
        return `<span class="row-arrow">${arrow}</span>`;
    }

    // Row number rules:
    //   In the round — all row numbers on the right, all arrows ◀ (R→L).
    //   Flat, R1 = RS — odd rows (RS) on RIGHT with ◀; even rows (WS) on LEFT with ▶.
    //   Flat, R1 = WS — odd rows (WS) on LEFT with ▶; even rows (RS) on RIGHT with ◀.
    for (let r = 0; r < state.rows; r++) {
        const knittingRow = state.rows - r;
        const isOdd = (knittingRow % 2 === 1);

        const leftEl = document.createElement('div');
        leftEl.className = 'row-number';
        const rightEl = document.createElement('div');
        rightEl.className = 'row-number';

        if (state.knittingMode === 'round') {
            // In the round: all RS, all on right, all ◀
            leftEl.classList.add('row-hidden');
            rightEl.innerHTML = makeArrow('\u25C0') + knittingRow;
            rightEl.classList.add('row-rs');
            rightEl.title = `Rnd ${knittingRow} — work right to left`;
        } else {
            // Flat — figure out RS/WS for this row based on firstRow setting
            const isRS = (state.firstRow === 'RS') ? isOdd : !isOdd;
            const side = isRS ? 'right' : 'left';
            if (side === 'right') {
                leftEl.classList.add('row-hidden');
                rightEl.innerHTML = makeArrow('\u25C0') + knittingRow;
                rightEl.classList.add(isRS ? 'row-rs' : 'row-ws');
                rightEl.title = `Row ${knittingRow} (${isRS ? 'RS' : 'WS'}) — work right to left`;
            } else {
                leftEl.innerHTML = knittingRow + makeArrow('\u25B6');
                leftEl.classList.add(isRS ? 'row-rs' : 'row-ws');
                leftEl.title = `Row ${knittingRow} (${isRS ? 'RS' : 'WS'}) — work left to right`;
                rightEl.classList.add('row-hidden');
            }
        }

        leftNums.appendChild(leftEl);
        rightNums.appendChild(rightEl);
    }

    // Column numbers — read right-to-left: rightmost cell is column 1, leftmost is column N
    for (let c = 0; c < state.cols; c++) {
        const colNumber = state.cols - c; // column N on left, column 1 on right
        const top = document.createElement('div');
        top.className = 'col-number';
        top.textContent = colNumber;
        colNumsTop.appendChild(top);
        if (colNumsBot) {
            const bot = document.createElement('div');
            bot.className = 'col-number';
            bot.textContent = colNumber;
            colNumsBot.appendChild(bot);
        }
    }
}

function paintCell(row, col) {
    if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return;

    if (state.activeTool === 'erase') {
        state.grid[row][col] = null;
    } else if (state.activeTool === 'fill') {
        floodFill(row, col, state.grid[row][col], state.activeColor);
    } else {
        // Toggle: if cell already has the active colour, clear it
        if (state.grid[row][col] === state.activeColor) {
            state.grid[row][col] = null;
        } else {
            state.grid[row][col] = state.activeColor;
        }
    }

    updateCellDOM(row, col);
}

// Additive paint: used during a drag stroke. Only sets the cell to the active
// colour (never toggles off) so sweeping across already-painted cells doesn't
// flicker them. Erase/fill fall through to the toggling paintCell behaviour.
function paintCellAdditive(row, col) {
    if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return;
    if (state.activeTool === 'erase' || state.activeTool === 'fill') {
        paintCell(row, col);
        return;
    }
    if (state.grid[row][col] !== state.activeColor) {
        state.grid[row][col] = state.activeColor;
        updateCellDOM(row, col);
    }
}

function updateCellDOM(row, col) {
    const idx = row * state.cols + col;
    const container = document.getElementById('grid-container');
    const cell = container.children[idx];
    if (!cell) return;

    const color = state.grid[row][col];
    if (color) {
        cell.classList.add('painted');
        cell.style.background = color;
    } else {
        cell.classList.remove('painted');
        cell.style.background = '';
    }
}

function floodFill(row, col, targetColor, fillColor) {
    if (targetColor === fillColor) return;
    if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return;
    if (state.grid[row][col] !== targetColor) return;

    const stack = [[row, col]];
    const visited = new Set();

    while (stack.length) {
        const [r, c] = stack.pop();
        const key = `${r},${c}`;
        if (visited.has(key)) continue;
        if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) continue;
        if (state.grid[r][c] !== targetColor) continue;

        visited.add(key);
        state.grid[r][c] = fillColor;
        updateCellDOM(r, c);

        stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
    }
}

// === Events ===
function bindEvents() {
    const container = document.getElementById('grid-container');

    // Mouse painting & selection
    container.addEventListener('mousedown', (e) => {
        const cell = e.target.closest('.grid-cell');
        if (!cell) return;
        e.preventDefault();
        const r = +cell.dataset.row, c = +cell.dataset.col;

        if (state.activeTool === 'select') {
            if (state.isPasting) {
                commitPaste(r, c);
                return;
            }
            state.isSelecting = true;
            state.selection = { startRow: r, startCol: r, endRow: r, endCol: c };
            state.selection.startCol = c;
            renderSelectionOverlay();
            return;
        }

        // Stitch tool handled in cables.js (capture phase)
        if (state.activeTool === 'stitch') return;

        state.isPainting = true;
        state.paintStartCell = { r, c };
        state.paintDragged = false;
        // First cell still uses toggle semantics — a bare click on an
        // already-active cell should clear it. If the user then drags, the
        // move handler promotes this stroke to additive and undoes the toggle
        // if needed.
        paintCell(r, c);
    });

    container.addEventListener('mousemove', (e) => {
        const cell = e.target.closest('.grid-cell');
        if (!cell) return;
        const r = +cell.dataset.row, c = +cell.dataset.col;

        if (state.activeTool === 'select') {
            if (state.isSelecting) {
                state.selection.endRow = r;
                state.selection.endCol = c;
                renderSelectionOverlay();
            }
            if (state.isPasting) {
                state.pasteGhostPos = { row: r, col: c };
                renderPasteGhost();
            }
            return;
        }

        // Stitch tool handled in cables.js (capture phase)
        if (state.activeTool === 'stitch') return;

        if (!state.isPainting || state.activeTool === 'fill') return;

        // Still on the same cell as mousedown — nothing to do yet
        const start = state.paintStartCell;
        if (start && r === start.r && c === start.c) return;

        // We've moved to a different cell → this is a drag, not a click.
        // On the first move, promote the stroke to additive-only and repair
        // the start cell if the initial toggle cleared it.
        if (!state.paintDragged && start) {
            state.paintDragged = true;
            if (state.activeTool !== 'erase' && state.activeTool !== 'fill') {
                if (state.grid[start.r][start.c] !== state.activeColor) {
                    state.grid[start.r][start.c] = state.activeColor;
                    updateCellDOM(start.r, start.c);
                }
            }
        }

        paintCellAdditive(r, c);
    });

    document.addEventListener('mouseup', () => {
        if (state.isSelecting) {
            state.isSelecting = false;
            const actions = document.getElementById('selection-actions');
            if (actions) actions.style.display = 'flex';
            return;
        }
        if (state.isPainting) {
            state.isPainting = false;
            state.paintStartCell = null;
            state.paintDragged = false;
            pushHistory();
        }
    });

    // Right-click to erase
    container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const cell = e.target.closest('.grid-cell');
        if (!cell) return;
        const r = +cell.dataset.row, c = +cell.dataset.col;
        state.grid[r][c] = null;
        updateCellDOM(r, c);
        pushHistory();
    });

    // Touch support — mirrors the mouse tap/drag logic so a sweep only paints.
    container.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const cell = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!cell || !cell.classList.contains('grid-cell')) return;
        e.preventDefault();
        const r = +cell.dataset.row, c = +cell.dataset.col;
        state.isPainting = true;
        state.paintStartCell = { r, c };
        state.paintDragged = false;
        paintCell(r, c);
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        if (!state.isPainting || state.activeTool === 'fill') return;
        const touch = e.touches[0];
        const cell = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!cell || !cell.classList.contains('grid-cell')) return;
        e.preventDefault();
        const r = +cell.dataset.row, c = +cell.dataset.col;

        const start = state.paintStartCell;
        if (start && r === start.r && c === start.c) return;

        if (!state.paintDragged && start) {
            state.paintDragged = true;
            if (state.activeTool !== 'erase' && state.activeTool !== 'fill') {
                if (state.grid[start.r][start.c] !== state.activeColor) {
                    state.grid[start.r][start.c] = state.activeColor;
                    updateCellDOM(start.r, start.c);
                }
            }
        }

        paintCellAdditive(r, c);
    }, { passive: false });

    container.addEventListener('touchend', () => {
        if (state.isPainting) {
            state.isPainting = false;
            state.paintStartCell = null;
            state.paintDragged = false;
            pushHistory();
        }
    });

    // Knitting mode toggle
    document.getElementById('knitting-mode').addEventListener('change', (e) => {
        state.knittingMode = e.target.value;
        updateFirstRowPickerVisibility();
        renderNumbers();
        updateStatusBar();
    });

    // R1 RS/WS picker (flat mode only)
    document.querySelectorAll('input[name="first-row"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                state.firstRow = e.target.value;
                renderNumbers();
            }
        });
    });
    updateFirstRowPickerVisibility();

    // Toolbar buttons
    document.getElementById('btn-resize').addEventListener('click', () => {
        const rows = clamp(+document.getElementById('grid-rows').value, 2, 80);
        const cols = clamp(+document.getElementById('grid-cols').value, 2, 80);
        document.getElementById('grid-rows').value = rows;
        document.getElementById('grid-cols').value = cols;
        initGrid(rows, cols);
        pushHistory();
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        for (let r = 0; r < state.rows; r++)
            for (let c = 0; c < state.cols; c++) {
                state.grid[r][c] = null;
                if (state.stitchGrid[r]) state.stitchGrid[r][c] = null;
            }
        renderGrid();
        pushHistory();
    });

    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);
    document.getElementById('btn-preview').addEventListener('click', openPreview);
    document.getElementById('btn-save').addEventListener('click', saveToFile);
    document.getElementById('btn-load').addEventListener('click', loadFromFile);

    // Tool buttons
    document.getElementById('tool-paint').addEventListener('click', () => setTool('paint'));
    document.getElementById('tool-erase').addEventListener('click', () => setTool('erase'));
    document.getElementById('tool-fill').addEventListener('click', () => setTool('fill'));
    document.getElementById('tool-select').addEventListener('click', () => setTool('select'));

    // Selection action buttons
    document.getElementById('btn-copy').addEventListener('click', copySelection);
    document.getElementById('btn-cut').addEventListener('click', cutSelection);
    document.getElementById('btn-paste').addEventListener('click', pasteClipboard);
    document.getElementById('btn-deselect').addEventListener('click', clearSelection);

    // File input handler
    document.getElementById('file-input').addEventListener('change', handleFileLoad);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
        if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveToFile(); }
        if (e.ctrlKey && e.key === 'c' && state.selection) { e.preventDefault(); copySelection(); }
        if (e.ctrlKey && e.key === 'x' && state.selection) { e.preventDefault(); cutSelection(); }
        if (e.ctrlKey && e.key === 'v' && state.clipboard) { e.preventDefault(); pasteClipboard(); }
        if (e.key === 'Escape') {
            if (state.isPasting) cancelPaste();
            else if (state.selection) clearSelection();
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && state.selection && !state.isPasting) {
            e.preventDefault();
            deleteSelection();
        }
    });

    // Preview modal
    document.getElementById('preview-close').addEventListener('click', closePreview);
    document.getElementById('preview-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closePreview();
    });
    document.getElementById('btn-refresh-preview').addEventListener('click', renderPreview);
    document.getElementById('preview-repeat').addEventListener('change', renderPreview);
    document.getElementById('preview-tiles').addEventListener('change', renderPreview);
}

function setTool(tool) {
    if (state.activeTool === 'select' && tool !== 'select') {
        clearSelection();
    }
    state.activeTool = tool;
    updateToolButtons();
}

function updateToolButtons() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.id === `tool-${state.activeTool}`);
    });
}

// === History (Undo/Redo) ===
function deepCopyStitchGrid(sg) {
    return sg.map(row => row.map(cell =>
        cell === null || typeof cell === 'string' ? cell : { ...cell }
    ));
}

function pushHistory() {
    const snapshot = state.grid.map(row => [...row]);
    const stitchSnapshot = deepCopyStitchGrid(state.stitchGrid);
    // Remove any future states after current index
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push({ grid: snapshot, stitchGrid: stitchSnapshot, rows: state.rows, cols: state.cols });
    if (state.history.length > state.maxHistory) {
        state.history.shift();
    }
    state.historyIndex = state.history.length - 1;
    updateUndoRedoButtons();
    updateStatusBar();
}

function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex--;
    restoreHistory();
}

function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex++;
    restoreHistory();
}

function restoreHistory() {
    const snap = state.history[state.historyIndex];
    state.rows = snap.rows;
    state.cols = snap.cols;
    state.grid = snap.grid.map(row => [...row]);
    state.stitchGrid = snap.stitchGrid ? deepCopyStitchGrid(snap.stitchGrid) : initEmptyStitchGrid(snap.rows, snap.cols);
    document.getElementById('grid-rows').value = state.rows;
    document.getElementById('grid-cols').value = state.cols;
    renderGrid();
    updateUndoRedoButtons();
}

function initEmptyStitchGrid(rows, cols) {
    const sg = [];
    for (let r = 0; r < rows; r++) {
        sg[r] = [];
        for (let c = 0; c < cols; c++) sg[r][c] = null;
    }
    return sg;
}

function updateUndoRedoButtons() {
    document.getElementById('btn-undo').disabled = state.historyIndex <= 0;
    document.getElementById('btn-redo').disabled = state.historyIndex >= state.history.length - 1;
}

// === File Save/Load ===
function restorePatternData(data) {
    state.rows = data.rows;
    state.cols = data.cols;
    state.grid = data.grid;
    state.stitchGrid = data.stitchGrid || initEmptyStitchGrid(data.rows, data.cols);
    state.patternName = data.name || '';
    state.knittingMode = data.knittingMode || 'flat';
    state.firstRow = data.firstRow || 'RS';
    state.customInstructions = data.customInstructions || null;
    document.getElementById('grid-rows').value = state.rows;
    document.getElementById('grid-cols').value = state.cols;
    document.getElementById('pattern-name').value = state.patternName;
    document.getElementById('knitting-mode').value = state.knittingMode;
    // Restore R1 radio
    const firstRowRadio = document.querySelector(`input[name="first-row"][value="${state.firstRow}"]`);
    if (firstRowRadio) firstRowRadio.checked = true;
    updateFirstRowPickerVisibility();
    renderGrid();
    state.history = [];
    state.historyIndex = -1;
    pushHistory();
    markSaved();
}

function saveToFile() {
    const name = document.getElementById('pattern-name').value.trim() || 'untitled';
    state.patternName = name;
    const data = {
        version: 2,
        name: name,
        rows: state.rows,
        cols: state.cols,
        grid: state.grid,
        stitchGrid: state.stitchGrid,
        knittingMode: state.knittingMode,
        firstRow: state.firstRow,
        customInstructions: state.customInstructions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9_-]/gi, '_')}.knit.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Saved "${name}"`);
    markSaved();
}

// === Masthead saved-status indicator ===
let lastSavedAt = null;
function markSaved() {
    lastSavedAt = Date.now();
    updateSavedLabel();
}
function updateSavedLabel() {
    const el = document.getElementById('masthead-saved');
    if (!el) return;
    if (!lastSavedAt) {
        el.textContent = 'Unsaved';
        el.classList.add('unsaved');
        return;
    }
    const mins = Math.floor((Date.now() - lastSavedAt) / 60000);
    el.classList.remove('unsaved');
    if (mins < 1) el.textContent = 'Saved · just now';
    else if (mins === 1) el.textContent = 'Saved · 1m ago';
    else if (mins < 60) el.textContent = `Saved · ${mins}m ago`;
    else {
        const hrs = Math.floor(mins / 60);
        el.textContent = `Saved · ${hrs}h ago`;
    }
}
// Update the "Saved Xm ago" label every 30s
setInterval(updateSavedLabel, 30000);

function updateFirstRowPickerVisibility() {
    const picker = document.getElementById('first-row-picker');
    if (!picker) return;
    picker.classList.toggle('hidden', state.knittingMode !== 'flat');
}

// === Status Bar ===
function updateStatusBar() {
    const stitchesEl = document.getElementById('status-stitches');
    const coloursEl = document.getElementById('status-colours');
    const modeEl = document.getElementById('status-mode');
    if (!stitchesEl) return;

    // Count "active" stitches (cells that aren't no-stitch and have either colour or stitch data)
    let active = 0;
    const coloursSet = new Set();
    for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
            const stitch = state.stitchGrid[r] ? state.stitchGrid[r][c] : null;
            if (stitch === 'no-stitch') continue;
            const color = state.grid[r][c];
            if (color !== null || stitch) active++;
            if (color) coloursSet.add(color);
        }
    }

    stitchesEl.textContent = `${active} stitch${active === 1 ? '' : 'es'}`;
    const cn = coloursSet.size;
    coloursEl.textContent = `${cn} colour${cn === 1 ? '' : 's'}`;
    modeEl.textContent = state.knittingMode === 'round' ? 'in the round' : 'flat';
}

function loadFromFile() {
    document.getElementById('file-input').click();
}

function handleFileLoad(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (!data.rows || !data.cols || !data.grid) {
                showToast('Invalid pattern file');
                return;
            }
            restorePatternData(data);
            showToast(`Loaded "${data.name || file.name}"`);
        } catch (err) {
            showToast('Could not read file');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// === Utility ===
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: var(--accent); color: #111; padding: 8px 20px; border-radius: 4px;
        font-size: 0.85rem; font-weight: 600; z-index: 200;
        animation: fadeOut 1.5s ease forwards;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1600);
}

// Add fadeOut animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes fadeOut {
        0%, 60% { opacity: 1; }
        100% { opacity: 0; }
    }
`;
document.head.appendChild(styleSheet);

// === Auto-trim: find the bounding box of cells with content (colour OR stitch) ===
function getTrimmedBounds() {
    let minR = state.rows, maxR = -1, minC = state.cols, maxC = -1;
    for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
            const hasColor = !!state.grid[r][c];
            const hasStitch = !!(state.stitchGrid[r] && state.stitchGrid[r][c]);
            if (hasColor || hasStitch) {
                minR = Math.min(minR, r);
                maxR = Math.max(maxR, r);
                minC = Math.min(minC, c);
                maxC = Math.max(maxC, c);
            }
        }
    }
    if (maxR === -1) return null; // no content
    return { minR, maxR, minC, maxC };
}

function getTrimmedPattern() {
    const bounds = getTrimmedBounds();
    if (!bounds) return null;
    const { minR, maxR, minC, maxC } = bounds;
    const pattern = [];
    for (let r = minR; r <= maxR; r++) {
        const row = [];
        for (let c = minC; c <= maxC; c++) {
            row.push(state.grid[r][c]);
        }
        pattern.push(row);
    }
    return pattern;
}

// Returns pattern from selection if active, otherwise auto-trims
function getPatternRegion() {
    const sel = normalizeSelection();
    // Only use selection if it spans more than a single cell
    const selIsUseful = sel && (sel.maxR > sel.minR || sel.maxC > sel.minC);
    if (selIsUseful) {
        const pattern = [];
        for (let r = sel.minR; r <= sel.maxR; r++) {
            const row = [];
            for (let c = sel.minC; c <= sel.maxC; c++) {
                row.push(state.grid[r][c]);
            }
            pattern.push(row);
        }
        // Return if there's at least one painted cell OR stitch
        const hasContent = pattern.some((row, ri) => row.some((c, ci) => {
            if (c !== null) return true;
            const sr = sel.minR + ri, sc = sel.minC + ci;
            return !!(state.stitchGrid[sr] && state.stitchGrid[sr][sc]);
        }));
        return hasContent ? pattern : null;
    }
    return getTrimmedPattern();
}

// === Selection / Copy-Paste ===
function normalizeSelection() {
    if (!state.selection) return null;
    const s = state.selection;
    return {
        minR: Math.min(s.startRow, s.endRow),
        maxR: Math.max(s.startRow, s.endRow),
        minC: Math.min(s.startCol, s.endCol),
        maxC: Math.max(s.startCol, s.endCol),
    };
}

function renderSelectionOverlay() {
    const container = document.getElementById('grid-container');
    const cells = container.children;
    const sel = normalizeSelection();

    // Clear cell highlights
    for (let i = 0; i < cells.length; i++) {
        cells[i].classList.remove('selected');
    }

    // Remove old selection box
    let box = document.getElementById('selection-box');
    if (box) box.remove();

    if (!sel) return;

    // Highlight selected cells with subtle tint
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const r = +cell.dataset.row, c = +cell.dataset.col;
        if (r >= sel.minR && r <= sel.maxR && c >= sel.minC && c <= sel.maxC) {
            cell.classList.add('selected');
        }
    }

    // Create a single border overlay positioned over the selection
    const topLeft = cells[sel.minR * state.cols + sel.minC];
    const botRight = cells[sel.maxR * state.cols + sel.maxC];
    if (!topLeft || !botRight) return;

    const containerRect = container.getBoundingClientRect();
    const tlRect = topLeft.getBoundingClientRect();
    const brRect = botRight.getBoundingClientRect();

    box = document.createElement('div');
    box.id = 'selection-box';
    // Dark-ink dashed outline with a soft cream shadow — pops against any cell colour
    box.style.cssText = `
        position: absolute;
        border: 2px dashed #2a211a;
        box-shadow: 0 0 0 1px rgba(251, 247, 236, 0.9);
        pointer-events: none;
        z-index: 6;
        border-radius: 2px;
        box-sizing: border-box;
        left: ${tlRect.left - containerRect.left - 1}px;
        top: ${tlRect.top - containerRect.top - 1}px;
        width: ${brRect.right - tlRect.left + 2}px;
        height: ${brRect.bottom - tlRect.top + 2}px;
    `;

    // Append to grid-canvas-wrapper so it's positioned relative to the grid
    const wrapper = container.closest('.grid-canvas-wrapper');
    if (wrapper) wrapper.appendChild(box);
}

function clearSelection() {
    state.selection = null;
    state.isSelecting = false;
    cancelPaste();
    const container = document.getElementById('grid-container');
    for (const cell of container.children) {
        cell.classList.remove('selected');
    }
    const box = document.getElementById('selection-box');
    if (box) box.remove();
    const actions = document.getElementById('selection-actions');
    if (actions) actions.style.display = 'none';
}

function cancelPaste() {
    state.isPasting = false;
    state.pasteGhostPos = null;
    clearPasteGhost();
}

function clearPasteGhost() {
    const container = document.getElementById('grid-container');
    for (const cell of container.children) {
        cell.classList.remove('paste-ghost');
        cell.removeAttribute('data-ghost-color');
        if (!state.grid[+cell.dataset.row]?.[+cell.dataset.col]) {
            cell.style.background = '';
        } else {
            cell.style.background = state.grid[+cell.dataset.row][+cell.dataset.col];
        }
    }
}

function copySelection() {
    const sel = normalizeSelection();
    if (!sel) return;
    state.clipboard = [];
    state.clipboardStitches = [];
    for (let r = sel.minR; r <= sel.maxR; r++) {
        const colorRow = [];
        const stitchRow = [];
        for (let c = sel.minC; c <= sel.maxC; c++) {
            colorRow.push(state.grid[r][c]);
            const s = state.stitchGrid[r] ? state.stitchGrid[r][c] : null;
            stitchRow.push(s === null || typeof s === 'string' ? s : { ...s });
        }
        state.clipboard.push(colorRow);
        state.clipboardStitches.push(stitchRow);
    }
    showToast('Copied');
}

function cutSelection() {
    copySelection();
    const sel = normalizeSelection();
    if (!sel) return;
    for (let r = sel.minR; r <= sel.maxR; r++) {
        for (let c = sel.minC; c <= sel.maxC; c++) {
            state.grid[r][c] = null;
            if (state.stitchGrid[r]) state.stitchGrid[r][c] = null;
            updateCellDOM(r, c);
        }
    }
    clearSelection();
    renderGrid();
    pushHistory();
    showToast('Cut');
}

function pasteClipboard() {
    if (!state.clipboard) {
        showToast('Nothing to paste');
        return;
    }
    // If there's a selection, paste at its top-left corner immediately
    const sel = normalizeSelection();
    if (sel) {
        commitPaste(sel.minR, sel.minC);
        return;
    }
    // Otherwise enter ghost mode
    state.isPasting = true;
    state.pasteGhostPos = { row: 0, col: 0 };
    showToast('Click to place');
}

function renderPasteGhost() {
    clearPasteGhost();
    if (!state.isPasting || !state.pasteGhostPos || !state.clipboard) return;
    const container = document.getElementById('grid-container');
    const { row: startR, col: startC } = state.pasteGhostPos;
    const clipRows = state.clipboard.length;
    const clipCols = state.clipboard[0].length;

    for (let dr = 0; dr < clipRows; dr++) {
        for (let dc = 0; dc < clipCols; dc++) {
            const r = startR + dr, c = startC + dc;
            if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) continue;
            const color = state.clipboard[dr][dc];
            if (color === null) continue;
            const idx = r * state.cols + c;
            const cell = container.children[idx];
            if (cell) {
                cell.classList.add('paste-ghost');
                cell.style.background = color;
            }
        }
    }
}

let pasteIdSeq = 0;
function commitPaste(row, col) {
    if (!state.clipboard) return;
    const clipRows = state.clipboard.length;
    const clipCols = state.clipboard[0].length;
    const pasteIdMap = {}; // maps old crossing IDs to new unique ones
    for (let dr = 0; dr < clipRows; dr++) {
        for (let dc = 0; dc < clipCols; dc++) {
            const r = row + dr, c = col + dc;
            if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) continue;
            // Paste colour
            const color = state.clipboard[dr][dc];
            if (color !== null) {
                state.grid[r][c] = color;
            }
            // Paste stitch
            if (state.clipboardStitches && state.clipboardStitches[dr]) {
                const stitch = state.clipboardStitches[dr][dc];
                if (stitch !== null && stitch !== undefined) {
                    if (state.stitchGrid[r]) {
                        if (typeof stitch === 'string') {
                            state.stitchGrid[r][c] = stitch;
                        } else {
                            // Clone with a new unique ID so it doesn't conflict with the original
                            const newId = pasteIdMap[stitch.id] || ('p' + (++pasteIdSeq));
                            pasteIdMap[stitch.id] = newId;
                            state.stitchGrid[r][c] = { ...stitch, id: newId };
                        }
                    }
                }
            }
        }
    }
    cancelPaste();
    renderGrid();
    pushHistory();
    showToast('Pasted');
}

function deleteSelection() {
    const sel = normalizeSelection();
    if (!sel) return;
    for (let r = sel.minR; r <= sel.maxR; r++) {
        for (let c = sel.minC; c <= sel.maxC; c++) {
            state.grid[r][c] = null;
            if (state.stitchGrid[r]) state.stitchGrid[r][c] = null;
            updateCellDOM(r, c);
        }
    }
    clearSelection();
    renderGrid();
    pushHistory();
}
