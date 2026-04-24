// === Context-Driven Crossing System ===
// Crossings read K/P context from surrounding rows.
// The chart shows WHAT the fabric looks like, not HOW to make it.

const STITCH_COLORS = {
    bg: '#fbf7ec',       // warm paper (main background)
    purlBg: '#fbf7ec',   // same as bg — no tint for purl cells
    yarn: '#2a211a',     // dark ink (all main stitch lines)
    yarnDark: '#2a211a', // dark ink (was secondary, now same)
    yarnFront: '#2a211a',// dark ink (cross front strands now black too)
    yarnBack: '#c9bca0', // muted paper (back/behind cross strand only)
    accent: '#2a211a',   // dark ink for +/- marks
    accentSoft: '#2a211a',
    ink: 'rgba(42, 33, 26, 0.4)',
    paperShade: 'rgba(251, 247, 236, 0)',    // transparent — no backdrop for cables
    purlMark: '#2a211a', // dark ink purl bump
};

let crossIdCounter = 0;

document.addEventListener('DOMContentLoaded', () => {
    initStitchPalette();
    bindStitchEvents();

    // Prevent the checkbox click from also triggering the tile's stitch selection
    document.getElementById('no-stitch-select-mode').addEventListener('click', (e) => {
        e.stopPropagation();
    });
});

// ========================================
// STITCH PALETTE
// ========================================
function initStitchPalette() {
    document.querySelectorAll('.stitch-tile').forEach(tile => {
        const stitch = tile.dataset.stitch;
        const canvas = tile.querySelector('.stitch-tile-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = STITCH_COLORS.bg;
        ctx.fillRect(0, 0, 40, 40);
        switch (stitch) {
            case 'knit': drawKnitIcon(ctx, 0, 0, 40); break;
            case 'purl': drawPurlIcon(ctx, 0, 0, 40); break;
            case 'left-cross': drawCrossIcon(ctx, 40, 'left'); break;
            case 'right-cross': drawCrossIcon(ctx, 40, 'right'); break;
            case 'k-right': drawKLeanIcon(ctx, 0, 0, 40, 'right'); break;
            case 'k-left': drawKLeanIcon(ctx, 0, 0, 40, 'left'); break;
            case 'm1r': drawM1Icon(ctx, 0, 0, 40, 'right'); break;
            case 'm1l': drawM1Icon(ctx, 0, 0, 40, 'left'); break;
            case 'hole': drawHoleIcon(ctx, 0, 0, 40); break;
            case 'no-stitch': drawNoStitchIcon(ctx, 0, 0, 40); break;
        }
    });
}

function drawKnitIcon(ctx, x, y, s) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = STITCH_COLORS.yarn;
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(x + s*0.15, y + s*0.15);
    ctx.lineTo(x + s*0.5, y + s*0.7);
    ctx.lineTo(x + s*0.85, y + s*0.15);
    ctx.stroke();
    ctx.strokeStyle = STITCH_COLORS.yarnDark;
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(x + s*0.35, y + s*0.88);
    ctx.lineTo(x + s*0.65, y + s*0.88);
    ctx.stroke();
}

function drawPurlIcon(ctx, x, y, s) {
    // No backdrop — just a dark ink bump on the default cream
    ctx.strokeStyle = STITCH_COLORS.purlMark;
    ctx.lineWidth = s * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + s*0.2, y + s*0.5);
    ctx.lineTo(x + s*0.8, y + s*0.5);
    ctx.stroke();
}

function drawCrossIcon(ctx, s, dir) {
    const lw = s * 0.14;
    ctx.lineCap = 'round';
    // Left cross: front strand goes top-left → bottom-right (reads as bottom-right → top-left = left lean)
    // Right cross: front strand goes top-right → bottom-left (reads as bottom-left → top-right = right lean)
    const frontFrom = dir === 'left' ? 0.25 : 0.75;
    const frontTo = dir === 'left' ? 0.75 : 0.25;
    const backFrom = dir === 'left' ? 0.75 : 0.25;
    const backTo = dir === 'left' ? 0.25 : 0.75;

    // Back strand (dim)
    ctx.strokeStyle = STITCH_COLORS.yarnBack;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(s * backFrom, 0);
    ctx.bezierCurveTo(s * backFrom, s*0.6, s * backTo, s*0.4, s * backTo, s);
    ctx.stroke();
    // Gap
    ctx.strokeStyle = STITCH_COLORS.bg;
    ctx.lineWidth = lw + 4;
    ctx.beginPath();
    ctx.moveTo(s * frontFrom, 0);
    ctx.bezierCurveTo(s * frontFrom, s*0.6, s * frontTo, s*0.4, s * frontTo, s);
    ctx.stroke();
    // Front strand (bright)
    ctx.strokeStyle = STITCH_COLORS.yarnFront;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(s * frontFrom, 0);
    ctx.bezierCurveTo(s * frontFrom, s*0.6, s * frontTo, s*0.4, s * frontTo, s);
    ctx.stroke();
}

function drawM1Icon(ctx, x, y, s, dir) {
    ctx.lineCap = 'round';
    if (dir === 'right') {
        // /+ : slash on left, plus on right
        ctx.strokeStyle = STITCH_COLORS.yarn;
        ctx.lineWidth = s * 0.14;
        ctx.beginPath();
        ctx.moveTo(x + s*0.15, y + s*0.7);
        ctx.lineTo(x + s*0.55, y + s*0.2);
        ctx.stroke();
        ctx.strokeStyle = STITCH_COLORS.yarnFront;
        ctx.lineWidth = s * 0.1;
        ctx.beginPath();
        ctx.moveTo(x + s*0.6, y + s*0.7);
        ctx.lineTo(x + s*0.9, y + s*0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + s*0.75, y + s*0.57);
        ctx.lineTo(x + s*0.75, y + s*0.83);
        ctx.stroke();
    } else {
        // +\ : plus on left, slash on right
        ctx.strokeStyle = STITCH_COLORS.yarnFront;
        ctx.lineWidth = s * 0.1;
        ctx.beginPath();
        ctx.moveTo(x + s*0.1, y + s*0.7);
        ctx.lineTo(x + s*0.4, y + s*0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + s*0.25, y + s*0.57);
        ctx.lineTo(x + s*0.25, y + s*0.83);
        ctx.stroke();
        ctx.strokeStyle = STITCH_COLORS.yarn;
        ctx.lineWidth = s * 0.14;
        ctx.beginPath();
        ctx.moveTo(x + s*0.45, y + s*0.2);
        ctx.lineTo(x + s*0.85, y + s*0.7);
        ctx.stroke();
    }
}

function drawHoleIcon(ctx, x, y, s) {
    // Cream filled circle with black outline
    ctx.fillStyle = '#ede3cc'; // the old purlBg cream
    ctx.beginPath();
    ctx.arc(x + s*0.5, y + s*0.5, s*0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = STITCH_COLORS.yarn;
    ctx.lineWidth = s * 0.1;
    ctx.stroke();
}

function drawKLeanIcon(ctx, x, y, s, dir) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = STITCH_COLORS.yarn;
    ctx.lineWidth = s * 0.14;
    if (dir === 'right') {
        // /- : slash on left, minus on right
        ctx.beginPath();
        ctx.moveTo(x + s*0.15, y + s*0.7);
        ctx.lineTo(x + s*0.55, y + s*0.2);
        ctx.stroke();
        ctx.strokeStyle = STITCH_COLORS.yarnFront;
        ctx.lineWidth = s * 0.1;
        ctx.beginPath();
        ctx.moveTo(x + s*0.6, y + s*0.75);
        ctx.lineTo(x + s*0.9, y + s*0.75);
        ctx.stroke();
    } else {
        // -\ : minus on left, slash on right
        ctx.strokeStyle = STITCH_COLORS.yarnFront;
        ctx.lineWidth = s * 0.1;
        ctx.beginPath();
        ctx.moveTo(x + s*0.1, y + s*0.75);
        ctx.lineTo(x + s*0.4, y + s*0.75);
        ctx.stroke();
        ctx.strokeStyle = STITCH_COLORS.yarn;
        ctx.lineWidth = s * 0.14;
        ctx.beginPath();
        ctx.moveTo(x + s*0.45, y + s*0.2);
        ctx.lineTo(x + s*0.85, y + s*0.7);
        ctx.stroke();
    }
}

function drawNoStitchIcon(ctx, x, y, s) {
    // Muted paper patch — inset to match the stroke extent of the other icons
    // so the tile's framed-chip border reads consistently around every icon.
    const pad = s * 0.15;
    ctx.fillStyle = '#c9bca0';
    ctx.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
    ctx.strokeStyle = '#5a4c3e';
    ctx.lineWidth = s * 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + s*0.3, y + s*0.3);
    ctx.lineTo(x + s*0.7, y + s*0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s*0.7, y + s*0.3);
    ctx.lineTo(x + s*0.3, y + s*0.7);
    ctx.stroke();
}

// ========================================
// EVENTS
// ========================================
function bindStitchEvents() {
    document.querySelectorAll('.stitch-tile').forEach(tile => {
        tile.addEventListener('click', () => selectStitch(tile.dataset.stitch));
    });

    const container = document.getElementById('grid-container');

    container.addEventListener('mousedown', (e) => {
        if (state.activeTool !== 'stitch') return;
        const hit = GridView.cellAt(e.clientX, e.clientY);
        if (!hit) return;
        const r = hit.r, c = hit.c;

        if (['knit', 'purl', 'k-right', 'k-left', 'm1r', 'm1l', 'hole', 'no-stitch', 'stitch-erase'].includes(state.activeStitch)) {
            e.preventDefault();
            e.stopPropagation();
            applySimpleStitch(r, c);
            state.isPainting = true;
            return;
        }

        if (isCrossStitch(state.activeStitch)) {
            e.preventDefault();
            e.stopPropagation();
            state.cableDragStart = { row: r, col: c };
            state.cableDragEnd = { row: r, col: c };
            renderCableGhost();
        }
    }, true);

    container.addEventListener('mousemove', (e) => {
        if (state.activeTool !== 'stitch') return;
        const hit = GridView.cellAt(e.clientX, e.clientY);
        if (!hit) return;
        const r = hit.r, c = hit.c;

        if (['knit', 'purl', 'k-right', 'k-left', 'm1r', 'm1l', 'hole', 'no-stitch', 'stitch-erase'].includes(state.activeStitch) && state.isPainting) {
            applySimpleStitch(r, c);
            return;
        }

        if (state.cableDragStart && isCrossStitch(state.activeStitch)) {
            const maxW = 8;
            let endCol = c;
            const startCol = state.cableDragStart.col;
            const width = Math.abs(endCol - startCol) + 1;
            if (width > maxW) {
                endCol = startCol + (endCol > startCol ? maxW - 1 : -(maxW - 1));
            }
            state.cableDragEnd = { row: state.cableDragStart.row, col: endCol };
            renderCableGhost();
        }
    }, true);

    document.addEventListener('mouseup', () => {
        if (state.activeTool === 'stitch' && state.isPainting) {
            state.isPainting = false;
            pushHistory();
            return;
        }
        if (state.cableDragStart && isCrossStitch(state.activeStitch)) {
            commitCross();
            return;
        }
    });
}

function selectStitch(stitch) {
    // No-stitch: if checkbox is NOT ticked, fill all BG cells immediately
    if (stitch === 'no-stitch' && !document.getElementById('no-stitch-select-mode').checked) {
        for (let r = 0; r < state.rows; r++) {
            if (!state.stitchGrid[r]) continue;
            for (let c = 0; c < state.cols; c++) {
                const hasColor = !!state.grid[r][c];
                const hasStitch = !!state.stitchGrid[r][c];
                if (!hasColor && !hasStitch) {
                    state.stitchGrid[r][c] = 'no-stitch';
                }
            }
        }
        renderGrid();
        pushHistory();
        showToast('Empty cells filled with No Stitch');
        return;
    }

    state.activeStitch = stitch;
    state.activeTool = 'stitch';
    document.querySelectorAll('.stitch-tile').forEach(t => {
        t.classList.toggle('active', t.dataset.stitch === stitch);
    });
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
}

function isCrossStitch(stitch) {
    return stitch === 'left-cross' || stitch === 'right-cross';
}

// ========================================
// SIMPLE STITCH PLACEMENT
// ========================================
function applySimpleStitch(r, c) {
    if (!state.stitchGrid[r]) return;

    if (state.activeStitch === 'stitch-erase') {
        // If clicking on a crossing, erase the whole group
        const existing = state.stitchGrid[r][c];
        if (existing && typeof existing === 'object' && existing.id) {
            const id = existing.id;
            for (let cc = 0; cc < state.cols; cc++) {
                const s = state.stitchGrid[r][cc];
                if (s && typeof s === 'object' && s.id === id) {
                    state.stitchGrid[r][cc] = null;
                }
            }
        } else {
            state.stitchGrid[r][c] = null;
        }
    } else if (state.activeStitch === 'knit') {
        state.stitchGrid[r][c] = 'knit';
    } else if (state.activeStitch === 'purl') {
        state.stitchGrid[r][c] = 'purl';
    } else if (state.activeStitch === 'k-right') {
        state.stitchGrid[r][c] = 'k-right';
    } else if (state.activeStitch === 'k-left') {
        state.stitchGrid[r][c] = 'k-left';
    } else if (state.activeStitch === 'm1r') {
        state.stitchGrid[r][c] = 'm1r';
    } else if (state.activeStitch === 'm1l') {
        state.stitchGrid[r][c] = 'm1l';
    } else if (state.activeStitch === 'hole') {
        state.stitchGrid[r][c] = 'hole';
    } else if (state.activeStitch === 'no-stitch') {
        state.stitchGrid[r][c] = 'no-stitch';
    }
    renderStitchOverlay();
}

// ========================================
// CLUSTER DETECTION
// ========================================
// Scans a row of stitch types and groups into contiguous clusters
function detectClusters(stitchRow, minC, maxC) {
    const clusters = [];
    let current = null;
    let count = 0;
    let startC = minC;

    for (let c = minC; c <= maxC; c++) {
        const st = stitchRow[c];
        // Normalize: null or 'knit' → 'knit', 'purl' → 'purl', objects → 'knit' (treat crossings as knit)
        const type = (st === 'purl') ? 'purl' : 'knit';

        if (type === current) {
            count++;
        } else {
            if (current !== null) {
                clusters.push({ st: current, count, startCol: startC });
            }
            current = type;
            count = 1;
            startC = c;
        }
    }
    if (current !== null) {
        clusters.push({ st: current, count, startCol: startC });
    }
    return clusters;
}

// Compute the expected stitch arrangement after a cross
function computeCrossResult(clusters, dir) {
    if (clusters.length === 1) {
        // All same type: result is identical (same stitches, just crossed)
        return Array(clusters[0].count).fill(clusters[0].st);
    }

    if (clusters.length === 2) {
        // Two clusters: swap them
        const [a, b] = clusters;
        const aStitches = Array(a.count).fill(a.st);
        const bStitches = Array(b.count).fill(b.st);
        // Left cross: right cluster comes first (moves left)
        // Right cross: left cluster comes first (moves right)
        if (dir === 'left') return [...bStitches, ...aStitches];
        else return [...bStitches, ...aStitches]; // same swap, different visual front/back
    }

    if (clusters.length === 3) {
        // Three clusters: outer two swap, center stays
        const [a, center, b] = clusters;
        const aStitches = Array(a.count).fill(a.st);
        const centerStitches = Array(center.count).fill(center.st);
        const bStitches = Array(b.count).fill(b.st);
        return [...bStitches, ...centerStitches, ...aStitches];
    }

    // 4+ clusters: just reverse the whole thing as a simple swap
    const result = [];
    for (const c of [...clusters].reverse()) {
        for (let i = 0; i < c.count; i++) result.push(c.st);
    }
    return result;
}

// ========================================
// CROSSING PLACEMENT
// ========================================
function renderCableGhost() {
    if (!state.cableDragStart || !state.cableDragEnd) {
        GridView.clearCableGhost();
        return;
    }
    const row = state.cableDragStart.row;
    const minC = Math.min(state.cableDragStart.col, state.cableDragEnd.col);
    const maxC = Math.max(state.cableDragStart.col, state.cableDragEnd.col);
    if (maxC - minC + 1 < 2) {
        GridView.clearCableGhost();
        return;
    }
    GridView.setCableGhost(row, minC, maxC);
}

function commitCross() {
    if (!state.cableDragStart || !state.cableDragEnd) {
        clearCableDrag();
        return;
    }

    const row = state.cableDragStart.row;
    const minC = Math.min(state.cableDragStart.col, state.cableDragEnd.col);
    const maxC = Math.max(state.cableDragStart.col, state.cableDragEnd.col);
    const width = maxC - minC + 1;

    if (width < 2) {
        clearCableDrag();
        return;
    }

    const dir = state.activeStitch === 'left-cross' ? 'left' : 'right';

    // Read context: check row below first, then above
    let refRow = null;
    let refSource = '';
    if (row + 1 < state.rows && state.stitchGrid[row + 1]) {
        const hasData = state.stitchGrid[row + 1].slice(minC, maxC + 1).some(s => s !== null);
        if (hasData) { refRow = row + 1; refSource = 'below'; }
    }
    if (refRow === null && row - 1 >= 0 && state.stitchGrid[row - 1]) {
        const hasData = state.stitchGrid[row - 1].slice(minC, maxC + 1).some(s => s !== null);
        if (hasData) { refRow = row - 1; refSource = 'above'; }
    }

    if (refRow === null) {
        showToast('Fill in K/P stitches on the row above or below first');
        clearCableDrag();
        return;
    }

    // Detect clusters from the reference row
    const clusters = detectClusters(state.stitchGrid[refRow], minC, maxC);

    // Compute expected result
    const expectedResult = computeCrossResult(clusters, dir);

    // Store the crossing
    const id = 'x' + (++crossIdCounter);
    for (let c = minC; c <= maxC; c++) {
        if (!state.stitchGrid[row]) continue;
        state.stitchGrid[row][c] = {
            type: 'cross',
            dir: dir,
            width: width,
            pos: c - minC,
            id: id,
            clusters: clusters,
        };
    }

    // Auto-populate the other side of the crossing with the expected result
    const otherRow = (refSource === 'below') ? row - 1 : row + 1;
    if (otherRow >= 0 && otherRow < state.rows && state.stitchGrid[otherRow]) {
        const otherHasData = state.stitchGrid[otherRow].slice(minC, maxC + 1).some(s => s !== null);
        if (otherHasData) {
            // Row already has data — check if it matches expected
            const actual = [];
            for (let c = minC; c <= maxC; c++) {
                const s = state.stitchGrid[otherRow][c];
                actual.push(s === 'purl' ? 'purl' : 'knit');
            }
            const matches = expectedResult.every((st, i) => st === actual[i]);
            if (!matches) {
                const expectedStr = expectedResult.map(s => s === 'knit' ? 'K' : 'P').join('');
                const actualStr = actual.map(s => s === 'knit' ? 'K' : 'P').join('');
                showToast(`Row ${refSource === 'below' ? 'above' : 'below'} is ${actualStr}, expected ${expectedStr}. Intentional?`);
            }
        } else {
            // Row is empty — auto-populate with expected result
            for (let i = 0; i < expectedResult.length; i++) {
                state.stitchGrid[otherRow][minC + i] = expectedResult[i]; // 'knit' or 'purl'
            }
        }
    }

    clearCableDrag();
    renderStitchOverlay();
    pushHistory();
}

function clearCableDrag() {
    state.cableDragStart = null;
    state.cableDragEnd = null;
    GridView.clearCableGhost();
}

// ========================================
// STITCH OVERLAY RENDERING
// ========================================
function renderStitchOverlay() {
    const canvas = document.getElementById('stitch-overlay');
    if (!canvas) return;
    const container = document.getElementById('grid-container');
    if (!container) return;

    // Pull dimensions from GridView instead of reading DOM cells (there
    // are none anymore — the grid is canvas-backed).
    const cellSize = GridView.getCellSize();
    const gap = GridView.getGap();
    const gridW = container.clientWidth;
    const gridH = container.clientHeight;
    if (!gridW || !gridH) return;

    const balanceMargin = 24; // extra space for row balance indicators
    canvas.width = gridW + balanceMargin;
    canvas.height = gridH;
    canvas.style.width = (gridW + balanceMargin) + 'px';
    canvas.style.height = gridH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cellW = cellSize;
    const cellH = cellSize;
    const stepX = cellW + gap;
    const stepY = cellH + gap;

    const drawnCrossings = new Set();

    for (let r = 0; r < state.rows; r++) {
        if (!state.stitchGrid[r]) continue;
        for (let c = 0; c < state.cols; c++) {
            const stitch = state.stitchGrid[r][c];
            if (!stitch) continue;

            const x = c * stepX;
            const y = r * stepY;

            if (stitch === 'knit') {
                drawKnitOverlay(ctx, x, y, cellW, cellH);
            } else if (stitch === 'purl') {
                drawPurlOverlay(ctx, x, y, cellW, cellH);
            } else if (stitch === 'k-right') {
                drawKLeanOverlay(ctx, x, y, cellW, cellH, 'right');
            } else if (stitch === 'k-left') {
                drawKLeanOverlay(ctx, x, y, cellW, cellH, 'left');
            } else if (stitch === 'm1r') {
                drawM1Overlay(ctx, x, y, cellW, cellH, 'right');
            } else if (stitch === 'm1l') {
                drawM1Overlay(ctx, x, y, cellW, cellH, 'left');
            } else if (stitch === 'hole') {
                drawHoleOverlay(ctx, x, y, cellW, cellH);
            } else if (stitch === 'no-stitch') {
                drawNoStitchOverlay(ctx, x, y, cellW, cellH);
            } else if (typeof stitch === 'object' && !drawnCrossings.has(stitch.id)) {
                drawnCrossings.add(stitch.id);
                const startX = (c - stitch.pos) * stepX;
                drawCrossingOverlay(ctx, startX, y, cellW, cellH, stitch, gap);
            }
        }
    }

    // Draw row balance indicators
    drawRowBalanceIndicators(ctx, stepX, stepY, cellW, cellH);
}

function drawRowBalanceIndicators(ctx, stepX, stepY, cellW, cellH) {
    for (let r = 0; r < state.rows; r++) {
        if (!state.stitchGrid[r]) continue;

        let holes = 0;
        for (let c = 0; c < state.cols; c++) {
            if (state.stitchGrid[r][c] === 'hole') holes++;
        }

        if (holes === 0) continue;

        // Show hole count as a small indicator
        const y = r * stepY + cellH / 2;
        const x = state.cols * stepX + 4;

        ctx.font = `bold ${Math.min(12, cellH * 0.5)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = STITCH_COLORS.accent;
        ctx.fillText(`${holes}\u25CB`, x, y); // e.g. "2○"
    }
}

function drawKnitOverlay(ctx, x, y, w, h) {
    const lw = Math.max(1.5, w * 0.14);
    ctx.lineCap = 'round';
    ctx.strokeStyle = STITCH_COLORS.yarn;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x + w*0.15, y + h*0.15);
    ctx.lineTo(x + w*0.5, y + h*0.7);
    ctx.lineTo(x + w*0.85, y + h*0.15);
    ctx.stroke();
    ctx.strokeStyle = STITCH_COLORS.yarnDark;
    ctx.lineWidth = lw * 0.7;
    ctx.beginPath();
    ctx.moveTo(x + w*0.35, y + h*0.88);
    ctx.lineTo(x + w*0.65, y + h*0.88);
    ctx.stroke();
}

function drawPurlOverlay(ctx, x, y, w, h) {
    // No backdrop — just a dark ink bump
    ctx.strokeStyle = STITCH_COLORS.purlMark;
    ctx.lineWidth = Math.max(2, w * 0.13);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w*0.2, y + h*0.5);
    ctx.lineTo(x + w*0.8, y + h*0.5);
    ctx.stroke();
}

function drawNoStitchOverlay(ctx, x, y, w, h) {
    // Muted paper fill with a soft X
    ctx.fillStyle = 'rgba(201, 188, 160, 0.7)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(90, 76, 62, 0.5)';
    ctx.lineWidth = Math.max(1, w * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w*0.25, y + h*0.25);
    ctx.lineTo(x + w*0.75, y + h*0.75);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w*0.75, y + h*0.25);
    ctx.lineTo(x + w*0.25, y + h*0.75);
    ctx.stroke();
}

function drawKLeanOverlay(ctx, x, y, w, h, dir) {
    const lw = Math.max(1.5, w * 0.12);
    ctx.lineCap = 'round';
    if (dir === 'right') {
        // /-
        ctx.strokeStyle = STITCH_COLORS.yarn;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x + w*0.1, y + h*0.75);
        ctx.lineTo(x + w*0.5, y + h*0.2);
        ctx.stroke();
        ctx.strokeStyle = STITCH_COLORS.accent;
        ctx.lineWidth = Math.max(1, w * 0.08);
        ctx.beginPath();
        ctx.moveTo(x + w*0.58, y + h*0.8);
        ctx.lineTo(x + w*0.88, y + h*0.8);
        ctx.stroke();
    } else {
        // -backslash
        ctx.strokeStyle = STITCH_COLORS.accent;
        ctx.lineWidth = Math.max(1, w * 0.08);
        ctx.beginPath();
        ctx.moveTo(x + w*0.12, y + h*0.8);
        ctx.lineTo(x + w*0.42, y + h*0.8);
        ctx.stroke();
        ctx.strokeStyle = STITCH_COLORS.yarn;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x + w*0.5, y + h*0.2);
        ctx.lineTo(x + w*0.9, y + h*0.75);
        ctx.stroke();
    }
}

function drawM1Overlay(ctx, x, y, w, h, dir) {
    const lw = Math.max(1.5, w * 0.12);
    ctx.lineCap = 'round';
    if (dir === 'right') {
        // /+
        ctx.strokeStyle = STITCH_COLORS.yarn;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x + w*0.1, y + h*0.75);
        ctx.lineTo(x + w*0.5, y + h*0.2);
        ctx.stroke();
        ctx.strokeStyle = STITCH_COLORS.accent;
        ctx.lineWidth = Math.max(1, w * 0.08);
        ctx.beginPath();
        ctx.moveTo(x + w*0.58, y + h*0.75);
        ctx.lineTo(x + w*0.88, y + h*0.75);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + w*0.73, y + h*0.62);
        ctx.lineTo(x + w*0.73, y + h*0.88);
        ctx.stroke();
    } else {
        // +backslash
        ctx.strokeStyle = STITCH_COLORS.accent;
        ctx.lineWidth = Math.max(1, w * 0.08);
        ctx.beginPath();
        ctx.moveTo(x + w*0.12, y + h*0.75);
        ctx.lineTo(x + w*0.42, y + h*0.75);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + w*0.27, y + h*0.62);
        ctx.lineTo(x + w*0.27, y + h*0.88);
        ctx.stroke();
        ctx.strokeStyle = STITCH_COLORS.yarn;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x + w*0.5, y + h*0.2);
        ctx.lineTo(x + w*0.9, y + h*0.75);
        ctx.stroke();
    }
}

function drawHoleOverlay(ctx, x, y, w, h) {
    // Cream-filled circle with black outline
    ctx.fillStyle = '#ede3cc';
    ctx.beginPath();
    ctx.arc(x + w*0.5, y + h*0.5, Math.min(w, h) * 0.35, 0, Math.PI * 2);
    ctx.fill();
    // Subtle ring
    ctx.strokeStyle = STITCH_COLORS.accentSoft;
    ctx.lineWidth = Math.max(1.5, w * 0.09);
    ctx.beginPath();
    ctx.arc(x + w*0.5, y + h*0.5, Math.min(w, h) * 0.35, 0, Math.PI * 2);
    ctx.stroke();
}

// ========================================
// UNIFIED CROSSING RENDERER
// ========================================
// Reads cluster data from the stitch object to determine
// which strands are K (bright) and which are P (dim),
// and how they rearrange.
function drawCrossingOverlay(ctx, ox, oy, cellW, cellH, stitch, gap) {
    const { width, dir, clusters } = stitch;
    const totalW = width * cellW + (width - 1) * gap;
    ctx.fillStyle = STITCH_COLORS.paperShade;
    ctx.fillRect(ox, oy, totalW, cellH);

    const stepX = cellW + gap;
    const lw = Math.max(2, cellW * 0.16);
    ctx.lineCap = 'round';

    if (!clusters || clusters.length === 0) return;

    // Build per-stitch source type and destination map
    const stitchTypes = []; // 'knit' or 'purl' for each position
    clusters.forEach(cl => {
        for (let i = 0; i < cl.count; i++) stitchTypes.push(cl.st);
    });

    // Build destination map based on cluster structure
    const destMap = new Array(width);
    const frontMap = new Array(width); // true = this strand is in front

    // RULES (reading L to R on grid):
    // Right X: left group moves RIGHT (is front/bright), right group moves left (back/dim)
    // Left X: right group moves LEFT (is front/bright), left group moves right (back/dim)
    // The front strand is always the group that's physically travelling.

    if (clusters.length === 1) {
        // All same type: split in half
        const half = Math.floor(width / 2);
        const isOdd = width % 2 === 1;
        const centerIdx = isOdd ? half : -1;

        for (let i = 0; i < width; i++) {
            if (isOdd && i === centerIdx) {
                destMap[i] = i; // center stays
                frontMap[i] = false;
            } else if (i < half) {
                // Left half moves to right side
                destMap[i] = isOdd ? i + half + 1 : i + half;
                frontMap[i] = (dir === 'right'); // Right X: left group is front
            } else {
                // Right half moves to left side
                const rightStart = isOdd ? half + 1 : half;
                destMap[i] = i - rightStart;
                frontMap[i] = (dir === 'left'); // Left X: right group is front
            }
        }
    } else if (clusters.length === 2) {
        // Two clusters: swap them as groups
        const leftSize = clusters[0].count;

        for (let i = 0; i < width; i++) {
            if (i < leftSize) {
                destMap[i] = i + (width - leftSize); // left group → right side
                frontMap[i] = (dir === 'right'); // Right X: left group is front
            } else {
                destMap[i] = i - leftSize; // right group → left side
                frontMap[i] = (dir === 'left'); // Left X: right group is front
            }
        }
    } else if (clusters.length === 3) {
        // Three clusters (symmetric): outer two swap, center stays
        const leftSize = clusters[0].count;
        const centerSize = clusters[1].count;
        const rightSize = clusters[2].count;

        let pos = 0;
        // Left group moves to right side
        for (let i = 0; i < leftSize; i++) {
            destMap[pos] = leftSize + centerSize + i;
            frontMap[pos] = (dir === 'right'); // Right X: left group is front
            pos++;
        }
        // Center group stays
        for (let i = 0; i < centerSize; i++) {
            destMap[pos] = leftSize + i;
            frontMap[pos] = false;
            pos++;
        }
        // Right group moves to left side
        for (let i = 0; i < rightSize; i++) {
            destMap[pos] = i;
            frontMap[pos] = (dir === 'left'); // Left X: right group is front
            pos++;
        }
    } else {
        // Fallback: reverse
        for (let i = 0; i < width; i++) {
            destMap[i] = width - 1 - i;
            frontMap[i] = (i < Math.floor(width / 2)) ? (dir === 'right') : (dir === 'left');
        }
    }

    // Draw in 3 passes: back strands, gap, front strands
    // Bezier goes from DESTINATION (top) to SOURCE (bottom)
    // so that reading bottom-up, the strand goes from source → destination
    // matching the knitting chart convention.

    // Pass 1: back strands (always dim)
    for (let i = 0; i < width; i++) {
        if (frontMap[i]) continue;
        if (destMap[i] === i) continue;
        const topX = ox + (destMap[i] + 0.5) * stepX - gap * 0.5;  // destination at top
        const botX = ox + (i + 0.5) * stepX - gap * 0.5;            // source at bottom
        ctx.strokeStyle = STITCH_COLORS.yarnBack;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(topX, oy);
        ctx.bezierCurveTo(topX, oy + cellH * 0.4, botX, oy + cellH * 0.6, botX, oy + cellH);
        ctx.stroke();
    }

    // Pass 2: gap for front strands
    for (let i = 0; i < width; i++) {
        if (!frontMap[i]) continue;
        const topX = ox + (destMap[i] + 0.5) * stepX - gap * 0.5;
        const botX = ox + (i + 0.5) * stepX - gap * 0.5;
        ctx.strokeStyle = STITCH_COLORS.bg;
        ctx.lineWidth = lw + 4;
        ctx.beginPath();
        ctx.moveTo(topX, oy);
        ctx.bezierCurveTo(topX, oy + cellH * 0.4, botX, oy + cellH * 0.6, botX, oy + cellH);
        ctx.stroke();
    }

    // Pass 3: front strands (always bright)
    for (let i = 0; i < width; i++) {
        if (!frontMap[i]) continue;
        const topX = ox + (destMap[i] + 0.5) * stepX - gap * 0.5;
        const botX = ox + (i + 0.5) * stepX - gap * 0.5;
        ctx.strokeStyle = STITCH_COLORS.yarnFront;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(topX, oy);
        ctx.bezierCurveTo(topX, oy + cellH * 0.4, botX, oy + cellH * 0.6, botX, oy + cellH);
        ctx.stroke();
    }

    // Draw center stitches that don't move (3-cluster case)
    for (let i = 0; i < width; i++) {
        if (destMap[i] !== i) continue;
        if (frontMap[i]) continue;
        const cx = ox + (i + 0.5) * stepX - gap * 0.5;
        if (stitchTypes[i] === 'purl') {
            ctx.strokeStyle = STITCH_COLORS.accent;
            ctx.lineWidth = lw * 0.8;
            ctx.beginPath();
            ctx.moveTo(cx - cellW * 0.15, oy + cellH * 0.5);
            ctx.lineTo(cx + cellW * 0.15, oy + cellH * 0.5);
            ctx.stroke();
        } else {
            // Center knit stitch
            ctx.strokeStyle = STITCH_COLORS.yarn;
            ctx.lineWidth = lw * 0.8;
            ctx.beginPath();
            ctx.moveTo(cx, oy + cellH * 0.15);
            ctx.lineTo(cx, oy + cellH * 0.85);
            ctx.stroke();
        }
    }
}

// When other tools are selected, deselect stitch palette
const origSetTool = setTool;
setTool = function(tool) {
    origSetTool(tool);
    if (tool !== 'stitch') {
        state.activeStitch = null;
        document.querySelectorAll('.stitch-tile').forEach(t => t.classList.remove('active'));
    }
};
