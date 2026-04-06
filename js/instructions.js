// === Knitting Instructions Generator ===

const COLOR_NAMES = {
    '#e74c3c': 'red',
    '#e67e22': 'orange',
    '#f1c40f': 'yellow',
    '#2ecc71': 'green',
    '#1abc9c': 'teal',
    '#3498db': 'blue',
    '#9b59b6': 'purple',
    '#e91e63': 'pink',
    '#795548': 'brown',
    '#ecf0f1': 'cream',
    '#2c3e50': 'dark navy',
    '#000000': 'black',
};

const NAMED_COLORS = [
    { hex: '#ff0000', name: 'red' },
    { hex: '#ff4500', name: 'orange-red' },
    { hex: '#ff8c00', name: 'dark orange' },
    { hex: '#ffa500', name: 'orange' },
    { hex: '#ffd700', name: 'gold' },
    { hex: '#ffff00', name: 'yellow' },
    { hex: '#adff2f', name: 'yellow-green' },
    { hex: '#00ff00', name: 'lime' },
    { hex: '#008000', name: 'green' },
    { hex: '#008080', name: 'teal' },
    { hex: '#00ffff', name: 'cyan' },
    { hex: '#0000ff', name: 'blue' },
    { hex: '#4b0082', name: 'indigo' },
    { hex: '#800080', name: 'purple' },
    { hex: '#ff00ff', name: 'magenta' },
    { hex: '#ff69b4', name: 'hot pink' },
    { hex: '#ffc0cb', name: 'pink' },
    { hex: '#a52a2a', name: 'brown' },
    { hex: '#d2691e', name: 'chocolate' },
    { hex: '#f5deb3', name: 'wheat' },
    { hex: '#ffffff', name: 'white' },
    { hex: '#c0c0c0', name: 'silver' },
    { hex: '#808080', name: 'grey' },
    { hex: '#000000', name: 'black' },
    { hex: '#800000', name: 'maroon' },
    { hex: '#000080', name: 'navy' },
    { hex: '#556b2f', name: 'dark olive' },
    { hex: '#2f4f4f', name: 'dark slate' },
];

function hexToRGB(hex) {
    const c = hex.replace('#', '');
    return {
        r: parseInt(c.substr(0, 2), 16),
        g: parseInt(c.substr(2, 2), 16),
        b: parseInt(c.substr(4, 2), 16),
    };
}

function hexToColorName(hex) {
    hex = hex.toLowerCase();
    // Check preset colors first
    if (COLOR_NAMES[hex]) return COLOR_NAMES[hex];

    // Find nearest named color by RGB distance
    const target = hexToRGB(hex);
    let bestName = hex;
    let bestDist = Infinity;

    for (const entry of NAMED_COLORS) {
        const c = hexToRGB(entry.hex);
        const dist = (target.r - c.r) ** 2 + (target.g - c.g) ** 2 + (target.b - c.b) ** 2;
        if (dist < bestDist) {
            bestDist = dist;
            bestName = entry.name;
        }
    }
    return bestName;
}

function buildColorLegend(pattern) {
    const colorsUsed = [];
    const rows = pattern.length;
    const cols = pattern[0].length;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (pattern[r][c] && !colorsUsed.includes(pattern[r][c])) {
                colorsUsed.push(pattern[r][c]);
            }
        }
    }

    const labelMap = {};
    const colors = colorsUsed.map((hex, i) => {
        const name = hexToColorName(hex);
        // If only one design color, use the name directly; otherwise use C1, C2...
        const label = colorsUsed.length === 1 ? name : `C${i + 1}`;
        labelMap[hex] = label;
        return { hex, name, label };
    });

    return { colors, labelMap };
}

function runLengthEncode(cells, stitchType, labelMap) {
    if (cells.length === 0) return '';
    const runs = [];
    let current = cells[0];
    let count = 1;

    for (let i = 1; i < cells.length; i++) {
        if (cells[i] === current) {
            count++;
        } else {
            runs.push({ color: current, count });
            current = cells[i];
            count = 1;
        }
    }
    runs.push({ color: current, count });

    return runs.map(run => {
        const label = run.color === null ? 'BG' : (labelMap[run.color] || run.color);
        return `${stitchType}${run.count} in ${label}`;
    }).join(', ');
}

function formatInstructionsText(pattern, mode) {
    if (!pattern || pattern.length === 0) return '';

    const patRows = pattern.length;
    const patCols = pattern[0].length;
    const legend = buildColorLegend(pattern);
    const isFlat = mode === 'flat';

    let text = 'KNITTING PATTERN INSTRUCTIONS\n';
    text += '==============================\n';
    text += `Size: ${patCols} stitches wide x ${patRows} rows tall\n`;
    text += `Mode: ${isFlat ? 'Flat knitting (back and forth)' : 'In the round'}\n\n`;

    // Colour legend
    text += 'Colour Legend:\n';
    text += '  BG = Background (unspecified)\n';
    legend.colors.forEach(c => {
        if (legend.colors.length === 1) {
            text += `  ${c.label}\n`;
        } else {
            text += `  ${c.label} = ${c.name}\n`;
        }
    });
    text += '\n';

    // Instructions
    text += 'Instructions:\n';

    // Iterate from bottom of pattern (Row 1 in knitting = last array index)
    for (let knittingRow = 1; knittingRow <= patRows; knittingRow++) {
        const arrayRow = patRows - knittingRow; // bottom of pattern = row 1

        if (isFlat) {
            const isRS = (knittingRow % 2 === 1); // odd rows = RS
            const stitchType = isRS ? 'K' : 'P';
            const side = isRS ? 'RS' : 'WS';

            // RS rows: read chart right-to-left (reverse the array row)
            // WS rows: read chart left-to-right (as stored)
            let cells;
            if (isRS) {
                cells = [...pattern[arrayRow]].reverse();
            } else {
                cells = [...pattern[arrayRow]];
            }

            const encoded = runLengthEncode(cells, stitchType, legend.labelMap);
            text += `Row ${knittingRow} (${side}): ${encoded}\n`;
        } else {
            // In the round: all RS, all K, read right-to-left
            const cells = [...pattern[arrayRow]].reverse();
            const encoded = runLengthEncode(cells, 'K', legend.labelMap);
            text += `Rnd ${knittingRow}: ${encoded}\n`;
        }
    }

    return text;
}

// === Instructions Modal ===
function openInstructionsModal() {
    const pattern = getPatternRegion();
    if (!pattern) {
        showToast('Paint some cells first!');
        return;
    }
    const mode = document.getElementById('instructions-mode').value;
    const text = formatInstructionsText(pattern, mode);
    document.getElementById('instructions-text').textContent = text;
    document.getElementById('instructions-modal').classList.add('open');
}

function closeInstructionsModal() {
    document.getElementById('instructions-modal').classList.remove('open');
}

function copyInstructionsToClipboard() {
    const text = document.getElementById('instructions-text').textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard');
    });
}

function downloadInstructionsAsText() {
    const text = document.getElementById('instructions-text').textContent;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knitting-instructions.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Instructions downloaded');
}

// === Bind events ===
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-instructions').addEventListener('click', openInstructionsModal);
    document.getElementById('instructions-close').addEventListener('click', closeInstructionsModal);
    document.getElementById('instructions-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeInstructionsModal();
    });
    document.getElementById('instructions-mode').addEventListener('change', () => {
        // Re-generate when mode changes if modal is open
        if (document.getElementById('instructions-modal').classList.contains('open')) {
            openInstructionsModal();
        }
    });
    document.getElementById('btn-copy-instructions').addEventListener('click', copyInstructionsToClipboard);
    document.getElementById('btn-download-instructions').addEventListener('click', downloadInstructionsAsText);
});
