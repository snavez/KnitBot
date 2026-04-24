// === Add Stitch Type editor ===
// Modal with a 0..100-coordinate drawing surface + code/instructions form.
// Shapes are stored as JSON (see drawUserStitchShapes in js/stitches.js);
// on save the record persists to IndexedDB and becomes a live registry entry.

const editorState = {
    open: false,
    tool: 'freehand',
    stroke: '#2a211a',
    strokeWidth: 6,
    shapes: [],
    // Drag-in-progress state (not committed until pointerup)
    drawing: null,
    canvas: null,
    ctx: null,
    // Suppress the auto-fill when the user has explicitly edited the textarea
    detailedTouched: false,
};

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-add-stitch');
    if (!btn) return;

    btn.addEventListener('click', openStitchEditor);
    document.getElementById('stitch-editor-close').addEventListener('click', closeStitchEditor);
    document.getElementById('stitch-editor-cancel').addEventListener('click', closeStitchEditor);
    document.getElementById('stitch-editor-save').addEventListener('click', saveStitch);
    document.getElementById('st-undo').addEventListener('click', undoLastShape);
    document.getElementById('st-clear').addEventListener('click', clearCanvas);

    document.querySelectorAll('#stitch-editor-modal .st-tool-btn').forEach(b => {
        b.addEventListener('click', () => selectTool(b.dataset.tool));
    });

    document.getElementById('st-stroke-width').addEventListener('input', (e) => {
        editorState.strokeWidth = Number(e.target.value);
    });

    const codeInput = document.getElementById('st-code');
    codeInput.addEventListener('input', onCodeInput);
    codeInput.addEventListener('change', onCodeInput);

    document.getElementById('st-detailed').addEventListener('input', () => {
        editorState.detailedTouched = true;
    });

    // Close on backdrop click
    document.getElementById('stitch-editor-modal').addEventListener('click', (e) => {
        if (e.target.id === 'stitch-editor-modal') closeStitchEditor();
    });
    // Esc closes when the editor is on top
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && editorState.open) closeStitchEditor();
    });

    renderColorSwatches();
});

function openStitchEditor() {
    resetEditor();
    const modal = document.getElementById('stitch-editor-modal');
    modal.classList.add('open');
    modal.style.display = 'flex';
    editorState.open = true;
    // Wire the canvas once the modal is laid out
    setupCanvas();
    setTimeout(() => document.getElementById('st-code').focus(), 50);
}

function closeStitchEditor() {
    const modal = document.getElementById('stitch-editor-modal');
    modal.classList.remove('open');
    modal.style.display = 'none';
    editorState.open = false;
}

function resetEditor() {
    editorState.tool = 'freehand';
    editorState.stroke = STITCH_DESIGN_COLORS[0].hex;
    editorState.strokeWidth = 6;
    editorState.shapes = [];
    editorState.drawing = null;
    editorState.detailedTouched = false;
    document.getElementById('st-code').value = '';
    document.getElementById('st-detailed').value = '';
    document.getElementById('st-stroke-width').value = '6';
    document.querySelectorAll('#stitch-editor-modal .st-tool-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === 'freehand');
    });
    renderColorSwatches();
    renderPreview();
}

function renderColorSwatches() {
    const host = document.getElementById('stitch-editor-colors');
    if (!host) return;
    host.innerHTML = '';
    for (const c of STITCH_DESIGN_COLORS) {
        const sw = document.createElement('button');
        sw.className = 'st-swatch' + (c.hex === editorState.stroke ? ' active' : '');
        sw.style.background = c.hex;
        sw.title = c.name;
        sw.addEventListener('click', () => {
            editorState.stroke = c.hex;
            renderColorSwatches();
        });
        host.appendChild(sw);
    }
}

function selectTool(tool) {
    editorState.tool = tool;
    document.querySelectorAll('#stitch-editor-modal .st-tool-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === tool);
    });
}

// ---------- Canvas drawing ----------

function setupCanvas() {
    const canvas = document.getElementById('stitch-editor-canvas');
    editorState.canvas = canvas;
    editorState.ctx = canvas.getContext('2d');

    if (canvas.dataset.wired === '1') {
        redrawCanvas();
        return;
    }
    canvas.dataset.wired = '1';

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    redrawCanvas();
}

// Canvas space (pixels) → 0..100 drawing space
function canvasToShape(e) {
    const rect = editorState.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

function onPointerDown(e) {
    const p = canvasToShape(e);
    const tool = editorState.tool;
    const base = { stroke: editorState.stroke, strokeWidth: editorState.strokeWidth };

    if (tool === 'text') {
        const text = prompt('Text to place at this point:');
        if (text && text.trim()) {
            editorState.shapes.push({ type: 'text', x: p.x, y: p.y, text: text.trim(), fontSize: 30, stroke: editorState.stroke });
            redrawCanvas();
            renderPreview();
        }
        return;
    }

    editorState.canvas.setPointerCapture?.(e.pointerId);

    if (tool === 'freehand') {
        editorState.drawing = { type: 'path', points: [p], ...base };
    } else if (tool === 'line') {
        editorState.drawing = { type: 'line', x1: p.x, y1: p.y, x2: p.x, y2: p.y, ...base };
    } else if (tool === 'rect') {
        editorState.drawing = { type: 'rect', _startX: p.x, _startY: p.y, x: p.x, y: p.y, w: 0, h: 0, ...base };
    } else if (tool === 'ellipse') {
        editorState.drawing = { type: 'ellipse', _startX: p.x, _startY: p.y, cx: p.x, cy: p.y, rx: 0, ry: 0, ...base };
    }
    redrawCanvas();
}

function onPointerMove(e) {
    if (!editorState.drawing) return;
    const p = canvasToShape(e);
    const d = editorState.drawing;
    if (d.type === 'path') {
        d.points.push(p);
    } else if (d.type === 'line') {
        d.x2 = p.x; d.y2 = p.y;
    } else if (d.type === 'rect') {
        d.x = Math.min(d._startX, p.x);
        d.y = Math.min(d._startY, p.y);
        d.w = Math.abs(p.x - d._startX);
        d.h = Math.abs(p.y - d._startY);
    } else if (d.type === 'ellipse') {
        d.cx = (d._startX + p.x) / 2;
        d.cy = (d._startY + p.y) / 2;
        d.rx = Math.abs(p.x - d._startX) / 2;
        d.ry = Math.abs(p.y - d._startY) / 2;
    }
    redrawCanvas();
}

function onPointerUp() {
    if (!editorState.drawing) return;
    const d = editorState.drawing;
    // Drop zero-area shapes (accidental clicks)
    let keep = true;
    if (d.type === 'path' && d.points.length < 2) keep = false;
    if (d.type === 'rect' && (d.w < 0.5 || d.h < 0.5)) keep = false;
    if (d.type === 'ellipse' && (d.rx < 0.5 || d.ry < 0.5)) keep = false;
    if (d.type === 'line' && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 0.5) keep = false;

    if (keep) {
        // Strip internal markers before committing
        delete d._startX; delete d._startY;
        editorState.shapes.push(d);
    }
    editorState.drawing = null;
    redrawCanvas();
    renderPreview();
}

function redrawCanvas() {
    const ctx = editorState.ctx;
    const canvas = editorState.canvas;
    if (!ctx || !canvas) return;
    const W = canvas.width, H = canvas.height;

    // Paper background
    ctx.fillStyle = STITCH_COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    // Faint grid (quarters) as a drawing aid — matches the tile centre/bounds
    ctx.strokeStyle = 'rgba(42, 33, 26, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo((i / 4) * W, 0);
        ctx.lineTo((i / 4) * W, H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, (i / 4) * H);
        ctx.lineTo(W, (i / 4) * H);
        ctx.stroke();
    }

    // Committed shapes + the in-progress drawing (drawn on top)
    const allShapes = editorState.shapes.slice();
    if (editorState.drawing) allShapes.push(editorState.drawing);
    drawUserStitchShapes(ctx, allShapes, 0, 0, W, H);
}

function undoLastShape() {
    editorState.shapes.pop();
    redrawCanvas();
    renderPreview();
}

function clearCanvas() {
    editorState.shapes = [];
    redrawCanvas();
    renderPreview();
}

// ---------- Tile preview ----------

function renderPreview() {
    const canvas = document.getElementById('st-preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = STITCH_COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawUserStitchShapes(ctx, editorState.shapes, 0, 0, canvas.width, canvas.height);
}

// ---------- Code + auto-fill ----------

function onCodeInput(e) {
    const code = e.target.value.trim();
    if (!code || editorState.detailedTouched) return;
    // Case-insensitive match against the library
    const match = Object.keys(STITCH_CODE_LIBRARY).find(k => k.toLowerCase() === code.toLowerCase());
    if (match) {
        document.getElementById('st-detailed').value = STITCH_CODE_LIBRARY[match];
    }
}

// ---------- Save ----------

async function saveStitch() {
    const code = document.getElementById('st-code').value.trim();
    const detailed = document.getElementById('st-detailed').value.trim();

    if (!code) {
        showToast('Give the stitch a code first (e.g. "C4B").');
        document.getElementById('st-code').focus();
        return;
    }
    if (editorState.shapes.length === 0) {
        showToast('Draw something on the canvas before saving.');
        return;
    }
    // Built-in ids are reserved. Users can override with a different id.
    const id = code;
    const existing = StitchRegistry.get(id);
    if (existing && existing.source !== 'user') {
        if (!confirm(`"${code}" is a built-in stitch. Saving will override it with your custom drawing. Continue?`)) return;
    } else if (existing && existing.source === 'user') {
        if (!confirm(`A user stitch with code "${code}" already exists. Overwrite it?`)) return;
    }

    const record = {
        id,
        label: code,
        sublabel: null,
        title: detailed ? detailed.split(/[.\n]/)[0] : `Custom stitch: ${code}`,
        code,
        detailedInstructions: detailed,
        shapes: editorState.shapes,
        source: 'user',
        order: 500 + (existing?.order ?? 0) % 500, // land after built-ins
        createdAt: Date.now(),
    };

    try {
        await saveUserStitchToDB(record);
    } catch (err) {
        console.error('Failed to save stitch', err);
        showToast('Could not save — ' + (err?.message || 'unknown error'));
        return;
    }

    StitchRegistry.upsertUserStitch(record);
    document.dispatchEvent(new CustomEvent('stitch-registry-updated'));
    closeStitchEditor();
    showToast(`"${code}" added to your stitch gallery.`);
}
