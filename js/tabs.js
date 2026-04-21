// === Tab Strip ===
// Three phases: Design (current workbench) / Refine Instructions / Knit
// Tabs hook into existing modals/overlays — no functionality changes.

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const id = tab.dataset.tab;
            setActiveTab(id);
            if (id === 'refine') {
                // Open the Instructions modal
                if (typeof openInstructionsModal === 'function') openInstructionsModal();
            } else if (id === 'knit') {
                // Enter knit mode
                if (typeof enterKnitMode === 'function') enterKnitMode();
            }
            // 'design' just shows the underlying workbench (no modal)
        });
    });

    // When the user closes the instructions modal, restore Design tab
    const instrModal = document.getElementById('instructions-modal');
    if (instrModal) {
        // Watch for the 'open' class being removed
        const observer = new MutationObserver(() => {
            if (!instrModal.classList.contains('open')) {
                const active = document.querySelector('.tab.active');
                if (active && active.dataset.tab === 'refine') {
                    setActiveTab('design');
                }
            }
        });
        observer.observe(instrModal, { attributes: true, attributeFilter: ['class'] });
    }

    // Same for knit mode
    const knitOverlay = document.getElementById('knit-overlay');
    if (knitOverlay) {
        const knitObserver = new MutationObserver(() => {
            if (knitOverlay.style.display === 'none') {
                const active = document.querySelector('.tab.active');
                if (active && active.dataset.tab === 'knit') {
                    setActiveTab('design');
                }
            }
        });
        knitObserver.observe(knitOverlay, { attributes: true, attributeFilter: ['style'] });
    }
});

function setActiveTab(id) {
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === id);
    });
}
