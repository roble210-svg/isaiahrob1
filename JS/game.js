// Tetris Game Implementation

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 40;

// Tetromino shapes (I, O, T, S, Z, J, L)
const SHAPES = {
    I: [
        [[1, 1, 1, 1]],
        [[1],
         [1],
         [1],
         [1]]
    ],
    O: [
        [[1, 1],
         [1, 1]]
    ],
    T: [
        [[0, 1, 0],
         [1, 1, 1]],
        [[1, 0],
         [1, 1],
         [1, 0]],
        [[1, 1, 1],
         [0, 1, 0]],
        [[0, 1],
         [1, 1],
         [0, 1]]
    ],
    S: [
        [[0, 1, 1],
         [1, 1, 0]],
        [[1, 0],
         [1, 1],
         [0, 1]]
    ],
    Z: [
        [[1, 1, 0],
         [0, 1, 1]],
        [[0, 1],
         [1, 1],
         [1, 0]]
    ],
    J: [
        [[1, 0, 0],
         [1, 1, 1]],
        [[1, 1],
         [1, 0],
         [1, 0]],
        [[1, 1, 1],
         [0, 0, 1]],
        [[0, 1],
         [0, 1],
         [1, 1]]
    ],
    L: [
        [[0, 0, 1],
         [1, 1, 1]],
        [[1, 0],
         [1, 0],
         [1, 1]],
        [[1, 1, 1],
         [1, 0, 0]],
        [[1, 1],
         [0, 1],
         [0, 1]]
    ]
};

// Colors for each piece type
const COLORS = {
    I: '#3b82f6',  // secondary-blue
    O: '#fbbf24',  // yellow
    T: '#a855f7',  // purple
    S: '#10b981',  // mint-green
    Z: '#ef4444',  // red
    J: '#1e3a8a',  // primary-blue
    L: '#f97316'   // orange
};

// Game state
let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let dropCounter = 0;
let dropInterval = 1000; // milliseconds
let lastTime = 0;
let gameRunning = false;
let gamePaused = false;
let animationFrameId = null;

// Canvas elements
const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextPieceCanvas');
const nextCtx = nextCanvas.getContext('2d');

// Audio context and sounds
let audioContext = null;
let currentMusicIndex = 0;
let bgMusic1 = null;
let bgMusic2 = null;
let musicInitialized = false;

// Initialize audio context and background music (must be called after user interaction)
function initAudio() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio not supported');
        }
    }
    
    // Initialize background music on first user interaction
    if (!musicInitialized) {
        try {
            bgMusic1 = document.getElementById('bgMusic1');
            bgMusic2 = document.getElementById('bgMusic2');
            
            if (bgMusic1 && bgMusic2) {
                // Set volume (0.0 to 1.0)
                bgMusic1.volume = 0.3;
                bgMusic2.volume = 0.3;
                
                // Add event listeners to switch between tracks
                bgMusic1.addEventListener('ended', () => {
                    if (gameRunning) {
                        bgMusic2.currentTime = 0;
                        bgMusic2.play().catch(() => {});
                        currentMusicIndex = 1;
                    }
                });
                
                bgMusic2.addEventListener('ended', () => {
                    if (gameRunning) {
                        bgMusic1.currentTime = 0;
                        bgMusic1.play().catch(() => {});
                        currentMusicIndex = 0;
                    }
                });
                
                musicInitialized = true;
            }
        } catch (e) {
            console.log('Background music initialization failed:', e);
        }
    }
    
    return audioContext;
}

// Start background music
function startBackgroundMusic() {
    if (!musicInitialized) {
        initAudio();
    }
    
    if (bgMusic1 && bgMusic2) {
        try {
            // Start with first track
            bgMusic1.currentTime = 0;
            bgMusic1.play().catch(e => {
                console.log('Could not play background music:', e);
            });
            currentMusicIndex = 0;
        } catch (e) {
            console.log('Error starting background music:', e);
        }
    }
}

// Stop background music
function stopBackgroundMusic() {
    if (bgMusic1) {
        bgMusic1.pause();
        bgMusic1.currentTime = 0;
    }
    if (bgMusic2) {
        bgMusic2.pause();
        bgMusic2.currentTime = 0;
    }
}

// Pause background music
function pauseBackgroundMusic() {
    if (bgMusic1) bgMusic1.pause();
    if (bgMusic2) bgMusic2.pause();
}

// Resume background music
function resumeBackgroundMusic() {
    if (musicInitialized && (bgMusic1 || bgMusic2)) {
        try {
            if (currentMusicIndex === 0 && bgMusic1) {
                bgMusic1.play().catch(() => {});
            } else if (currentMusicIndex === 1 && bgMusic2) {
                bgMusic2.play().catch(() => {});
            }
        } catch (e) {
            console.log('Error resuming background music:', e);
        }
    }
}

// Create audio tones
function createTone(frequency, duration, type = 'sine') {
    const ctx = initAudio();
    if (!ctx) return;
    
    try {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
        // Silently fail if audio can't play
    }
}

// Sound effects
function playMoveSound() {
    try {
        createTone(150, 0.05, 'sine');
    } catch (e) {
        // Silently fail if audio can't play
    }
}

function playRotateSound() {
    try {
        createTone(200, 0.08, 'square');
    } catch (e) {
        // Silently fail if audio can't play
    }
}

function playLineClearSound() {
    try {
        createTone(300, 0.1, 'sine');
        setTimeout(() => createTone(350, 0.1, 'sine'), 50);
    } catch (e) {
        // Silently fail if audio can't play
    }
}

function playTetrisSound() {
    try {
        // Play a chord for tetris
        createTone(400, 0.15, 'sine');
        setTimeout(() => createTone(500, 0.15, 'sine'), 30);
        setTimeout(() => createTone(600, 0.15, 'sine'), 60);
        setTimeout(() => createTone(700, 0.2, 'sine'), 90);
    } catch (e) {
        // Silently fail if audio can't play
    }
}

// Initialize board
function initBoard() {
    board = Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0));
}

// Create a new piece
function createPiece(type) {
    const types = Object.keys(SHAPES);
    const pieceType = type || types[Math.floor(Math.random() * types.length)];
    // Center the I-piece properly when horizontal
    let startX = Math.floor(BOARD_WIDTH / 2) - 1;
    if (pieceType === 'I') {
        startX = Math.floor(BOARD_WIDTH / 2) - 2;
    }
    return {
        type: pieceType,
        shape: SHAPES[pieceType],
        rotation: 0,
        x: startX,
        y: 0,
        color: COLORS[pieceType]
    };
}

// Get current shape of piece based on rotation
function getPieceShape(piece) {
    const rotations = piece.shape;
    return rotations[piece.rotation % rotations.length];
}

// Check if piece can be placed at position
function isValidMove(piece, dx = 0, dy = 0, newRotation = null) {
    const shape = newRotation !== null ? piece.shape[newRotation % piece.shape.length] : getPieceShape(piece);
    const newX = piece.x + dx;
    const newY = piece.y + dy;
    
    // For I-piece rotation, adjust position to keep it centered
    let adjustedX = newX;
    if (piece.type === 'I' && newRotation !== null && newRotation !== piece.rotation) {
        // I-piece rotation adjustments
        // Horizontal (0) is 4 blocks wide, Vertical (1) is 1 block wide
        // When horizontal at x=3, center is at x+1.5 = 4.5
        // When vertical, we want center at ~4.5, so x should be around 4
        if (piece.rotation === 0 && newRotation === 1) {
            // Horizontal to vertical - adjust to maintain center
            adjustedX = newX + 1;
        } else if (piece.rotation === 1 && newRotation === 0) {
            // Vertical to horizontal - opposite adjustment
            adjustedX = newX - 1;
        }
    }

    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const boardX = adjustedX + x;
                const boardY = newY + y;

                // Check boundaries
                if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
                    return { valid: false, adjustedX };
                }

                // Check collision with placed blocks
                if (boardY >= 0 && board[boardY][boardX]) {
                    return { valid: false, adjustedX };
                }
            }
        }
    }
    return { valid: true, adjustedX };
}

// Place piece on board
function placePiece(piece) {
    const shape = getPieceShape(piece);
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x]) {
                const boardY = piece.y + y;
                const boardX = piece.x + x;
                if (boardY >= 0) {
                    board[boardY][boardX] = piece.color;
                }
            }
        }
    }
}

// Clear completed lines
function clearLines() {
    let linesCleared = 0;
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            board.splice(y, 1);
            board.unshift(Array(BOARD_WIDTH).fill(0));
            linesCleared++;
            y++; // Check same line again
        }
    }

    if (linesCleared > 0) {
        lines += linesCleared;
        // Score calculation
        const points = [0, 100, 300, 500, 800];
        score += points[linesCleared] * level;
        
        // Play appropriate sound
        if (linesCleared === 4) {
            playTetrisSound();
        } else {
            playLineClearSound();
        }
        
        // Improved difficulty progression - level up every 10 lines
        const newLevel = Math.floor(lines / 10) + 1;
        if (newLevel > level) {
            level = newLevel;
        }
        
        // Exponential difficulty increase - starts at 1000ms and gets faster
        // Formula: 1000 * (0.9 ^ (level - 1)), minimum 50ms
        dropInterval = Math.max(50, 1000 * Math.pow(0.85, level - 1));
        
        updateUI();
    }
}

// Move piece
function movePiece(dx, dy) {
    if (!gameRunning || gamePaused) return false;
    
    const result = isValidMove(currentPiece, dx, dy);
    if (result.valid) {
        currentPiece.x += dx;
        currentPiece.y += dy;
        if (dx !== 0) {
            playMoveSound();
        }
        return true;
    }
    return false;
}

// Rotate piece
function rotatePiece() {
    if (!gameRunning || gamePaused) return;
    
    const newRotation = (currentPiece.rotation + 1) % currentPiece.shape.length;
    const result = isValidMove(currentPiece, 0, 0, newRotation);
    if (result.valid) {
        // Adjust position for I-piece rotation
        if (currentPiece.type === 'I' && result.adjustedX !== undefined) {
            currentPiece.x = result.adjustedX;
        }
        currentPiece.rotation = newRotation;
        playRotateSound();
    }
}

// Drop piece
function dropPiece() {
    if (!gameRunning || gamePaused) return;
    
    const result = isValidMove(currentPiece, 0, 1);
    if (!result.valid) {
        placePiece(currentPiece);
        clearLines();
        currentPiece = nextPiece;
        nextPiece = createPiece();
        
        // Check game over
        const startCheck = isValidMove(currentPiece);
        if (!startCheck.valid) {
            gameOver();
        }
    } else {
        currentPiece.y += 1;
    }
}

// Game over
function gameOver() {
    gameRunning = false;
    document.getElementById('gameOver').classList.add('active');
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalLevel').textContent = level;
    stopBackgroundMusic();
    cancelAnimationFrame(animationFrameId);
}

// Draw block
function drawBlock(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    
    // Add border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    
    // Add highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE / 2, BLOCK_SIZE / 2);
}

// Draw board
function drawBoard() {
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw placed blocks
    for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
            if (board[y][x]) {
                drawBlock(ctx, x, y, board[y][x]);
            }
        }
    }

    // Draw current piece
    if (currentPiece) {
        const shape = getPieceShape(currentPiece);
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    drawBlock(ctx, currentPiece.x + x, currentPiece.y + y, currentPiece.color);
                }
            }
        }
    }
}

// Draw next piece preview
function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (nextPiece) {
        const shape = nextPiece.shape[0]; // Show first rotation
        const blockSize = 25;
        const offsetX = (nextCanvas.width - shape[0].length * blockSize) / 2;
        const offsetY = (nextCanvas.height - shape.length * blockSize) / 2;
        
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x]) {
                    nextCtx.fillStyle = nextPiece.color;
                    nextCtx.fillRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize,
                        blockSize
                    );
                    
                    nextCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                    nextCtx.lineWidth = 1;
                    nextCtx.strokeRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize,
                        blockSize
                    );
                }
            }
        }
    }
}

// Update UI
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('lines').textContent = lines;
    document.getElementById('level').textContent = level;
}

// Game loop
function gameLoop(time = 0) {
    if (!gameRunning) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        dropPiece();
        dropCounter = 0;
    }

    drawBoard();
    drawNextPiece();
    animationFrameId = requestAnimationFrame(gameLoop);
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    // Initialize audio on any keypress
    initAudio();
    
    if (!gameRunning || gamePaused) {
        if (e.key === 'ArrowUp' || e.key === ' ') {
            e.preventDefault();
            startGame();
        }
        return;
    }

    switch(e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            if (movePiece(-1, 0)) {
                // Sound is played in movePiece
            }
            break;
        case 'ArrowRight':
            e.preventDefault();
            if (movePiece(1, 0)) {
                // Sound is played in movePiece
            }
            break;
        case 'ArrowDown':
            e.preventDefault();
            dropPiece();
            break;
        case 'ArrowUp':
        case ' ':
            e.preventDefault();
            rotatePiece();
            break;
    }
});

// Also initialize audio on button clicks
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.querySelector('.btn-reset');
    
    if (startBtn) {
        startBtn.addEventListener('click', () => initAudio());
    }
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => initAudio());
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', () => initAudio());
    }
});

// Start game
function startGame() {
    if (gameRunning && !gamePaused) return;
    
    // Initialize audio on first user interaction
    initAudio();
    
    gamePaused = false;
    gameRunning = true;
    document.getElementById('gameOver').classList.remove('active');
    document.getElementById('startBtn').textContent = 'Restart';
    
    if (!currentPiece) {
        initBoard();
        currentPiece = createPiece();
        nextPiece = createPiece();
        score = 0;
        lines = 0;
        level = 1;
        dropInterval = 1000;
        dropCounter = 0;
        updateUI();
    }
    
    // Start background music
    startBackgroundMusic();
    
    lastTime = performance.now();
    gameLoop();
}

// Toggle pause
function togglePause() {
    if (!gameRunning) return;
    
    gamePaused = !gamePaused;
    document.getElementById('pauseBtn').textContent = gamePaused ? 'Resume' : 'Pause';
    
    if (gamePaused) {
        pauseBackgroundMusic();
    } else {
        resumeBackgroundMusic();
        lastTime = performance.now();
        gameLoop();
    }
}

// Reset game
function resetGame() {
    gameRunning = false;
    gamePaused = false;
    cancelAnimationFrame(animationFrameId);
    stopBackgroundMusic();
    document.getElementById('gameOver').classList.remove('active');
    document.getElementById('startBtn').textContent = 'Start';
    document.getElementById('pauseBtn').textContent = 'Pause';
    
    initBoard();
    currentPiece = null;
    nextPiece = null;
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    dropCounter = 0;
    updateUI();
    drawBoard();
    drawNextPiece();
}

// Initialize
initBoard();
drawBoard();
drawNextPiece();

