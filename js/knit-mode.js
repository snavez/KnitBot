// === Active Knitting Mode ===
// Follow along row by row while knitting from the pattern.

const knitState = {
    active: false,
    currentKnitRow: 1, // knitting row number (1 = bottom)
    totalRows: 0,
    instructions: [],   // cached per-row instructions
    fullscreen: false,
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-knit').addEventListener('click', enterKnitMode);
    document.getElementById('knit-exit').addEventListener('click', exitKnitMode);
    document.getElementById('knit-prev').addEventListener('click', prevRow);
    document.getElementById('knit-next').addEventListener('click', nextRow);
    document.getElementById('knit-fullscreen').addEventListener('click', toggleFullscreen);

    document.getElementById('knit-fs-prev').addEventListener('click', prevRow);
    document.getElementById('knit-fs-next').addEventListener('click', nextRow);
    document.getElementById('knit-fs-grid').addEventListener('click', () => {
        knitState.fullscreen = false;
        document.getElementById('knit-fullscreen-view').style.display = 'none';
        document.getElementById('knit-overlay').style.display = 'block';
        updateKnitDisplay();
    });
    document.getElementById('knit-fs-exit').addEventListener('click', exitKnitMode);

    // Keyboard navigation when in knit mode
    document.addEventListener('keydown', (e) => {
        if (!knitState.active) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
            e.preventDefault();
            nextRow();
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            prevRow();
        }
        if (e.key === 'Escape') {
            exitKnitMode();
        }
        if (e.key === 'f' || e.key === 'F') {
            toggleFullscreen();
        }
    });
});

function enterKnitMode() {
    const pattern = getPatternRegion();
    if (!pattern) {
        showToast('Add some stitches or paint cells first!');
        return;
    }

    knitState.active = true;
    knitState.totalRows = pattern.length;
    knitState.currentKnitRow = 1;

    // Generate instructions using the same path as the Instructions modal
    // Parse the full instruction text and extract per-row instructions
    const mode = state.knittingMode;
    const fullText = formatInstructionsText(pattern, mode);

    knitState.instructions = [];
    const lines = fullText.split('\n');
    for (let kRow = 1; kRow <= knitState.totalRows; kRow++) {
        // Find the line for this row
        const prefix = mode === 'flat' ? `Row ${kRow} ` : `Rnd ${kRow}`;
        const line = lines.find(l => l.startsWith(prefix));
        if (line) {
            // Extract just the instruction part after the colon
            const colonIdx = line.indexOf(':');
            knitState.instructions.push(colonIdx >= 0 ? line.substring(colonIdx + 2) : line);
        } else {
            knitState.instructions.push('');
        }
    }

    document.getElementById('knit-overlay').style.display = 'block';
    updateKnitDisplay();
    showToast('Knitting mode! Use arrow keys or buttons to navigate rows.');
}

function exitKnitMode() {
    knitState.active = false;
    knitState.fullscreen = false;
    document.getElementById('knit-overlay').style.display = 'none';
    document.getElementById('knit-fullscreen-view').style.display = 'none';
    clearKnitHighlight();
}

function nextRow() {
    if (knitState.currentKnitRow < knitState.totalRows) {
        knitState.currentKnitRow++;
        updateKnitDisplay();
    }
}

function prevRow() {
    if (knitState.currentKnitRow > 1) {
        knitState.currentKnitRow--;
        updateKnitDisplay();
    }
}

function toggleFullscreen() {
    knitState.fullscreen = !knitState.fullscreen;
    if (knitState.fullscreen) {
        document.getElementById('knit-overlay').style.display = 'none';
        document.getElementById('knit-fullscreen-view').style.display = 'flex';
    } else {
        document.getElementById('knit-fullscreen-view').style.display = 'none';
        document.getElementById('knit-overlay').style.display = 'block';
    }
    updateKnitDisplay();
}

function updateKnitDisplay() {
    const kRow = knitState.currentKnitRow;
    const isFlat = state.knittingMode === 'flat';
    const isRS = (kRow % 2 === 1);

    let rowLabel, directionText;
    if (isFlat) {
        const side = isRS ? 'RS' : 'WS';
        const arrow = isRS ? '\u25C0 Work right to left' : '\u25B6 Work left to right';
        rowLabel = `Row ${kRow} (${side})`;
        directionText = arrow;
    } else {
        rowLabel = `Rnd ${kRow}`;
        directionText = '\u25C0 Work right to left';
    }

    const instruction = knitState.instructions[kRow - 1] || '';
    const progress = `${kRow} / ${knitState.totalRows}`;

    // Update bar overlay
    document.getElementById('knit-row-label').textContent = rowLabel;
    document.getElementById('knit-direction').textContent = directionText;
    document.getElementById('knit-instruction').textContent = instruction;

    // Update fullscreen view
    document.getElementById('knit-fs-row').textContent = rowLabel;
    document.getElementById('knit-fs-direction').textContent = directionText;
    document.getElementById('knit-fs-instruction').textContent = instruction;
    document.getElementById('knit-fs-progress').textContent = `Row ${progress}`;

    // Highlight current row on the grid
    highlightKnitRow(kRow);
}

function highlightKnitRow(kRow) {
    clearKnitHighlight();
    const arrayRow = knitState.totalRows - kRow;
    // Offset by the trim bounds if needed
    const bounds = getTrimmedBounds();
    if (!bounds) return;
    const gridRow = bounds.minR + arrayRow;

    const container = document.getElementById('grid-container');
    if (!container) return;
    for (let c = 0; c < state.cols; c++) {
        const idx = gridRow * state.cols + c;
        const cell = container.children[idx];
        if (cell) cell.classList.add('knit-active-row');
    }

    // Scroll the row into view
    const firstCell = container.children[gridRow * state.cols];
    if (firstCell) {
        firstCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function clearKnitHighlight() {
    document.querySelectorAll('.knit-active-row').forEach(el => {
        el.classList.remove('knit-active-row');
    });
}
