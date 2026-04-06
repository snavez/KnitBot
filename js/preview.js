// === Preview Modal ===
function openPreview() {
    const modal = document.getElementById('preview-modal');
    modal.classList.add('open');
    renderPreview();
}

function closePreview() {
    document.getElementById('preview-modal').classList.remove('open');
}

function renderPreview() {
    const canvas = document.getElementById('preview-canvas');
    const ctx = canvas.getContext('2d');
    const pattern = getPatternRegion();

    if (!pattern) {
        canvas.width = 400;
        canvas.height = 200;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, 400, 200);
        ctx.fillStyle = '#8899aa';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No pattern to preview. Paint some cells first!', 200, 100);
        return;
    }

    const repeatMode = document.getElementById('preview-repeat').value;
    const tiles = clamp(+document.getElementById('preview-tiles').value, 2, 20);

    const patRows = pattern.length;
    const patCols = pattern[0].length;

    const tilesX = (repeatMode === 'vertical') ? 1 : tiles;
    const tilesY = (repeatMode === 'horizontal') ? 1 : tiles;

    // Calculate cell size to fit nicely
    const maxCanvasWidth = 850;
    const maxCanvasHeight = 500;
    const totalCellsX = patCols * tilesX;
    const totalCellsY = patRows * tilesY;

    let cellSize = Math.min(
        Math.floor(maxCanvasWidth / totalCellsX),
        Math.floor(maxCanvasHeight / totalCellsY)
    );
    cellSize = clamp(cellSize, 3, 30);

    const canvasW = totalCellsX * cellSize;
    const canvasH = totalCellsY * cellSize;
    canvas.width = canvasW;
    canvas.height = canvasH;

    // Fill background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw tiled pattern
    for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
            const offsetX = tx * patCols * cellSize;
            const offsetY = ty * patRows * cellSize;

            for (let r = 0; r < patRows; r++) {
                for (let c = 0; c < patCols; c++) {
                    const color = pattern[r][c];
                    if (color) {
                        ctx.fillStyle = color;
                    } else {
                        ctx.fillStyle = '#1a1a2e';
                    }
                    ctx.fillRect(
                        offsetX + c * cellSize,
                        offsetY + r * cellSize,
                        cellSize,
                        cellSize
                    );
                }
            }

            // Draw subtle tile boundary
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(offsetX, offsetY, patCols * cellSize, patRows * cellSize);
        }
    }

    // Draw grid lines if cells are big enough
    if (cellSize >= 8) {
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 0.5;
        for (let y = 0; y <= canvasH; y += cellSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasW, y);
            ctx.stroke();
        }
        for (let x = 0; x <= canvasW; x += cellSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasH);
            ctx.stroke();
        }
    }
}
