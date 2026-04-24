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
    // Live text-overlay state (see showTextOverlay / commitLiveText)
    textOverlayOpen: false,
    textFontSize: 72,
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

    // Live text-overlay wiring
    wireTextOverlay();
    document.getElementById('st-text-commit').addEventListener('click', () => {
        commitLiveText();
        // Switch to Pen so the user can draw again immediately.
        selectTool('freehand');
    });
    document.getElementById('st-text-size').addEventListener('input', (e) => {
        editorState.textFontSize = Number(e.target.value);
        applyOverlayFontSize();
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
    editorState.textOverlayOpen = false;
    editorState.textFontSize = 72;

    document.getElementById('st-code').value = '';
    document.getElementById('st-detailed').value = '';
    document.getElementById('st-stroke-width').value = '6';
    document.getElementById('st-fill-toggle').checked = false;
    document.getElementById('st-text-size').value = '72';
    document.getElementById('st-text-row').style.display = 'none';
    hideTextOverlay({ commit: false });
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
            // When the Text tool is active, the swatch recolours the live overlay.
            if (editorState.textOverlayOpen) applyOverlayColour();
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
    // Switching AWAY from Text commits whatever the user was typing.
    if (editorState.tool === 'text' && tool !== 'text') {
        commitLiveText();
    }

    editorState.tool = tool;
    document.querySelectorAll('#stitch-editor-modal .st-tool-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === tool);
    });
    document.getElementById('st-text-row').style.display = (tool === 'text') ? 'flex' : 'none';
    if (tool === 'text') {
        showTextOverlay();
    } else {
        hideTextOverlay({ commit: false });
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

// Returns the trail point with the greatest perpendicular distance from the
// straight line (x1,y1)→(x2,y2), or null if the line has zero length.
function farthestFromLine(trail, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.0001) return null;
    let best = null;
    let bestD2 = 0;
    for (const p of trail) {
        // Perpendicular distance squared from p to the line
        const cross = (p.x - x1) * dy - (p.y - y1) * dx;
        const d2 = (cross * cross) / len2;
        if (d2 > bestD2) { bestD2 = d2; best = p; }
    }
    return best;
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

    // The Text tool uses an HTML overlay (see showTextOverlay) — no canvas paint.
    if (tool === 'text') return;

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
        // Control point = the trail point FURTHEST from the straight line A→B.
        // That makes the rendered curve peak where the user's arc peaked —
        // intuitive, and the quadratic bezier visibly tracks the drag shape.
        // (Technically we pull the control out to 2x the apex distance, since
        // a quadratic bezier only reaches halfway to its control point.)
        // For a quadratic Bezier B(0.5) = 0.25·A + 0.5·C + 0.25·B, so
        // C = 2·apex − (A+B)/2 puts the curve's midpoint at the apex.
        const apex = farthestFromLine(d._trail, d.x1, d.y1, d.x2, d.y2);
        if (apex) {
            d.cx = 2 * apex.x - (d.x1 + d.x2) / 2;
            d.cy = 2 * apex.y - (d.y1 + d.y2) / 2;
        } else {
            d.cx = (d.x1 + d.x2) / 2;
            d.cy = (d.y1 + d.y2) / 2;
        }
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

    // Keep the canvas fully transparent so the wrapper's paper+grid CSS
    // background shows through.
    ctx.clearRect(0, 0, W, H);

    const allShapes = editorState.shapes.slice();
    if (editorState.drawing) allShapes.push(editorState.drawing);

    // Split into paint strokes and eraser strokes. Eraser strokes use
    // destination-out so they cut holes in previously-painted shapes,
    // revealing the CSS paper+grid underneath — grid lines survive erasure.
    const isEraseShape = (s) => s && s.stroke === STITCH_COLORS.bg;
    const paint = allShapes.filter(s => !isEraseShape(s));
    const erase = allShapes.filter(isEraseShape);

    drawUserStitchShapes(ctx, paint, 0, 0, W, H);
    if (erase.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        drawUserStitchShapes(ctx, erase, 0, 0, W, H);
        ctx.restore();
    }

    // During a Curve drag, mark the apex with a small handle — this is where
    // the rendered curve will peak, so the user can steer the bend.
    const d = editorState.drawing;
    if (d && d.type === 'curve' && d._trail && d._trail.length > 3) {
        const apex = farthestFromLine(d._trail, d.x1, d.y1, d.x2, d.y2);
        if (apex) {
            const sx = W / 100, sy = H / 100;
            ctx.fillStyle = '#9b2f2a';
            ctx.beginPath();
            ctx.arc(apex.x * sx, apex.y * sy, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
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

// ---------- Live text overlay ----------

function wireTextOverlay() {
    const overlay = document.getElementById('st-text-overlay');
    const handle = overlay.querySelector('.st-text-overlay-handle');
    const content = document.getElementById('st-text-overlay-content');
    if (overlay.dataset.wired === '1') return;
    overlay.dataset.wired = '1';

    // Dragging: click + drag the handle to move the overlay. Position is
    // stored as percentages of the canvas-wrapper so it scales with the modal.
    let dragStart = null;
    handle.addEventListener('pointerdown', (e) => {
        const wrapper = overlay.parentElement;
        const wr = wrapper.getBoundingClientRect();
        dragStart = {
            px: e.clientX, py: e.clientY,
            // offsetLeft/Top are relative to the positioned parent (the wrapper)
            startLeft: overlay.offsetLeft, startTop: overlay.offsetTop,
            wrapperW: wr.width, wrapperH: wr.height,
        };
        handle.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    handle.addEventListener('pointermove', (e) => {
        if (!dragStart) return;
        const dx = e.clientX - dragStart.px;
        const dy = e.clientY - dragStart.py;
        const newLeft = dragStart.startLeft + dx;
        const newTop = dragStart.startTop + dy;
        overlay.style.left = (newLeft / dragStart.wrapperW * 100) + '%';
        overlay.style.top  = (newTop  / dragStart.wrapperH * 100) + '%';
    });
    handle.addEventListener('pointerup', () => { dragStart = null; });
    handle.addEventListener('pointercancel', () => { dragStart = null; });

    // Enter submits nothing special — let the user add newlines. We intercept
    // only Escape, which commits and exits the text tool.
    content.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            selectTool('freehand');
        }
    });
}

function showTextOverlay(existing = null) {
    const overlay = document.getElementById('st-text-overlay');
    const content = document.getElementById('st-text-overlay-content');
    if (!overlay) return;

    if (existing) {
        // (reserved for future "double-click to edit" support)
        content.textContent = existing.text || '';
    } else {
        content.textContent = '';
        overlay.style.left = '10%';
        overlay.style.top  = '25%';
    }
    overlay.style.display = 'flex';
    editorState.textOverlayOpen = true;
    applyOverlayFontSize();
    applyOverlayColour();
    // Focus & place caret inside the contenteditable
    setTimeout(() => {
        content.focus();
        // Position caret at end
        const range = document.createRange();
        range.selectNodeContents(content);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }, 20);
}

function hideTextOverlay({ commit }) {
    const overlay = document.getElementById('st-text-overlay');
    if (!overlay) return;
    if (commit && editorState.textOverlayOpen) commitLiveText();
    overlay.style.display = 'none';
    editorState.textOverlayOpen = false;
}

function applyOverlayFontSize() {
    const content = document.getElementById('st-text-overlay-content');
    if (content) content.style.fontSize = editorState.textFontSize + 'px';
}

function applyOverlayColour() {
    const content = document.getElementById('st-text-overlay-content');
    if (content) content.style.color = editorState.eraserActive ? STITCH_COLORS.bg : editorState.stroke;
}

// Capture the live overlay (text, position, size, colour) as a text shape and
// hide the overlay. Idempotent — safe to call multiple times.
function commitLiveText() {
    if (!editorState.textOverlayOpen) return;
    const overlay = document.getElementById('st-text-overlay');
    const content = document.getElementById('st-text-overlay-content');
    if (!overlay || !content) { editorState.textOverlayOpen = false; return; }

    const text = (content.textContent || '').trim();
    editorState.textOverlayOpen = false;

    // Snapshot geometry BEFORE hiding the overlay (hiding makes its rect zero).
    if (text) {
        const canvas = editorState.canvas;
        const canvasRect = canvas.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();
        const centreX = ((overlayRect.left + overlayRect.width / 2) - canvasRect.left) / canvasRect.width * 100;
        const centreY = ((overlayRect.top + overlayRect.height / 2) - canvasRect.top)  / canvasRect.height * 100;
        const fontSize100 = editorState.textFontSize * 100 / canvasRect.width;

        editorState.shapes.push({
            type: 'text',
            x: centreX, y: centreY,
            text: text,
            fontSize: fontSize100,
            stroke: editorState.eraserActive ? STITCH_COLORS.bg : editorState.stroke,
        });
    }

    content.textContent = '';
    overlay.style.display = 'none';
    redrawCanvas();
    renderPreview();
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
    // Snapshot any in-flight text so it doesn't get thrown away on save.
    if (editorState.textOverlayOpen) commitLiveText();

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
