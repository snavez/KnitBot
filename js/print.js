// === Print ===
const PRINT_SYMBOLS = ['X', 'O', '/', '\\', '+', '-', '*', '#', '~', '=', '%', '@', '&', '?', '^'];

function preparePrint() {
    const pattern = getPatternRegion();
    if (!pattern) {
        showToast('Nothing to print — paint some cells first!');
        return;
    }

    const patRows = pattern.length;
    const patCols = pattern[0].length;

    // Build color-to-symbol map
    const colorsUsed = [];
    for (let r = 0; r < patRows; r++) {
        for (let c = 0; c < patCols; c++) {
            if (pattern[r][c] && !colorsUsed.includes(pattern[r][c])) {
                colorsUsed.push(pattern[r][c]);
            }
        }
    }

    const colorSymbolMap = {};
    colorsUsed.forEach((color, i) => {
        colorSymbolMap[color] = PRINT_SYMBOLS[i % PRINT_SYMBOLS.length];
    });

    // Print info
    document.getElementById('print-info').textContent =
        `${patCols} stitches wide × ${patRows} rows tall — ${colorsUsed.length} colour(s)`;

    // Build print grid table
    const wrapper = document.getElementById('print-grid-wrapper');
    wrapper.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'print-grid';

    // Column header row
    const headRow = document.createElement('tr');
    const cornerTh = document.createElement('th');
    headRow.appendChild(cornerTh);
    for (let c = 0; c < patCols; c++) {
        const th = document.createElement('th');
        th.textContent = c + 1;
        headRow.appendChild(th);
    }
    table.appendChild(headRow);

    // Data rows: top of table = highest row number, bottom = Row 1
    // array[0] = top of visual grid = top of fabric = highest knitting row
    // array[last] = bottom of visual grid = bottom of fabric = Row 1
    for (let r = 0; r < patRows; r++) {
        const tr = document.createElement('tr');

        // Row number: knitting Row 1 = last array row (bottom of fabric)
        const knittingRow = patRows - r;
        const rowHeader = document.createElement('td');
        rowHeader.className = 'row-header';
        rowHeader.textContent = knittingRow;
        tr.appendChild(rowHeader);

        for (let c = 0; c < patCols; c++) {
            const td = document.createElement('td');
            const color = pattern[r][c];
            if (color) {
                td.className = 'painted-cell';
                td.style.background = color;
                td.textContent = colorSymbolMap[color];
                td.style.color = isLightColor(color) ? '#000' : '#fff';
            }
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    wrapper.appendChild(table);

    // Build legend using color names (no hex codes)
    const legend = document.getElementById('print-legend');
    legend.innerHTML = '<h3>Colour Legend</h3>';
    const grid = document.createElement('div');
    grid.className = 'print-legend-grid';

    colorsUsed.forEach((color, i) => {
        const item = document.createElement('div');
        item.className = 'print-legend-item';

        const swatch = document.createElement('span');
        swatch.className = 'print-legend-swatch';
        swatch.style.background = color;
        swatch.style.color = isLightColor(color) ? '#000' : '#fff';
        swatch.textContent = colorSymbolMap[color];

        const label = document.createElement('span');
        // Use color name from instructions.js if available, otherwise hex
        const name = (typeof hexToColorName === 'function') ? hexToColorName(color) : color;
        const colLabel = colorsUsed.length === 1 ? name : `C${i + 1} (${name})`;
        label.textContent = `${colorSymbolMap[color]} = ${colLabel}`;

        item.appendChild(swatch);
        item.appendChild(label);
        grid.appendChild(item);
    });
    legend.appendChild(grid);

    // Add text instructions if instructions.js is loaded
    const printInstr = document.getElementById('print-instructions');
    if (printInstr && typeof formatInstructionsText === 'function') {
        const flatText = formatInstructionsText(pattern, 'flat');
        const pre = document.createElement('pre');
        pre.textContent = flatText;
        printInstr.innerHTML = '';
        printInstr.appendChild(pre);
    }

    // Trigger print
    setTimeout(() => window.print(), 100);
}

function isLightColor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
}
