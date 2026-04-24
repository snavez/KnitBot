// === Stitch Registry ===
// Central, data-driven definition of every stitch type. Built-ins are hardcoded
// below; user-defined stitches (added via the Add Stitch Type editor — not yet
// built) will be loaded from IndexedDB and merged in at startup.
//
// Each entry owns:
//   - identity      (id, label, sublabel, title)
//   - behaviour     (kind: 'simple' | 'cross' | 'erase')
//   - instructions  (code for the row text, printSymbol for the chart table)
//   - visuals       (drawIcon for the 40x40 palette tile, drawCell for grid overlay)
//   - ordering      (order — lower first, reserved 0–999 for built-ins)
//
// 'cross' entries have no drawCell because cross cells are rendered by
// drawCrossingOverlay in cables.js (cluster-aware). 'erase' has no drawCell
// because it's a tool, never placed on the grid.

const STITCH_COLORS = {
    bg: '#fbf7ec',
    purlBg: '#fbf7ec',
    yarn: '#2a211a',
    yarnDark: '#2a211a',
    yarnFront: '#2a211a',
    yarnBack: '#c9bca0',
    accent: '#2a211a',
    accentSoft: '#2a211a',
    ink: 'rgba(42, 33, 26, 0.4)',
    paperShade: 'rgba(251, 247, 236, 0)',
    purlMark: '#2a211a',
};

// ---------- Palette tile icon drawing (40x40) ----------

function drawKnitTileIcon(ctx, s) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = STITCH_COLORS.yarn;
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(s*0.15, s*0.15);
    ctx.lineTo(s*0.5,  s*0.7);
    ctx.lineTo(s*0.85, s*0.15);
    ctx.stroke();
    ctx.strokeStyle = STITCH_COLORS.yarnDark;
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(s*0.35, s*0.88);
    ctx.lineTo(s*0.65, s*0.88);
    ctx.stroke();
}

function drawPurlTileIcon(ctx, s) {
    ctx.strokeStyle = STITCH_COLORS.purlMark;
    ctx.lineWidth = s * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s*0.2, s*0.5);
    ctx.lineTo(s*0.8, s*0.5);
    ctx.stroke();
}

function drawCrossTileIcon(ctx, s, dir) {
    const lw = s * 0.14;
    ctx.lineCap = 'round';
    const frontFrom = dir === 'left' ? 0.25 : 0.75;
    const frontTo   = dir === 'left' ? 0.75 : 0.25;
    const backFrom  = dir === 'left' ? 0.75 : 0.25;
    const backTo    = dir === 'left' ? 0.25 : 0.75;

    ctx.strokeStyle = STITCH_COLORS.yarnBack;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(s * backFrom, 0);
    ctx.bezierCurveTo(s * backFrom, s*0.6, s * backTo, s*0.4, s * backTo, s);
    ctx.stroke();
    ctx.strokeStyle = STITCH_COLORS.bg;
    ctx.lineWidth = lw + 4;
    ctx.beginPath();
    ctx.moveTo(s * frontFrom, 0);
    ctx.bezierCurveTo(s * frontFrom, s*0.6, s * frontTo, s*0.4, s * frontTo, s);
    ctx.stroke();
    ctx.strokeStyle = STITCH_COLORS.yarnFront;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(s * frontFrom, 0);
    ctx.bezierCurveTo(s * frontFrom, s*0.6, s * frontTo, s*0.4, s * frontTo, s);
    ctx.stroke();
}

function drawM1TileIcon(ctx, s, dir) {
    ctx.lineCap = 'round';
    if (dir === 'right') {
        ctx.strokeStyle = STITCH_COLORS.yarn;
        ctx.lineWidth = s * 0.14;
        ctx.beginPath();
        ctx.moveTo(s*0.15, s*0.7);
        ctx.lineTo(s*0.55, s*0.2);
        ctx.stroke();
        ctx.strokeStyle = STITCH_COLORS.yarnFront;
        ctx.lineWidth = s * 0.1;
        ctx.beginPath();
        ctx.moveTo(s*0.6,  s*0.7);
        ctx.lineTo(s*0.9,  s*0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s*0.75, s*0.57);
        ctx.lineTo(s*0.75, s*0.83);
        ctx.stroke();
    } else {
        ctx.strokeStyle = STITCH_COLORS.yarnFront;
        ctx.lineWidth = s * 0.1;
        ctx.beginPath();
        ctx.moveTo(s*0.1,  s*0.7);
        ctx.lineTo(s*0.4,  s*0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s*0.25, s*0.57);
        ctx.lineTo(s*0.25, s*0.83);
        ctx.stroke();
        ctx.strokeStyle = STITCH_COLORS.yarn;
        ctx.lineWidth = s * 0.14;
        ctx.beginPath();
        ctx.moveTo(s*0.45, s*0.2);
        ctx.lineTo(s*0.85, s*0.7);
        ctx.stroke();
    }
}

function drawKLeanTileIcon(ctx, s, dir) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = STITCH_COLORS.yarn;
    ctx.lineWidth = s * 0.14;
    if (dir === 'right') {
        ctx.beginPath();
        ctx.moveTo(s*0.15, s*0.7);
        ctx.lineTo(s*0.55, s*0.2);
        ctx.stroke();
        ctx.strokeStyle = STITCH_COLORS.yarnFront;
        ctx.lineWidth = s * 0.1;
        ctx.beginPath();
        ctx.moveTo(s*0.6, s*0.75);
        ctx.lineTo(s*0.9, s*0.75);
        ctx.stroke();
    } else {
        ctx.strokeStyle = STITCH_COLORS.yarnFront;
        ctx.lineWidth = s * 0.1;
        ctx.beginPath();
        ctx.moveTo(s*0.1, s*0.75);
        ctx.lineTo(s*0.4, s*0.75);
        ctx.stroke();
        ctx.strokeStyle = STITCH_COLORS.yarn;
        ctx.lineWidth = s * 0.14;
        ctx.beginPath();
        ctx.moveTo(s*0.45, s*0.2);
        ctx.lineTo(s*0.85, s*0.7);
        ctx.stroke();
    }
}

function drawHoleTileIcon(ctx, s) {
    ctx.fillStyle = '#ede3cc';
    ctx.beginPath();
    ctx.arc(s*0.5, s*0.5, s*0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = STITCH_COLORS.yarn;
    ctx.lineWidth = s * 0.1;
    ctx.stroke();
}

function drawNoStitchTileIcon(ctx, s) {
    const pad = s * 0.15;
    ctx.fillStyle = '#c9bca0';
    ctx.fillRect(pad, pad, s - pad * 2, s - pad * 2);
    ctx.strokeStyle = '#5a4c3e';
    ctx.lineWidth = s * 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s*0.3, s*0.3);
    ctx.lineTo(s*0.7, s*0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s*0.7, s*0.3);
    ctx.lineTo(s*0.3, s*0.7);
    ctx.stroke();
}

// ---------- Grid cell overlay drawing (per-cell, arbitrary size) ----------

function drawKnitCell(ctx, x, y, w, h) {
    const lw = Math.max(1.5, w * 0.14);
    ctx.lineCap = 'round';
    ctx.strokeStyle = STITCH_COLORS.yarn;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x + w*0.15, y + h*0.15);
    ctx.lineTo(x + w*0.5,  y + h*0.7);
    ctx.lineTo(x + w*0.85, y + h*0.15);
    ctx.stroke();
    ctx.strokeStyle = STITCH_COLORS.yarnDark;
    ctx.lineWidth = lw * 0.7;
    ctx.beginPath();
    ctx.moveTo(x + w*0.35, y + h*0.88);
    ctx.lineTo(x + w*0.65, y + h*0.88);
    ctx.stroke();
}

function drawPurlCell(ctx, x, y, w, h) {
    ctx.strokeStyle = STITCH_COLORS.purlMark;
    ctx.lineWidth = Math.max(2, w * 0.13);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w*0.2, y + h*0.5);
    ctx.lineTo(x + w*0.8, y + h*0.5);
    ctx.stroke();
}

function drawNoStitchCell(ctx, x, y, w, h) {
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

function drawKLeanCell(ctx, x, y, w, h, dir) {
    const lw = Math.max(1.5, w * 0.12);
    ctx.lineCap = 'round';
    if (dir === 'right') {
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

function drawM1Cell(ctx, x, y, w, h, dir) {
    const lw = Math.max(1.5, w * 0.12);
    ctx.lineCap = 'round';
    if (dir === 'right') {
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

function drawHoleCell(ctx, x, y, w, h) {
    ctx.fillStyle = '#ede3cc';
    ctx.beginPath();
    ctx.arc(x + w*0.5, y + h*0.5, Math.min(w, h) * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = STITCH_COLORS.accentSoft;
    ctx.lineWidth = Math.max(1.5, w * 0.09);
    ctx.beginPath();
    ctx.arc(x + w*0.5, y + h*0.5, Math.min(w, h) * 0.35, 0, Math.PI * 2);
    ctx.stroke();
}

// ---------- Registry ----------

const BUILTIN_STITCHES = [
    {
        id: 'knit', label: 'Knit', title: 'Knit stitch',
        kind: 'simple', code: 'K', printSymbol: 'V',
        drawIcon: (ctx, s) => drawKnitTileIcon(ctx, s),
        drawCell: drawKnitCell,
        order: 10,
    },
    {
        id: 'purl', label: 'Purl', title: 'Purl stitch',
        kind: 'simple', code: 'P', printSymbol: '\u2013',
        drawIcon: (ctx, s) => drawPurlTileIcon(ctx, s),
        drawCell: drawPurlCell,
        order: 20,
    },
    {
        id: 'left-cross', label: 'Left X', sublabel: 'CF',
        title: 'Left Cross — select cells, then click to apply. Reads K/P from row below to determine crossing.',
        kind: 'cross', dir: 'left',
        drawIcon: (ctx, s) => drawCrossTileIcon(ctx, s, 'left'),
        drawCell: null, // rendered by drawCrossingOverlay in cables.js
        order: 30,
    },
    {
        id: 'right-cross', label: 'Right X', sublabel: 'CB',
        title: 'Right Cross — select cells, then click to apply. Reads K/P from row below to determine crossing.',
        kind: 'cross', dir: 'right',
        drawIcon: (ctx, s) => drawCrossTileIcon(ctx, s, 'right'),
        drawCell: null,
        order: 40,
    },
    {
        id: 'k-right', label: 'K2tog', sublabel: 'dec 1',
        title: 'Knit 2 together — right-leaning decrease',
        kind: 'simple', code: 'K2tog', printSymbol: '/',
        drawIcon: (ctx, s) => drawKLeanTileIcon(ctx, s, 'right'),
        drawCell: (ctx, x, y, w, h) => drawKLeanCell(ctx, x, y, w, h, 'right'),
        order: 50,
    },
    {
        id: 'k-left', label: 'SSK', sublabel: 'dec 1',
        title: 'Slip slip knit — left-leaning decrease',
        kind: 'simple', code: 'SSK', printSymbol: '\\',
        drawIcon: (ctx, s) => drawKLeanTileIcon(ctx, s, 'left'),
        drawCell: (ctx, x, y, w, h) => drawKLeanCell(ctx, x, y, w, h, 'left'),
        order: 60,
    },
    {
        id: 'm1r', label: 'M1R', sublabel: 'inc 1',
        title: 'Make 1 Right — invisible right-leaning increase',
        kind: 'simple', code: 'M1R', printSymbol: 'M1R',
        printSymbolFontPt: 6,
        drawIcon: (ctx, s) => drawM1TileIcon(ctx, s, 'right'),
        drawCell: (ctx, x, y, w, h) => drawM1Cell(ctx, x, y, w, h, 'right'),
        order: 70,
    },
    {
        id: 'm1l', label: 'M1L', sublabel: 'inc 1',
        title: 'Make 1 Left — invisible left-leaning increase',
        kind: 'simple', code: 'M1L', printSymbol: 'M1L',
        printSymbolFontPt: 6,
        drawIcon: (ctx, s) => drawM1TileIcon(ctx, s, 'left'),
        drawCell: (ctx, x, y, w, h) => drawM1Cell(ctx, x, y, w, h, 'left'),
        order: 80,
    },
    {
        id: 'hole', label: 'Hole', sublabel: 'YO',
        title: 'Lace hole — becomes YO in instructions',
        kind: 'simple', code: 'YO', printSymbol: '\u25CB',
        drawIcon: (ctx, s) => drawHoleTileIcon(ctx, s),
        drawCell: drawHoleCell,
        order: 90,
    },
    {
        id: 'no-stitch', label: 'No St', sublabel: '(All BG)',
        title: "No stitch — click to fill all empty cells, or tick 'Select' to place individually",
        kind: 'simple', code: null, printSymbol: null,
        drawIcon: (ctx, s) => drawNoStitchTileIcon(ctx, s),
        drawCell: drawNoStitchCell,
        order: 100,
        extraTileMarkup: true, // signals the palette renderer to add the "Select Cells" checkbox
    },
    {
        id: 'stitch-erase', label: 'Erase', sublabel: 'Stitch type',
        title: 'Erase stitch type',
        kind: 'erase',
        // Uses a CSS-styled glyph (.stitch-erase-icon) instead of a canvas icon;
        // see buildStitchTile for the markup branch.
        useGlyph: '\u2715',
        drawIcon: null,
        drawCell: null,
        order: 999,
        extraTileClass: 'stitch-tile-erase',
    },
];

const StitchRegistry = {
    _user: [],
    getAll() {
        return [...BUILTIN_STITCHES, ...this._user].sort((a, b) => a.order - b.order);
    },
    get(id) {
        if (!id) return null;
        return BUILTIN_STITCHES.find(s => s.id === id)
            || this._user.find(s => s.id === id)
            || null;
    },
    isKind(id, kind) { return this.get(id)?.kind === kind; },
    isSimple(id)  { return this.isKind(id, 'simple'); },
    isCross(id)   { return this.isKind(id, 'cross'); },
    isErase(id)   { return id === 'stitch-erase'; },
    // True for anything the click-or-drag paint handler should treat as a
    // single-cell paint (everything except cross, which uses drag).
    isPaintable(id) { return this.isSimple(id) || this.isErase(id); },
    // Notation code used when generating knitting instructions.
    codeFor(id) { return this.get(id)?.code ?? null; },
    // Replace the in-memory user list; called after IndexedDB load or edit.
    setUserStitches(list) { this._user = list || []; },
};

// ---------- IndexedDB persistence (plumbing for the upcoming editor) ----------
// Survives app updates and reloads — PWA asset cache is a separate store and
// won't touch IndexedDB. No user-visible effect yet; the list is always empty
// until the editor ships.

const STITCH_DB_NAME = 'knitwork';
const STITCH_DB_VERSION = 1;
const STITCH_STORE = 'user_stitches';

function openStitchDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(STITCH_DB_NAME, STITCH_DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STITCH_STORE)) {
                db.createObjectStore(STITCH_STORE, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function loadUserStitchesFromDB() {
    try {
        const db = await openStitchDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STITCH_STORE, 'readonly');
            const store = tx.objectStore(STITCH_STORE);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('user stitches unavailable:', err);
        return [];
    }
}

async function saveUserStitchToDB(record) {
    const db = await openStitchDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STITCH_STORE, 'readwrite');
        tx.objectStore(STITCH_STORE).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function deleteUserStitchFromDB(id) {
    const db = await openStitchDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STITCH_STORE, 'readwrite');
        tx.objectStore(STITCH_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Load on startup, then dispatch an event so the palette can re-render if
// anything came back. Runs in parallel with DOM load; the palette renders
// built-ins immediately and re-renders when this resolves.
document.addEventListener('DOMContentLoaded', async () => {
    const list = await loadUserStitchesFromDB();
    if (list.length > 0) {
        StitchRegistry.setUserStitches(list);
        document.dispatchEvent(new CustomEvent('stitch-registry-updated'));
    }
});
