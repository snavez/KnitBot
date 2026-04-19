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
    const hasColors = legend.colors.length > 0;

    // Determine the stitchGrid region matching the pattern
    const stitchRegion = getStitchRegion(patRows, patCols);

    let text = 'KNITTING PATTERN INSTRUCTIONS\n';
    text += '==============================\n';
    text += `Size: ${patCols} stitches wide x ${patRows} rows tall\n`;
    text += `Mode: ${isFlat ? 'Flat knitting (back and forth)' : 'In the round'}\n\n`;

    // Colour legend — only if colours are present
    if (hasColors) {
        text += 'Colour Legend:\n';
        text += '  BG = Background (unspecified)\n';
        legend.colors.forEach(c => {
            if (legend.colors.length === 1) {
                text += `  ${c.label}\n`;
            } else {
                text += `  ${c.label} = ${c.name}\n`;
            }
        });
    }

    // Collect all unique crossings used in the pattern
    const crossings = collectUniqueCrossings(stitchRegion);
    if (crossings.length > 0) {
        text += '\nCrossing Definitions:\n';
        crossings.forEach(cx => {
            text += `  ${cx.notation}: ${cx.description}\n`;
        });
    }

    // Check for lace/decrease features
    const hasHoles = stitchRegion && stitchRegion.some(row =>
        row && row.some(s => s === 'hole')
    );
    const hasLeans = stitchRegion && stitchRegion.some(row =>
        row && row.some(s => s === 'k-right' || s === 'k-left')
    );
    const hasM1 = stitchRegion && stitchRegion.some(row =>
        row && row.some(s => s === 'm1r' || s === 'm1l')
    );
    if (hasHoles || hasLeans || hasM1) {
        text += '\nLace/Decrease Abbreviations:\n';
        if (hasHoles) text += '  YO = Yarn over (creates decorative hole)\n';
        if (hasLeans || hasHoles) {
            text += '  K2tog = Knit 2 together (right-leaning decrease)\n';
            text += '  SSK = Slip, slip, knit (left-leaning decrease)\n';
            text += '  P2tog = Purl 2 together (WS right-leaning decrease)\n';
            text += '  SSP = Slip, slip, purl (WS left-leaning decrease)\n';
        }
        if (hasHoles) {
            text += '  S2KP = Sl 1 kwise, K2tog, psso (centred double decrease, balances 2 YOs)\n';
            text += '  SP2P = Sl 1 pwise, P2tog, pass sl st over (WS centred double decrease)\n';
        }
        if (hasM1) {
            text += '  M1R = Make 1 right (pick up bar back-to-front, knit through front loop)\n';
            text += '  M1L = Make 1 left (pick up bar front-to-back, knit through back loop)\n';
        }
    }
    text += '\n';

    // Instructions
    text += 'Instructions:\n';

    for (let knittingRow = 1; knittingRow <= patRows; knittingRow++) {
        const arrayRow = patRows - knittingRow;

        if (isFlat) {
            const isRS = (knittingRow % 2 === 1);
            const defaultSt = isRS ? 'K' : 'P';
            const side = isRS ? 'RS' : 'WS';

            const rowInstructions = encodeRowWithStitches(
                pattern[arrayRow],
                stitchRegion ? stitchRegion[arrayRow] : null,
                defaultSt,
                legend.labelMap,
                isRS,
                hasColors
            );
            text += `Row ${knittingRow} (${side}): ${rowInstructions}\n`;
        } else {
            const rowInstructions = encodeRowWithStitches(
                pattern[arrayRow],
                stitchRegion ? stitchRegion[arrayRow] : null,
                'K',
                legend.labelMap,
                true,
                hasColors
            );
            text += `Rnd ${knittingRow}: ${rowInstructions}\n`;
        }
    }

    return text;
}

// Get the stitch grid region matching the current pattern region
function getStitchRegion(patRows, patCols) {
    if (!state.stitchGrid || !state.stitchGrid.length) return null;

    // Check if a selection is active
    const sel = (typeof normalizeSelection === 'function') ? normalizeSelection() : null;
    if (sel) {
        const region = [];
        for (let r = sel.minR; r <= sel.maxR; r++) {
            const row = [];
            for (let c = sel.minC; c <= sel.maxC; c++) {
                row.push(state.stitchGrid[r] ? state.stitchGrid[r][c] : null);
            }
            region.push(row);
        }
        return region;
    }

    // Otherwise use trimmed bounds
    const bounds = getTrimmedBounds();
    if (!bounds) return null;
    const region = [];
    for (let r = bounds.minR; r <= bounds.maxR; r++) {
        const row = [];
        for (let c = bounds.minC; c <= bounds.maxC; c++) {
            row.push(state.stitchGrid[r] ? state.stitchGrid[r][c] : null);
        }
        region.push(row);
    }
    return region;
}

// Encode a single row including stitch types and cables
function encodeRowWithStitches(colorRow, stitchRow, defaultSt, labelMap, reverseRead, hasColors) {
    const len = colorRow.length;
    if (!stitchRow) {
        // No stitch data — fall back to simple colour encoding
        const cells = reverseRead ? [...colorRow].reverse() : [...colorRow];
        return hasColors ? runLengthEncode(cells, defaultSt, labelMap) : `${defaultSt}${len}`;
    }

    // Build an array of instruction tokens for each cell
    const tokens = [];
    const processed = new Set();

    // Process in chart order (L-to-R in array), then reverse if needed
    for (let c = 0; c < len; c++) {
        const stitch = stitchRow[c];

        if (stitch && typeof stitch === 'object' && !processed.has(stitch.id)) {
            processed.add(stitch.id);
            const color = colorRow[c];

            const notation = buildCrossingNotation(stitch);

            if (hasColors && color !== null) {
                const colorLabel = color === null ? 'BG' : (labelMap[color] || color);
                tokens.push({ text: notation + ' in ' + colorLabel, span: stitch.width });
            } else {
                tokens.push({ text: notation, span: stitch.width });
            }
            c += stitch.width - 1;
        } else if (stitch && typeof stitch === 'object') {
            // Already processed cable cell, skip
            continue;
        } else if (stitch === 'k-right') {
            // Right-leaning decrease: K2tog on RS, P2tog on WS
            const isRS = (defaultSt === 'K');
            tokens.push({ text: isRS ? 'K2tog' : 'P2tog', span: 1, isDecrease: true });
        } else if (stitch === 'k-left') {
            // Left-leaning decrease: SSK on RS, SSP on WS
            const isRS = (defaultSt === 'K');
            tokens.push({ text: isRS ? 'SSK' : 'SSP', span: 1, isDecrease: true });
        } else if (stitch === 'm1r') {
            tokens.push({ text: 'M1R', span: 1, isIncrease: true });
        } else if (stitch === 'm1l') {
            tokens.push({ text: 'M1L', span: 1, isIncrease: true });
        } else if (stitch === 'hole') {
            // Hole = YO
            tokens.push({ text: 'YO', span: 1, isHole: true });
        } else if (stitch === 'no-stitch') {
            // Skip — this cell doesn't exist in the pattern
            continue;
        } else {
            // Simple stitch: knit, purl, or default
            // The chart shows the RS appearance. On WS rows, K↔P are flipped:
            // chart 'knit' = purl on WS, chart 'purl' = knit on WS
            const isPurl = (stitch === 'purl');
            const isWS = (defaultSt === 'P');
            let st;
            if (isPurl) {
                st = isWS ? 'K' : 'P'; // purl on chart: K on WS, P on RS
            } else {
                st = isWS ? 'P' : 'K'; // knit on chart: P on WS, K on RS
            }
            const color = colorRow[c];
            tokens.push({ st: st, color: color, span: 1 });
        }
    }

    // Reverse if reading R-to-L
    if (reverseRead) tokens.reverse();

    // Insert balancing decreases for holes (YOs) that aren't already balanced
    // by explicit k-right/k-left lean stitches.
    const isRS = (defaultSt === 'K');

    // Count explicit decreases vs holes
    let explicitDecCount = tokens.filter(t => t.isDecrease).length;
    let holeCount = tokens.filter(t => t.isHole).length;
    let unbalancedHoles = holeCount - explicitDecCount;

    // If all holes are already balanced by explicit lean stitches, skip auto-decrease
    if (unbalancedHoles <= 0) {
        // All balanced — skip to run-length encoding
    } else {

    const pairedHoles = new Set();

    // Pass 1: Find hole-knit-hole patterns (centred double decrease)
    for (let i = 0; i < tokens.length - 2; i++) {
        if (tokens[i].isHole && !pairedHoles.has(i) &&
            tokens[i+1].st && !tokens[i+1].converted &&
            tokens[i+2].isHole && !pairedHoles.has(i+2)) {
            // Found: YO, [knit], YO → convert middle to S2KP
            const technique = isRS ? 'S2KP' : 'SP2P';
            tokens[i+1] = { text: technique, span: 1, converted: true };
            pairedHoles.add(i);
            pairedHoles.add(i+2);
            // S2KP is a double decrease (-2), balanced by the 2 YOs (+2) — perfectly balanced
        }
    }

    // Pass 2: Remaining unpaired holes need single decreases
    for (let i = 0; i < tokens.length; i++) {
        if (!tokens[i].isHole || pairedHoles.has(i)) continue;

        // Find the nearest unconverted knit stitch
        let bestIdx = -1;
        for (let d = 1; d < tokens.length; d++) {
            const ri = i + d;
            if (ri < tokens.length && tokens[ri].st === defaultSt && !tokens[ri].converted) {
                bestIdx = ri;
                break;
            }
            const li = i - d;
            if (li >= 0 && tokens[li].st === defaultSt && !tokens[li].converted) {
                bestIdx = li;
                break;
            }
        }
        if (bestIdx >= 0) {
            const isAfterHole = bestIdx > i;
            let technique;
            if (!isRS) {
                technique = 'P2tog';
            } else {
                technique = isAfterHole ? 'K2tog' : 'SSK';
            }
            tokens[bestIdx] = { text: technique, span: 1, converted: true };
        }
    }
    } // end if (unbalancedHoles > 0)

    // Now run-length encode the simple stitch tokens, keeping cable tokens as-is
    const parts = [];
    let i = 0;
    while (i < tokens.length) {
        const tok = tokens[i];
        if (tok.text) {
            // Cable/twist — emit as-is
            parts.push(tok.text);
            i++;
        } else {
            // Simple stitch — group consecutive same st+color
            let count = tok.span;
            let j = i + 1;
            while (j < tokens.length && !tokens[j].text &&
                   tokens[j].st === tok.st && tokens[j].color === tok.color) {
                count += tokens[j].span;
                j++;
            }
            if (hasColors) {
                const colorLabel = tok.color === null ? 'BG' : (labelMap[tok.color] || tok.color);
                parts.push(`${tok.st}${count} in ${colorLabel}`);
            } else {
                parts.push(`${tok.st}${count}`);
            }
            i = j;
        }
    }

    return parts.join(', ');
}

// === Crossing Notation & Descriptions ===
function buildCrossingNotation(stitch) {
    const clusters = stitch.clusters || [];
    const dirLabel = stitch.dir === 'left' ? 'LC' : 'RC';

    if (clusters.length === 0 || clusters.length === 1) {
        // Pure cable (all same type)
        const half = Math.floor(stitch.width / 2);
        return `${half}/${stitch.width - half} ${dirLabel}`;
    }

    if (clusters.length === 2) {
        const left = clusters[0];
        const right = clusters[1];
        const leftLabel = left.st === 'knit' ? `K${left.count}` : `P${left.count}`;
        const rightLabel = right.st === 'knit' ? `K${right.count}` : `P${right.count}`;
        return `${leftLabel}/${rightLabel} ${dirLabel}`;
    }

    if (clusters.length === 3) {
        const left = clusters[0];
        const center = clusters[1];
        const right = clusters[2];
        const leftLabel = left.st === 'knit' ? `K${left.count}` : `P${left.count}`;
        const centerLabel = center.st === 'knit' ? `K${center.count}` : `P${center.count}`;
        const rightLabel = right.st === 'knit' ? `K${right.count}` : `P${right.count}`;
        return `${leftLabel}/${centerLabel}/${rightLabel} ${dirLabel}`;
    }

    return `${stitch.width}-st ${dirLabel}`;
}

function buildCrossingDescription(stitch) {
    const clusters = stitch.clusters || [];
    const isLeft = stitch.dir === 'left';

    // Left Cross: slip LEFT group to CN, hold at FRONT → right group leans left in front
    // Right Cross: slip RIGHT group to CN, hold at BACK → left group leans right in front

    if (clusters.length === 0 || clusters.length === 1) {
        // Pure cable
        const half = Math.floor(stitch.width / 2);
        const rem = stitch.width - half;
        if (isLeft) {
            return `Sl ${half} sts to CN and hold at front, K${rem} from LN, K${half} from CN.`;
        } else {
            return `Sl ${rem} sts to CN and hold at back, K${half} from LN, K${rem} from CN.`;
        }
    }

    if (clusters.length === 2) {
        const left = clusters[0];
        const right = clusters[1];
        if (isLeft) {
            // LC: slip left group to CN front, work right group from LN, then left from CN
            const workFirst = right.st === 'knit' ? `K${right.count}` : `P${right.count}`;
            const workCN = left.st === 'knit' ? `K${left.count}` : `P${left.count}`;
            return `Sl ${left.count} sts to CN and hold at front, ${workFirst} from LN, ${workCN} from CN.`;
        } else {
            // RC: slip right group to CN back, work left group from LN, then right from CN
            const workFirst = left.st === 'knit' ? `K${left.count}` : `P${left.count}`;
            const workCN = right.st === 'knit' ? `K${right.count}` : `P${right.count}`;
            return `Sl ${right.count} sts to CN and hold at back, ${workFirst} from LN, ${workCN} from CN.`;
        }
    }

    if (clusters.length === 3) {
        const left = clusters[0];
        const center = clusters[1];
        const right = clusters[2];
        const centerWork = center.st === 'knit' ? `K${center.count}` : `P${center.count}`;
        if (isLeft) {
            return `Sl ${left.count + center.count} sts to CN and hold at front, ${right.st === 'knit' ? 'K' : 'P'}${right.count} from LN, sl last ${center.count} from CN back to LN and ${centerWork}, ${left.st === 'knit' ? 'K' : 'P'}${left.count} from CN.`;
        } else {
            return `Sl ${right.count} sts to CN and hold at back, ${left.st === 'knit' ? 'K' : 'P'}${left.count} from LN, ${centerWork} from LN, ${right.st === 'knit' ? 'K' : 'P'}${right.count} from CN.`;
        }
    }

    return `Work ${stitch.width}-stitch ${isLeft ? 'left' : 'right'} cross.`;
}

function collectUniqueCrossings(stitchRegion) {
    if (!stitchRegion) return [];
    const seen = new Set();
    const crossings = [];

    for (const row of stitchRegion) {
        if (!row) continue;
        for (const s of row) {
            if (!s || typeof s !== 'object' || s.type !== 'cross') continue;
            const notation = buildCrossingNotation(s);
            if (seen.has(notation)) continue;
            seen.add(notation);
            crossings.push({
                notation: notation,
                description: buildCrossingDescription(s),
            });
        }
    }
    return crossings;
}

// === Instructions Modal ===
function openInstructionsModal() {
    // Clear any stale single-cell selections that would interfere
    if (state.selection && typeof clearSelection === 'function') {
        const sel = normalizeSelection();
        if (sel && sel.minR === sel.maxR && sel.minC === sel.maxC) {
            clearSelection();
        }
    }
    const pattern = getPatternRegion();
    if (!pattern) {
        showToast('Add some stitches or paint some cells first!');
        return;
    }

    const textEl = document.getElementById('instructions-text');
    const hintEl = document.getElementById('instructions-edit-hint');

    // If we have saved custom instructions, show those; otherwise generate
    if (state.customInstructions) {
        textEl.textContent = state.customInstructions;
        hintEl.innerHTML = '<span class="instructions-edited">Edited</span> — click text to edit';
    } else {
        const mode = state.knittingMode;
        const text = formatInstructionsText(pattern, mode);
        textEl.textContent = text;
        hintEl.textContent = 'Click text to edit';
    }
    document.getElementById('instructions-modal').classList.add('open');
}

function regenerateInstructions() {
    const pattern = getPatternRegion();
    if (!pattern) return;
    const mode = state.knittingMode;
    const text = formatInstructionsText(pattern, mode);
    document.getElementById('instructions-text').textContent = text;
    state.customInstructions = null; // clear saved edits
    document.getElementById('instructions-edit-hint').textContent = 'Click text to edit';
    showToast('Instructions regenerated');
}

function saveCustomInstructions() {
    const text = document.getElementById('instructions-text').textContent;
    state.customInstructions = text;
    document.getElementById('instructions-edit-hint').innerHTML = '<span class="instructions-edited">Edited</span> — click text to edit';
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
    document.getElementById('btn-copy-instructions').addEventListener('click', copyInstructionsToClipboard);
    document.getElementById('btn-download-instructions').addEventListener('click', downloadInstructionsAsText);
    document.getElementById('btn-print-instructions').addEventListener('click', () => {
        preparePrint();
    });
    document.getElementById('btn-regenerate-instructions').addEventListener('click', regenerateInstructions);

    // Auto-save edits when the user modifies the instructions text
    document.getElementById('instructions-text').addEventListener('input', () => {
        saveCustomInstructions();
    });

    // Re-generate instructions when global knitting mode changes
    document.getElementById('knitting-mode').addEventListener('change', () => {
        if (document.getElementById('instructions-modal').classList.contains('open')) {
            state.customInstructions = null; // mode changed, regenerate
            openInstructionsModal();
        }
    });
});
