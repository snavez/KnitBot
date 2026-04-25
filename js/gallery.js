// === Stitch Gallery overlay ===
// Manages the per-project active set (which stitches show in the palette) and
// import/export of the user's full custom-stitch library to/from JSON files.
// Edit/delete of user stitches stays on the palette context menu — the gallery
// is just for activation and library transfer.

const GalleryUI = { open: false };

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-view-gallery')?.addEventListener('click', openGalleryOverlay);
    document.getElementById('gallery-close')?.addEventListener('click', closeGalleryOverlay);
    document.getElementById('gallery-done')?.addEventListener('click', closeGalleryOverlay);
    document.getElementById('gallery-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'gallery-modal') closeGalleryOverlay();
    });
    document.getElementById('gallery-save')?.addEventListener('click', saveGalleryFile);
    document.getElementById('gallery-load')?.addEventListener('click', () => {
        document.getElementById('gallery-load-input')?.click();
    });
    document.getElementById('gallery-load-input')?.addEventListener('change', handleGalleryFileLoad);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && GalleryUI.open) closeGalleryOverlay();
    });
    // Keep the list in sync if the registry changes while the overlay is up
    // (e.g. the user loads another gallery file without closing first).
    document.addEventListener('stitch-registry-updated', () => {
        if (GalleryUI.open) renderGalleryList();
    });
});

function openGalleryOverlay() {
    const modal = document.getElementById('gallery-modal');
    if (!modal) return;
    modal.classList.add('open');
    modal.style.display = 'flex';
    GalleryUI.open = true;
    renderGalleryList();
}

function closeGalleryOverlay() {
    const modal = document.getElementById('gallery-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.style.display = 'none';
    GalleryUI.open = false;
}

function renderGalleryList() {
    const list = document.getElementById('gallery-list');
    if (!list || typeof StitchRegistry === 'undefined') return;
    list.innerHTML = '';
    const effective = (typeof getEffectiveActiveStitches === 'function')
        ? getEffectiveActiveStitches() : null;
    const usedInGrid = (typeof getStitchesUsedInGrid === 'function')
        ? getStitchesUsedInGrid() : new Set();
    for (const stitch of StitchRegistry.getAll()) {
        // The Erase tool is always available; it's not a stitch in the
        // gallery sense, so it doesn't appear here.
        if (stitch.id === 'stitch-erase') continue;
        list.appendChild(buildGalleryItem(stitch, effective, usedInGrid));
    }
}

function buildGalleryItem(stitch, effectiveSet, usedSet) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'gallery-item';
    const isActive = effectiveSet ? effectiveSet.has(stitch.id) : true;
    const isLocked = usedSet.has(stitch.id);
    if (isActive) item.classList.add('is-active');
    if (isLocked) {
        item.classList.add('is-locked');
        item.title = 'Used in the current chart — clear it from the grid before hiding it.';
    } else {
        item.title = (stitch.source === 'user')
            ? `${stitch.label || stitch.id} — click to toggle. Right-click the tile in the palette to edit or delete.`
            : `${stitch.label || stitch.id} — click to toggle. Built-in stitches can't be edited or deleted.`;
    }

    let iconEl;
    if (stitch.useGlyph) {
        iconEl = document.createElement('span');
        iconEl.className = 'gallery-item-glyph';
        iconEl.textContent = stitch.useGlyph;
    } else {
        iconEl = document.createElement('canvas');
        iconEl.className = 'gallery-item-icon';
        iconEl.width = 40;
        iconEl.height = 40;
    }
    item.appendChild(iconEl);

    const text = document.createElement('div');
    text.className = 'gallery-item-text';
    const code = document.createElement('div');
    code.className = 'gallery-item-code';
    code.textContent = stitch.label || stitch.id;
    text.appendChild(code);
    if (stitch.sublabel) {
        const sub = document.createElement('div');
        sub.className = 'gallery-item-sub';
        sub.textContent = stitch.sublabel;
        text.appendChild(sub);
    }
    item.appendChild(text);

    item.addEventListener('click', () => {
        if (isLocked) return;
        if (!state.activeStitches) state.activeStitches = new Set();
        if (state.activeStitches.has(stitch.id)) state.activeStitches.delete(stitch.id);
        else state.activeStitches.add(stitch.id);
        item.classList.toggle('is-active');
        if (typeof initStitchPalette === 'function') initStitchPalette();
    });

    if (iconEl.tagName === 'CANVAS' && typeof stitch.drawIcon === 'function') {
        const ctx = iconEl.getContext('2d');
        ctx.fillStyle = STITCH_COLORS.bg;
        ctx.fillRect(0, 0, 40, 40);
        stitch.drawIcon(ctx, 40);
    }
    return item;
}

// ---------- Save Gallery ----------

function saveGalleryFile() {
    const records = StitchRegistry.getAll()
        .filter(s => s.source === 'user')
        .map(serialiseUserStitch);
    if (records.length === 0) {
        showToast('No custom stitches to save yet — design one with "+ Add Stitch Type" first.');
        return;
    }
    const data = {
        // Marker only — the loader is permissive (it accepts any file with a
        // 'stitches' or 'userStitches' array) so old 'knitwit-gallery' files
        // still load fine.
        type: 'knitwittage-gallery',
        version: 1,
        exportedAt: new Date().toISOString(),
        stitches: records,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `knitwittage-gallery-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const noun = records.length === 1 ? 'stitch' : 'stitches';
    showToast(`Gallery saved (${records.length} ${noun}).`);
}

// Hydrated registry entries hold function refs; pull the raw stored record
// where we have one, otherwise rebuild a clean serialisable copy.
function serialiseUserStitch(s) {
    if (s._record) return s._record;
    return {
        id: s.id,
        label: s.label,
        sublabel: s.sublabel || null,
        title: s.title || '',
        code: s.code || s.id,
        detailedInstructions: s.detailedInstructions || '',
        shapes: s.shapes || [],
        multiCell: !!s.multiCell,
        source: 'user',
        order: s.order ?? 500,
    };
}

// ---------- Load Gallery ----------

function handleGalleryFileLoad(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            // Accept both gallery files (data.stitches) and pattern files'
            // userStitches arrays — handy for bootstrapping a gallery from a
            // borrowed pattern without loading the pattern itself.
            const list = Array.isArray(data && data.stitches) ? data.stitches
                       : Array.isArray(data && data.userStitches) ? data.userStitches
                       : null;
            if (!list) {
                showToast('Not a valid gallery file.');
                return;
            }
            await mergeUserStitches(list);
            if (GalleryUI.open) renderGalleryList();
        } catch (err) {
            console.error(err);
            showToast('Could not read gallery file.');
        }
    };
    reader.readAsText(file);
}

// Shared collision-aware import path. Used by both the gallery overlay's
// "Load gallery" button AND the pattern-file loader (importUserStitchesFromPattern
// in app.js). Built-in id collisions are silently skipped — patterns/galleries
// can't override the app's own stitch library. User-id collisions trigger ONE
// batch confirm() listing every conflict, with overwrite as the OK action.
//
// Returns { imported, overwritten, skipped, failed } so callers can compose
// their own toast (silent: true) or rely on the default summary toast.
async function mergeUserStitches(list, opts = {}) {
    if (typeof StitchRegistry === 'undefined') {
        return { imported: 0, overwritten: 0, skipped: 0, failed: 0 };
    }
    const valid = list.filter(rec =>
        rec && typeof rec.id === 'string' && Array.isArray(rec.shapes));
    const fresh = [], collisions = [];
    for (const rec of valid) {
        const existing = StitchRegistry.get(rec.id);
        if (existing && existing.source !== 'user') continue; // built-in collision: skip
        if (existing) collisions.push(rec);
        else fresh.push(rec);
    }
    let toOverwrite = [];
    let importFresh = true;
    if (collisions.length > 0) {
        const lines = collisions.map(r => `• ${r.id}`).join('\n');
        const noun = collisions.length === 1 ? 'stitch already exists' : 'stitches already exist';
        const choice = await confirmDialog({
            title: collisions.length === 1 ? 'Stitch already exists' : 'Stitches already exist',
            message:
                `The following ${noun} in your gallery:\n\n${lines}\n\n` +
                `Keep your existing versions, or overwrite them with the ones being imported? Either way, any brand-new stitches in the file will still be added.`,
            buttons: [
                { id: 'cancel',    label: 'Cancel' },
                { id: 'keep',      label: 'Keep mine' },
                { id: 'overwrite', label: 'Overwrite with imported', kind: 'primary' },
            ],
        });
        if (choice === null || choice === 'cancel') {
            importFresh = false; // user aborted everything
        } else if (choice === 'overwrite') {
            toOverwrite = collisions;
        }
        // 'keep' → toOverwrite stays empty, fresh still imports
    }
    let imported = 0, overwritten = 0, failed = 0;
    if (importFresh) {
        for (const rec of fresh) {
            try { await saveUserStitchToDB(rec); StitchRegistry.upsertUserStitch(rec); imported++; }
            catch (err) { console.warn('Could not import stitch:', rec.id, err); failed++; }
        }
        for (const rec of toOverwrite) {
            try { await saveUserStitchToDB(rec); StitchRegistry.upsertUserStitch(rec); overwritten++; }
            catch (err) { console.warn('Could not overwrite stitch:', rec.id, err); failed++; }
        }
    }
    const skipped = importFresh ? (collisions.length - toOverwrite.length) : collisions.length;
    const cancelled = !importFresh && (fresh.length + collisions.length) > 0;
    if (imported || overwritten) {
        document.dispatchEvent(new CustomEvent('stitch-registry-updated'));
    }
    if (!opts.silent) {
        if (cancelled) {
            showToast('Gallery import cancelled — no changes made.');
        } else {
            const parts = [];
            if (imported)    parts.push(`${imported} added`);
            if (overwritten) parts.push(`${overwritten} overwritten`);
            if (skipped)     parts.push(`${skipped} kept as-is`);
            if (failed)      parts.push(`${failed} failed`);
            showToast(parts.length ? `Gallery import: ${parts.join(', ')}.` : 'Gallery file had no usable stitches.');
        }
    }
    return { imported, overwritten, skipped, failed, cancelled };
}
