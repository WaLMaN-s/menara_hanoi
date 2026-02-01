// Audio Context untuk sound effects
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'sine') {
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
        // Silent fail jika audio tidak didukung
    }
}

function playMoveSound() {
    playSound(400, 0.1, 'square');
    setTimeout(() => playSound(600, 0.1, 'square'), 50);
}

function playErrorSound() {
    playSound(200, 0.2, 'sawtooth');
}

function playWinSound() {
    [400, 500, 600, 800].forEach((freq, i) => {
        setTimeout(() => playSound(freq, 0.3, 'sine'), i * 100);
    });
}

// Game state
let towers = [[], [], []];
let selectedDisk = null;
let selectedTower = null;
let moveCount = 0;
let numDisks = 4;
let draggedSize = null;
let draggedFromTower = null;

// Touch support untuk mobile
let touchStartX = 0;
let touchStartY = 0;
let isTouchDragging = false;
let touchDragElement = null;

function initGame() {
    towers = [[], [], []];
    moveCount = 0;
    selectedDisk = null;
    selectedTower = null;
    draggedSize = null;
    draggedFromTower = null;
    
    // Inisialisasi disk di tower pertama (dari besar ke kecil)
    for (let i = numDisks; i >= 1; i--) {
        towers[0].push(i);
    }
    
    updateDisplay();
    updateMoveCount();
    updateMinMoves();
}

function updateDisplay() {
    towers.forEach((tower, towerIndex) => {
        const towerElement = document.getElementById(`tower-${towerIndex}`);
        // Hapus semua disk kecuali pole
        const disks = towerElement.querySelectorAll('.disk');
        disks.forEach(d => d.remove());
        
        // Tambahkan disk dari bawah ke atas
        tower.forEach((size, index) => {
            const disk = document.createElement('div');
            disk.className = `disk size-${size}`;
            disk.textContent = size;
            disk.dataset.size = size;
            disk.dataset.tower = towerIndex;
            
            // Hanya disk teratas yang bisa diklik dan di-drag
            if (index === tower.length - 1) {
                // Klik untuk select
                disk.onclick = () => selectDisk(towerIndex, size);
                
                // Drag and drop untuk desktop
                disk.draggable = true;
                
                disk.addEventListener('dragstart', function(e) {
                    draggedSize = size;
                    draggedFromTower = towerIndex;
                    this.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', size.toString());
                    playSound(300, 0.05);
                });
                
                disk.addEventListener('dragend', function(e) {
                    this.classList.remove('dragging');
                    document.querySelectorAll('.tower-stack').forEach(t => {
                        t.classList.remove('drag-over', 'drag-invalid');
                    });
                });

                // Touch events untuk mobile
                disk.addEventListener('touchstart', handleTouchStart, { passive: false });
                disk.addEventListener('touchmove', handleTouchMove, { passive: false });
                disk.addEventListener('touchend', handleTouchEnd, { passive: false });
            } else {
                disk.style.cursor = 'not-allowed';
                disk.style.opacity = '0.8';
                disk.draggable = false;
            }
            
            towerElement.appendChild(disk);
        });
    });
}

// Touch event handlers untuk mobile
function handleTouchStart(e) {
    e.preventDefault();
    
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    
    const disk = e.target;
    draggedSize = parseInt(disk.dataset.size);
    draggedFromTower = parseInt(disk.dataset.tower);
    
    isTouchDragging = true;
    touchDragElement = disk;
    
    disk.classList.add('dragging');
    playSound(300, 0.05);
}

function handleTouchMove(e) {
    if (!isTouchDragging) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const currentX = touch.clientX;
    const currentY = touch.clientY;
    
    // Cek tower mana yang ada di bawah touch
    const element = document.elementFromPoint(currentX, currentY);
    
    // Reset semua highlights
    document.querySelectorAll('.tower-stack').forEach(t => {
        t.classList.remove('drag-over', 'drag-invalid');
    });
    
    // Highlight tower yang valid
    if (element && element.classList.contains('tower-stack')) {
        const targetTowerIndex = parseInt(element.id.split('-')[1]);
        
        if (draggedFromTower !== targetTowerIndex) {
            const targetStack = towers[targetTowerIndex];
            
            if (targetStack.length === 0 || targetStack[targetStack.length - 1] > draggedSize) {
                element.classList.add('drag-over');
            } else {
                element.classList.add('drag-invalid');
            }
        }
    }
}

function handleTouchEnd(e) {
    if (!isTouchDragging) return;
    e.preventDefault();
    
    const touch = e.changedTouches[0];
    const currentX = touch.clientX;
    const currentY = touch.clientY;
    
    // Cek tower mana yang ada di bawah touch
    const element = document.elementFromPoint(currentX, currentY);
    
    // Reset highlights
    document.querySelectorAll('.tower-stack').forEach(t => {
        t.classList.remove('drag-over', 'drag-invalid');
    });
    
    if (touchDragElement) {
        touchDragElement.classList.remove('dragging');
    }
    
    // Proses drop
    if (element) {
        let targetTowerIndex = null;
        
        if (element.classList.contains('tower-stack')) {
            targetTowerIndex = parseInt(element.id.split('-')[1]);
        } else if (element.classList.contains('tower-pole')) {
            targetTowerIndex = parseInt(element.parentElement.id.split('-')[1]);
        }
        
        if (targetTowerIndex !== null && draggedFromTower !== targetTowerIndex) {
            const targetStack = towers[targetTowerIndex];
            
            // Check validity
            if (targetStack.length === 0 || targetStack[targetStack.length - 1] > draggedSize) {
                // Valid move
                towers[draggedFromTower].pop();
                towers[targetTowerIndex].push(draggedSize);
                
                moveCount++;
                updateMoveCount();
                playMoveSound();
                
                updateDisplay();
                
                if (checkWin()) {
                    setTimeout(() => {
                        playWinSound();
                        showWinModal();
                    }, 300);
                }
            } else {
                // Invalid move
                playErrorSound();
            }
        }
    }
    
    // Reset state
    isTouchDragging = false;
    touchDragElement = null;
    draggedSize = null;
    draggedFromTower = null;
}

function setupDropZones() {
    // Setup drop zones SEKALI saat init
    for (let i = 0; i < 3; i++) {
        const towerElement = document.getElementById(`tower-${i}`);
        
        towerElement.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (draggedSize === null) return;
            
            const targetTowerIndex = parseInt(this.id.split('-')[1]);
            const targetStack = towers[targetTowerIndex];
            
            this.classList.remove('drag-over', 'drag-invalid');
            
            if (draggedFromTower === targetTowerIndex) {
                return;
            }
            
            // Check validity
            if (targetStack.length === 0 || targetStack[targetStack.length - 1] > draggedSize) {
                this.classList.add('drag-over');
                e.dataTransfer.dropEffect = 'move';
            } else {
                this.classList.add('drag-invalid');
                e.dataTransfer.dropEffect = 'none';
            }
        });
        
        towerElement.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const targetTowerIndex = parseInt(this.id.split('-')[1]);
            
            this.classList.remove('drag-over', 'drag-invalid');
            
            if (draggedFromTower === null || draggedFromTower === targetTowerIndex) {
                return;
            }
            
            const targetStack = towers[targetTowerIndex];
            
            // Check validity
            if (targetStack.length > 0 && targetStack[targetStack.length - 1] < draggedSize) {
                playErrorSound();
                return;
            }
            
            // Perform move
            towers[draggedFromTower].pop();
            towers[targetTowerIndex].push(draggedSize);
            
            moveCount++;
            updateMoveCount();
            playMoveSound();
            
            draggedSize = null;
            draggedFromTower = null;
            
            updateDisplay();
            
            if (checkWin()) {
                setTimeout(() => {
                    playWinSound();
                    showWinModal();
                }, 300);
            }
        });
        
        towerElement.addEventListener('dragleave', function(e) {
            this.classList.remove('drag-over', 'drag-invalid');
        });
    }
}

function selectDisk(towerIndex, size) {
    playSound(300, 0.05);
    
    // Jika disk sudah dipilih, coba pindahkan
    if (selectedDisk !== null) {
        moveDisk(towerIndex);
    } else {
        // Pilih disk
        selectedDisk = size;
        selectedTower = towerIndex;
        
        // Highlight disk yang dipilih
        document.querySelectorAll('.disk').forEach(d => {
            d.style.transform = '';
        });
        
        const disks = document.querySelectorAll(`[data-tower="${towerIndex}"]`);
        const topDisk = disks[disks.length - 1];
        if (topDisk) {
            topDisk.style.transform = 'translateY(-10px)';
        }
    }
}

function moveDisk(targetTower) {
    if (selectedTower === null || selectedTower === targetTower) {
        // Deselect jika klik tower yang sama
        selectedDisk = null;
        selectedTower = null;
        document.querySelectorAll('.disk').forEach(d => {
            d.style.transform = '';
        });
        return;
    }
    
    // Cek apakah move valid
    const targetStack = towers[targetTower];
    if (targetStack.length > 0 && targetStack[targetStack.length - 1] < selectedDisk) {
        // Invalid move
        playErrorSound();
        return;
    }
    
    // Lakukan perpindahan
    towers[selectedTower].pop();
    towers[targetTower].push(selectedDisk);
    
    moveCount++;
    updateMoveCount();
    
    playMoveSound();
    
    selectedDisk = null;
    selectedTower = null;
    
    updateDisplay();
    
    // Cek kemenangan
    if (checkWin()) {
        setTimeout(() => {
            playWinSound();
            showWinModal();
        }, 300);
    }
}

function checkWin() {
    return towers[2].length === numDisks;
}

function updateMoveCount() {
    document.getElementById('moveCount').textContent = moveCount;
}

function updateMinMoves() {
    const minMoves = Math.pow(2, numDisks) - 1;
    document.getElementById('minMoves').textContent = minMoves;
}

function showWinModal() {
    const modal = document.getElementById('winModal');
    const minMoves = Math.pow(2, numDisks) - 1;
    
    document.getElementById('finalMoves').textContent = moveCount;
    document.getElementById('finalMinMoves').textContent = minMoves;
    
    let performance = '';
    if (moveCount === minMoves) {
        performance = '⭐⭐⭐ Perfect! Langkah Optimal!';
    } else if (moveCount <= minMoves + 5) {
        performance = '⭐⭐ Bagus Sekali!';
    } else {
        performance = '⭐ Selesai! Coba lebih efisien!';
    }
    
    document.getElementById('performanceText').textContent = performance;
    document.getElementById('performanceText').style.color = '#fbbf24';
    document.getElementById('performanceText').style.fontSize = '1.2em';
    
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('winModal').classList.remove('active');
    resetGame();
}

function resetGame() {
    initGame();
}

function setDifficulty(disks) {
    numDisks = disks;
    initGame();
    playSound(500, 0.1);
}

// Tambahkan event listener untuk klik pada tower stack (untuk click mode)
document.querySelectorAll('.tower-stack').forEach((tower, index) => {
    tower.addEventListener('click', (e) => {
        if (e.target.classList.contains('tower-stack') || e.target.classList.contains('tower-pole')) {
            if (selectedDisk !== null) {
                moveDisk(index);
            }
        }
    });
});

// Inisialisasi game saat halaman dimuat
window.onload = () => {
    setupDropZones();
    initGame();
    
    // Resume audio context pada interaksi pertama (untuk browser mobile)
    document.addEventListener('touchstart', function() {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }, { once: true });
};