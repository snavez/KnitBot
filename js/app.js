// === State ===
const state = {
    rows: 20,
    cols: 20,
    grid: [],           // 2D array: null = empty, string = color
    activeColor: null,
    activeTool: 'paint', // 'paint', 'erase', 'fill', 'select'
    isPainting: false,
    history: [],
    historyIndex: -1,
    maxHistory: 50,
    patternName: '',
    // Selection / copy-paste
    selection: null,      // { startRow, startCol, endRow, endCol } or null
    clipboard: null,      // 2D array of cell colors
    isSelecting: false,
    isPasting: false,
    pasteGhostPos: null,  // { row, col }
};

const COLORS = [
    '#e74c3c', // red
    '#e67e22', // orange
    '#f1c40f', // yellow
    '#2ecc71', // green
    '#1abc9c', // teal
    '#3498db', // blue
    '#9b59b6', // purple
    '#e91e63', // pink
    '#795548', // brown
    '#ecf0f1', // white/cream
    '#2c3e50', // dark navy
    '#000000', // black
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
    // Keep the label
    const label = palette.querySelector('label');
    palette.innerHTML = '';
    palette.appendChild(label);

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
    state.grid = [];
    for (let r = 0; r < rows; r++) {
        state.grid[r] = [];
        for (let c = 0; c < cols; c++) {
            state.grid[r][c] = (oldGrid[r] && oldGrid[r][c]) || null;
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
}

function renderNumbers() {
    const rowNums = document.getElementById('row-numbers');
    const colNums = document.getElementById('col-numbers');
    rowNums.innerHTML = '';
    colNums.innerHTML = '';

    for (let r = 0; r < state.rows; r++) {
        const el = document.createElement('div');
        el.className = 'row-number';
        el.textContent = r + 1;
        rowNums.appendChild(el);
    }

    for (let c = 0; c < state.cols; c++) {
        const el = document.createElement('div');
        el.className = 'col-number';
        el.textContent = c + 1;
        colNums.appendChild(el);
    }
}

function paintCell(row, col) {
    if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return;

    if (state.activeTool === 'erase') {
        state.grid[row][col] = null;
    } else if (state.activeTool === 'fill') {
        floodFill(row, col, state.grid[row][col], state.activeColor);
    } else {
        state.grid[row][col] = state.activeColor;
    }

    updateCellDOM(row, col);
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

        state.isPainting = true;
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

        if (!state.isPainting || state.activeTool === 'fill') return;
        paintCell(r, c);
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

    // Touch support
    container.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const cell = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!cell || !cell.classList.contains('grid-cell')) return;
        e.preventDefault();
        state.isPainting = true;
        paintCell(+cell.dataset.row, +cell.dataset.col);
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        if (!state.isPainting || state.activeTool === 'fill') return;
        const touch = e.touches[0];
        const cell = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!cell || !cell.classList.contains('grid-cell')) return;
        e.preventDefault();
        paintCell(+cell.dataset.row, +cell.dataset.col);
    }, { passive: false });

    container.addEventListener('touchend', () => {
        if (state.isPainting) {
            state.isPainting = false;
            pushHistory();
        }
    });

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
            for (let c = 0; c < state.cols; c++)
                state.grid[r][c] = null;
        renderGrid();
        pushHistory();
    });

    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);
    document.getElementById('btn-preview').addEventListener('click', openPreview);
    document.getElementById('btn-print').addEventListener('click', () => preparePrint());
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
function pushHistory() {
    const snapshot = state.grid.map(row => [...row]);
    // Remove any future states after current index
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push({ grid: snapshot, rows: state.rows, cols: state.cols });
    if (state.history.length > state.maxHistory) {
        state.history.shift();
    }
    state.historyIndex = state.history.length - 1;
    updateUndoRedoButtons();
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
    document.getElementById('grid-rows').value = state.rows;
    document.getElementById('grid-cols').value = state.cols;
    renderGrid();
    updateUndoRedoButtons();
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
    state.patternName = data.name || '';
    document.getElementById('grid-rows').value = state.rows;
    document.getElementById('grid-cols').value = state.cols;
    document.getElementById('pattern-name').value = state.patternName;
    renderGrid();
    state.history = [];
    state.historyIndex = -1;
    pushHistory();
}

function saveToFile() {
    const name = document.getElementById('pattern-name').value.trim() || 'untitled';
    state.patternName = name;
    const data = {
        version: 1,
        name: name,
        rows: state.rows,
        cols: state.cols,
        grid: state.grid,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9_-]/gi, '_')}.knit.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Saved "${name}"`);
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

// === Auto-trim: find the bounding box of painted cells ===
function getTrimmedBounds() {
    let minR = state.rows, maxR = -1, minC = state.cols, maxC = -1;
    for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
            if (state.grid[r][c]) {
                minR = Math.min(minR, r);
                maxR = Math.max(maxR, r);
                minC = Math.min(minC, c);
                maxC = Math.max(maxC, c);
            }
        }
    }
    if (maxR === -1) return null; // no painted cells
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
    if (sel) {
        const pattern = [];
        for (let r = sel.minR; r <= sel.maxR; r++) {
            const row = [];
            for (let c = sel.minC; c <= sel.maxC; c++) {
                row.push(state.grid[r][c]);
            }
            pattern.push(row);
        }
        // Only return if there's at least one painted cell
        const hasPaint = pattern.some(row => row.some(c => c !== null));
        return hasPaint ? pattern : null;
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

    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const r = +cell.dataset.row, c = +cell.dataset.col;
        if (sel && r >= sel.minR && r <= sel.maxR && c >= sel.minC && c <= sel.maxC) {
            cell.classList.add('selected');
        } else {
            cell.classList.remove('selected');
        }
    }
}

function clearSelection() {
    state.selection = null;
    state.isSelecting = false;
    cancelPaste();
    const container = document.getElementById('grid-container');
    for (const cell of container.children) {
        cell.classList.remove('selected');
    }
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
    for (let r = sel.minR; r <= sel.maxR; r++) {
        const row = [];
        for (let c = sel.minC; c <= sel.maxC; c++) {
            row.push(state.grid[r][c]);
        }
        state.clipboard.push(row);
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
            updateCellDOM(r, c);
        }
    }
    clearSelection();
    pushHistory();
    showToast('Cut');
}

function pasteClipboard() {
    if (!state.clipboard) {
        showToast('Nothing to paste');
        return;
    }
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

function commitPaste(row, col) {
    if (!state.clipboard) return;
    const clipRows = state.clipboard.length;
    const clipCols = state.clipboard[0].length;
    for (let dr = 0; dr < clipRows; dr++) {
        for (let dc = 0; dc < clipCols; dc++) {
            const r = row + dr, c = col + dc;
            if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) continue;
            const color = state.clipboard[dr][dc];
            if (color !== null) {
                state.grid[r][c] = color;
                updateCellDOM(r, c);
            }
        }
    }
    cancelPaste();
    pushHistory();
    showToast('Pasted');
}

function deleteSelection() {
    const sel = normalizeSelection();
    if (!sel) return;
    for (let r = sel.minR; r <= sel.maxR; r++) {
        for (let c = sel.minC; c <= sel.maxC; c++) {
            state.grid[r][c] = null;
            updateCellDOM(r, c);
        }
    }
    clearSelection();
    pushHistory();
}
