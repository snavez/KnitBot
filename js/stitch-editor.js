// === Add Stitch Type editor ===
// Modal with a 0..100-coordinate drawing surface + code/instructions form.
// Shapes are stored as JSON (see drawUserStitchShapes in js/stitches.js);
// on save the record persists to IndexedDB and becomes a live registry entry.

const editorState = {
    open: false,
    mode: 'create',         // 'create' | 'edit'  (edit replaces an existing id)
    editingId: null,         // original id when editing
    tool: 'freehand',
    stroke: '#2a211a',
    eraserActive: false,
    strokeWidth: 6,
    fillShapes: false,
    shapes: [],
    drawing: null,           // shape in progress during a pointer drag
    canvas: null,
    ctx: null,
    detailedTouched: false,
};

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-add-stitch');
    if (!btn) return;

    btn.addEventListener('click', () => openStitchEditor());
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
    document.getElementById('st-fill-toggle').addEventListener('change', (e) => {
        editorState.fillShapes = e.target.checked;
    });

    const codeInput = document.getElementById('st-code');
    codeInput.addEventListener('input', onCodeInput);

    document.getElementById('st-detailed').addEventListener('input', () => {
        editorState.detailedTouched = true;
    });

    document.getElementById('stitch-editor-modal').addEventListener('click', (e) => {
        if (e.target.id === 'stitch-editor-modal') closeStitchEditor();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && editorState.open) closeStitchEditor();
    });
});

// Open in create or edit mode. `existing` is a user-stitch registry entry.
function openStitchEditor(existing = null) {
    resetEditor();
    if (existing) {
        editorState.mode = 'edit';
        editorState.editingId = existing.id;
        editorState.shapes = JSON.parse(JSON.stringify(existing.shapes || []));
        document.getElementById('st-code').value = existing.code || existing.id;
        document.getElementById('st-detailed').value = existing.detailedInstructions || '';
        editorState.detailedTouched = !!existing.detailedInstructions;
        document.getElementById('stitch-editor-title').textContent = `Edit Stitch: ${existing.label || existing.id}`;
        document.getElementById('stitch-editor-save').textContent = 'Save changes';
    } else {
        editorState.mode = 'create';
        editorState.editingId = null;
        document.getElementById('stitch-editor-title').textContent = 'Add Stitch Type';
        document.getElementById('stitch-editor-save').textContent = 'Save stitch';
    }

    const modal = document.getElementById('stitch-editor-modal');
    modal.classList.add('open');
    modal.style.display = 'flex';
    editorState.open = true;
    setupCanvas();
    renderPreview();
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
    editorState.eraserActive = false;
    editorState.strokeWidth = 6;
    editorState.fillShapes = false;
    editorState.shapes = [];
    editorState.drawing = null;
    editorState.detailedTouched = false;

    document.getElementById('st-code').value = '';
    document.getElementById('st-detailed').value = '';
    document.getElementById('st-stroke-width').value = '6';
    document.getElementById('st-fill-toggle').checked = false;
    document.getElementById('st-text-input').value = '';
    document.getElementById('st-text-row').style.display = 'none';
    document.querySelectorAll('#stitch-editor-modal .st-tool-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === 'freehand');
    });
    renderColorSwatches();
}

function renderColorSwatches() {
    const host = document.getElementById('stitch-editor-colors');
    if (!host) return;
    host.innerHTML = '';
    for (const c of STITCH_DESIGN_COLORS) {
        const sw = document.createElement('button');
        sw.className = 'st-swatch' + (!editorState.eraserActive && c.hex === editorState.stroke ? ' active' : '');
        sw.style.background = c.hex;
        sw.title = c.name;
        sw.addEventListener('click', () => {
            editorState.stroke = c.hex;
            editorState.eraserActive = false;
            renderColorSwatches();
        });
        host.appendChild(sw);
    }
    // Eraser swatch — paints with the paper-bg colour, visually an X on paper.
    const eraser = document.createElement('button');
    eraser.className = 'st-swatch st-swatch-eraser' + (editorState.eraserActive ? ' active' : '');
    eraser.title = 'Eraser — paint with the paper colour to hide previous strokes';
    eraser.innerHTML = '<span>&#x2715;</span>';
    eraser.addEventListener('click', () => {
        editorState.eraserActive = true;
        editorState.stroke = STITCH_COLORS.bg;
        renderColorSwatches();
    });
    host.appendChild(eraser);
}

function selectTool(tool) {
    editorState.tool = tool;
    document.querySelectorAll('#stitch-editor-modal .st-tool-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === tool);
    });
    // Show the text-entry row only when the Text tool is active
    document.getElementById('st-text-row').style.display = (tool === 'text') ? 'flex' : 'none';
    if (tool === 'text') {
        setTimeout(() => document.getElementById('st-text-input').focus(), 20);
    }
}

// ---------- Canvas drawing ----------

function setupCanvas() {
    const canvas = document.getElementById('stitch-editor-canvas');
    editorState.canvas = canvas;
    editorState.ctx = canvas.getContext('2d');

    if (canvas.dataset.wired !== '1') {
        canvas.dataset.wired = '1';
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        canvas.addEventListener('pointerleave', onPointerUp);
    }
    redrawCanvas();
}

function canvasToShape(e) {
    const rect = editorState.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

function currentShapeBase() {
    const base = { stroke: editorState.stroke, strokeWidth: editorState.strokeWidth };
    if (editorState.fillShapes) base.fill = editorState.stroke;
    return base;
}

function onPointerDown(e) {
    const p = canvasToShape(e);
    const tool = editorState.tool;
    const base = currentShapeBase();

    if (tool === 'text') {
        const text = document.getElementById('st-text-input').value;
        if (!text || !text.trim()) {
            showToast('Type some text in the Text field first, then click to place it.');
            return;
        }
        const size = Number(document.getElementById('st-text-size').value) || 32;
        editorState.shapes.push({
            type: 'text', x: p.x, y: p.y, text: text.trim(),
            fontSize: size, stroke: editorState.stroke,
        });
        redrawCanvas();
        renderPreview();
        return;
    }

    editorState.canvas.setPointerCapture?.(e.pointerId);

    if (tool === 'freehand') {
        editorState.drawing = { type: 'path', points: [p], ...base };
    } else if (tool === 'line') {
        editorState.drawing = { type: 'line', x1: p.x, y1: p.y, x2: p.x, y2: p.y, ...base };
    } else if (tool === 'curve') {
        // Track the whole drag trail so we can pick a control point that
        // matches the arc the user drew. (Midpoint of the trail works well.)
        editorState.drawing = { type: 'curve', x1: p.x, y1: p.y, cx: p.x, cy: p.y, x2: p.x, y2: p.y, _trail: [p], ...base };
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
    } else if (d.type === 'curve') {
        d._trail.push(p);
        d.x2 = p.x; d.y2 = p.y;
        const mid = d._trail[Math.floor(d._trail.length / 2)];
        d.cx = mid.x; d.cy = mid.y;
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
    let keep = true;
    if (d.type === 'path' && d.points.length < 2) keep = false;
    if (d.type === 'rect' && (d.w < 0.5 || d.h < 0.5)) keep = false;
    if (d.type === 'ellipse' && (d.rx < 0.5 || d.ry < 0.5)) keep = false;
    if (d.type === 'line' && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 0.5) keep = false;
    if (d.type === 'curve' && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 0.5) keep = false;

    if (keep) {
        delete d._startX; delete d._startY; delete d._trail;
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

    ctx.fillStyle = STITCH_COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    // Faint quarter grid — helps the user centre their drawing.
    ctx.strokeStyle = 'rgba(42, 33, 26, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo((i / 4) * W, 0); ctx.lineTo((i / 4) * W, H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, (i / 4) * H); ctx.lineTo(W, (i / 4) * H);
        ctx.stroke();
    }

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

    const id = code;
    const existing = StitchRegistry.get(id);
    const isEditingSame = editorState.mode === 'edit' && editorState.editingId === id;

    if (!isEditingSame) {
        if (existing && existing.source !== 'user') {
            if (!confirm(`"${code}" is a built-in stitch. Saving will override it with your custom drawing. Continue?`)) return;
        } else if (existing && existing.source === 'user') {
            if (!confirm(`A user stitch with code "${code}" already exists. Overwrite it?`)) return;
        }
    }

    // If editing changed the code (renamed), delete the old record.
    if (editorState.mode === 'edit' && editorState.editingId && editorState.editingId !== id) {
        try {
            await deleteUserStitchFromDB(editorState.editingId);
            StitchRegistry.removeUserStitch(editorState.editingId);
        } catch (err) {
            console.warn('Old stitch record delete failed:', err);
        }
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
        order: existing?.order ?? 500,
        createdAt: existing?._record?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
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
    showToast(editorState.mode === 'edit'
        ? `"${code}" updated.`
        : `"${code}" added to your stitch gallery.`);
}

// ---------- Public delete (used by the palette context menu) ----------

async function deleteUserStitch(id) {
    const def = StitchRegistry.get(id);
    if (!def || def.source !== 'user') return;
    if (!confirm(`Delete the custom stitch "${def.label || id}"? Any cells using it will fall back to plain knit.`)) return;
    try {
        await deleteUserStitchFromDB(id);
    } catch (err) {
        showToast('Could not delete — ' + (err?.message || 'unknown error'));
        return;
    }
    StitchRegistry.removeUserStitch(id);
    // If the deleted stitch was the active selection, clear it.
    if (state.activeStitch === id) state.activeStitch = null;
    document.dispatchEvent(new CustomEvent('stitch-registry-updated'));
    // Ensure the grid re-renders in case the deleted stitch was on it.
    if (typeof renderStitchOverlay === 'function') renderStitchOverlay();
    showToast(`"${def.label || id}" deleted.`);
}
