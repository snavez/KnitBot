// === Print ===
const PRINT_SYMBOLS = ['X', 'O', '/', '\\', '+', '-', '*', '#', '~', '=', '%', '@', '&', '?', '^'];

const STITCH_PRINT_SYMBOLS = {
    knit: 'V',
    purl: '\u2013',  // en-dash
};

function preparePrint() {
    const pattern = getPatternRegion();
    if (!pattern) {
        showToast('Nothing to print — add some stitches or paint cells first!');
        return;
    }

    const patRows = pattern.length;
    const patCols = pattern[0].length;
    const mode = state.knittingMode;
    const isFlat = mode === 'flat';

    // Get the matching stitch region
    const stitchRegion = (typeof getStitchRegion === 'function')
        ? getStitchRegion(patRows, patCols)
        : null;

    // Build color-to-symbol map
    const colorsUsed = [];
    for (let r = 0; r < patRows; r++) {
        for (let c = 0; c < patCols; c++) {
            if (pattern[r][c] && !colorsUsed.includes(pattern[r][c])) {
                colorsUsed.push(pattern[r][c]);
            }
        }
    }
    const hasColors = colorsUsed.length > 0;

    const colorSymbolMap = {};
    colorsUsed.forEach((color, i) => {
        colorSymbolMap[color] = PRINT_SYMBOLS[i % PRINT_SYMBOLS.length];
    });

    // Print info
    const modeLabel = isFlat ? 'Flat' : 'In the round';
    document.getElementById('print-info').textContent =
        `${patCols} stitches wide \u00D7 ${patRows} rows tall \u2014 ${modeLabel}` +
        (hasColors ? ` \u2014 ${colorsUsed.length} colour(s)` : '');

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

    // Track drawn cables
    const drawnCables = new Set();

    // Data rows: top of table = highest row number, bottom = Row 1
    for (let r = 0; r < patRows; r++) {
        const tr = document.createElement('tr');
        const knittingRow = patRows - r;
        const isRS = (knittingRow % 2 === 1);

        // Row header with direction arrow
        const rowHeader = document.createElement('td');
        rowHeader.className = 'row-header';
        if (isFlat) {
            const arrow = isRS ? '\u25C0' : '\u25B6';
            rowHeader.textContent = knittingRow + arrow;
        } else {
            rowHeader.textContent = knittingRow + '\u25C0';
        }
        tr.appendChild(rowHeader);

        for (let c = 0; c < patCols; c++) {
            const td = document.createElement('td');
            const color = pattern[r][c];
            const stitch = stitchRegion && stitchRegion[r] ? stitchRegion[r][c] : null;

            // Background colour
            if (color) {
                td.style.background = color;
                td.style.color = isLightColor(color) ? '#000' : '#fff';
                td.className = 'painted-cell';
            }

            // Stitch symbol
            if (stitch && typeof stitch === 'object') {
                // Crossing
                if (!drawnCables.has(stitch.id)) {
                    drawnCables.add(stitch.id);
                    td.textContent = (typeof buildCrossingNotation === 'function')
                        ? buildCrossingNotation(stitch)
                        : `${stitch.width}-st ${stitch.dir === 'left' ? 'LC' : 'RC'}`;
                    td.colSpan = stitch.width;
                    td.className = (td.className + ' cable-cell').trim();
                    c += stitch.width - 1;
                }
            } else if (stitch === 'purl') {
                td.textContent = STITCH_PRINT_SYMBOLS.purl;
                td.className = (td.className + ' stitch-cell stitch-purl-cell').trim();
            } else if (stitch === 'knit') {
                td.textContent = STITCH_PRINT_SYMBOLS.knit;
                td.className = (td.className + ' stitch-cell').trim();
            } else if (stitch === 'k-right') {
                td.textContent = '/';
                td.className = (td.className + ' stitch-cell').trim();
            } else if (stitch === 'k-left') {
                td.textContent = '\\';
                td.className = (td.className + ' stitch-cell').trim();
            } else if (stitch === 'hole') {
                td.textContent = '\u25CB'; // ○
                td.className = (td.className + ' stitch-cell').trim();
            } else if (hasColors && color) {
                // No stitch override — show colour symbol
                td.textContent = colorSymbolMap[color];
            }

            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    wrapper.appendChild(table);

    // Build legend
    const legend = document.getElementById('print-legend');
    legend.innerHTML = '';

    // Stitch legend — basic symbols
    const hasStitches = stitchRegion && stitchRegion.some(row =>
        row && row.some(s => s !== null)
    );
    if (hasStitches) {
        const stitchLegendHtml = document.createElement('div');
        stitchLegendHtml.innerHTML = '<h3>Stitch Symbols</h3>';
        const stitchGrid = document.createElement('div');
        stitchGrid.className = 'print-legend-grid';
        [
            { sym: 'V', label: 'Knit' },
            { sym: '\u2013', label: 'Purl' },
        ].forEach(entry => {
            const item = document.createElement('div');
            item.className = 'print-legend-item';
            item.innerHTML = `<span class="print-legend-swatch">${entry.sym}</span><span>${entry.label}</span>`;
            stitchGrid.appendChild(item);
        });
        stitchLegendHtml.appendChild(stitchGrid);
        legend.appendChild(stitchLegendHtml);

        // Crossing definitions — only those actually used
        if (typeof collectUniqueCrossings === 'function') {
            const crossings = collectUniqueCrossings(stitchRegion);
            if (crossings.length > 0) {
                const crossLegend = document.createElement('div');
                crossLegend.innerHTML = '<h3>Crossing Definitions</h3>';
                const crossGrid = document.createElement('div');
                crossGrid.className = 'print-legend-grid';
                crossings.forEach(cx => {
                    const item = document.createElement('div');
                    item.className = 'print-legend-item';
                    item.innerHTML = `<span class="print-legend-swatch" style="width:auto;padding:0 2mm;">${cx.notation}</span><span>${cx.description}</span>`;
                    crossGrid.appendChild(item);
                });
                crossLegend.appendChild(crossGrid);
                legend.appendChild(crossLegend);
            }
        }
    }

    // Colour legend
    if (hasColors) {
        const colorLegendHtml = document.createElement('div');
        colorLegendHtml.innerHTML = '<h3>Colour Legend</h3>';
        const colorGrid = document.createElement('div');
        colorGrid.className = 'print-legend-grid';

        colorsUsed.forEach((color, i) => {
            const item = document.createElement('div');
            item.className = 'print-legend-item';
            const swatch = document.createElement('span');
            swatch.className = 'print-legend-swatch';
            swatch.style.background = color;
            swatch.style.color = isLightColor(color) ? '#000' : '#fff';
            swatch.textContent = colorSymbolMap[color];
            const label = document.createElement('span');
            const name = (typeof hexToColorName === 'function') ? hexToColorName(color) : color;
            const colLabel = colorsUsed.length === 1 ? name : `C${i + 1} (${name})`;
            label.textContent = `${colorSymbolMap[color]} = ${colLabel}`;
            item.appendChild(swatch);
            item.appendChild(label);
            colorGrid.appendChild(item);
        });
        colorLegendHtml.appendChild(colorGrid);
        legend.appendChild(colorLegendHtml);
    }

    // Add text instructions
    const printInstr = document.getElementById('print-instructions');
    if (printInstr && typeof formatInstructionsText === 'function') {
        const text = formatInstructionsText(pattern, mode);
        const pre = document.createElement('pre');
        pre.textContent = text;
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
