// Configuration du jeu
const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const BLOCK_SIZE = 30;

// Formes des pièces Tetris
const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    L: [[1, 0], [1, 0], [1, 1]],
    J: [[0, 1], [0, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]]
};

// Couleurs des pièces
const COLORS = {
    I: '#00f0f0',
    O: '#f0f000',
    T: '#a000f0',
    L: '#f0a000',
    J: '#0000f0',
    S: '#00f000',
    Z: '#f00000'
};

class TetrisGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.grid = Array(GRID_HEIGHT).fill().map(() => Array(GRID_WIDTH).fill(0));
        this.score = 0;
        this.currentPiece = null;
        this.gameOver = false;
        this.isHuman = canvasId === 'humanCanvas';
        this.dropCounter = 0;
        this.baseDropInterval = 500;
        this.dropInterval = this.baseDropInterval;
        this.lastTime = 0;
        this.gameOverCallback = null;  // Nouveau: callback pour la fin de partie
        this.gameOverModal = document.getElementById('gameOverModal');
        this.restartButton = document.getElementById('restartButton');
        this.setupRestartButton();
        
        if (this.isHuman) {
            this.setupControls();
        } else {
            this.aiMoveDelay = 500; // Modifié de 300 à 100 pour avoir la même vitesse que l'humain
            this.aiLastMove = 0;
        }

        this.opponent = null; // Ajout d'une référence à l'adversaire
        this.nextPiece = null;
        this.nextPieceCanvas = this.isHuman ? document.getElementById('nextPieceCanvas') : null;
        this.nextPieceCtx = this.nextPieceCanvas ? this.nextPieceCanvas.getContext('2d') : null;
        this.lastSlowdownScore = 0;
        this.slowdownActive = false;
        this.slowdownTimeout = null;
        this.rainbowMode = false;
        this.rainbowInterval = null;
        this.rainbowTimeout = null;
        this.originalColors = { ...COLORS }; // Sauvegarder les couleurs originales
    }

    setupControls() {
        document.addEventListener('keydown', (event) => {
            if (!this.gameOver) {
                switch (event.key) {
                    case 'ArrowLeft':
                        this.movePiece(-1, 0);
                        break;
                    case 'ArrowRight':
                        this.movePiece(1, 0);
                        break;
                    case 'ArrowDown':
                        this.movePiece(0, 1);
                        break;
                    case 'ArrowUp':
                        this.rotatePiece();
                        break;
                }
            }
        });
    }

    setupRestartButton() {
        if (this.isHuman) {  // On ne configure le bouton qu'une fois
            this.restartButton.addEventListener('click', () => {
                this.gameOverModal.style.display = 'none';
                this.resetGame();
                aiGame.resetGame();  // Redémarrer aussi le jeu de l'IA
            });
        }
    }

    resetGame() {
        this.grid = Array(GRID_HEIGHT).fill().map(() => Array(GRID_WIDTH).fill(0));
        this.score = 0;
        this.gameOver = false;
        this.currentPiece = null;
        this.dropCounter = 0;
        this.lastTime = 0;
        this.nextPiece = null;
        if (this.nextPieceCtx) {
            this.nextPieceCtx.clearRect(0, 0, this.nextPieceCanvas.width, this.nextPieceCanvas.height);
        }
        
        // Réinitialiser l'affichage du score
        const scoreElement = document.getElementById(this.isHuman ? 'humanScore' : 'aiScore');
        scoreElement.textContent = '0';
        
        // Redémarrer le jeu
        this.init();
        if (this.slowdownTimeout) {
            clearTimeout(this.slowdownTimeout);
        }
        this.dropInterval = this.baseDropInterval;
        this.slowdownActive = false;
        this.lastSlowdownScore = 0;
        if (this.rainbowTimeout) {
            clearTimeout(this.rainbowTimeout);
        }
        if (this.rainbowInterval) {
            clearInterval(this.rainbowInterval);
        }
        this.rainbowMode = false;
        this.updateColors();
        if (this.isHuman) {
            this.startRainbowCycle();
        }
    }

    movePiece(dx, dy) {
        this.currentPiece.x += dx;
        this.currentPiece.y += dy;

        if (this.checkCollision()) {
            this.currentPiece.x -= dx;
            this.currentPiece.y -= dy;

            // Si collision en descendant, fixer la pièce
            if (dy > 0) {
                this.lockPiece();
                this.clearLines();
                this.spawnPiece();
            }
        }
        this.draw();
    }

    rotatePiece() {
        const originalShape = this.currentPiece.shape;
        const rotated = this.currentPiece.shape[0].map((_, i) =>
            this.currentPiece.shape.map(row => row[i]).reverse()
        );
        
        const originalRotation = this.currentPiece.rotation || 0;
        this.currentPiece.rotation = ((originalRotation + 1) % 4);
        this.currentPiece.shape = rotated;

        if (this.checkCollision()) {
            this.currentPiece.shape = originalShape;
            this.currentPiece.rotation = originalRotation;
        }
        this.draw();
    }

    checkCollision() {
        return this.currentPiece.shape.some((row, dy) => {
            return row.some((value, dx) => {
                if (value === 0) return false;
                const newX = this.currentPiece.x + dx;
                const newY = this.currentPiece.y + dy;

                return (
                    newX < 0 || // Collision à gauche
                    newX >= GRID_WIDTH || // Collision à droite
                    newY >= GRID_HEIGHT || // Collision en bas
                    (newY >= 0 && this.grid[newY][newX]) // Collision avec une pièce existante
                );
            });
        });
    }

    lockPiece() {
        this.currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    const gridY = y + this.currentPiece.y;
                    const gridX = x + this.currentPiece.x;
                    if (gridY >= 0) {
                        this.grid[gridY][gridX] = this.currentPiece.color;
                    }
                }
            });
        });

        this.checkGameOver();
    }

    clearLines() {
        let linesCleared = 0;
        let clearedLineIndices = [];

        // Trouver toutes les lignes complètes
        for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
            if (this.grid[y].every(cell => cell !== 0)) {
                clearedLineIndices.push(y);
                linesCleared++;
            }
        }
        
        // Si Tetris (4 lignes), proposer l'échange
        if (linesCleared === 4 && this.opponent) {
            // Sauvegarder une ligne pleine pour l'échange
            const fullLine = [...this.grid[clearedLineIndices[0]]];
            this.exchangeLine(fullLine);
        }

        // Supprimer les lignes et mettre à jour le score
        clearedLineIndices.forEach(y => {
            this.grid.splice(y, 1);
            this.grid.unshift(new Array(GRID_WIDTH).fill(0));
        });
        
        if (linesCleared > 0) {
            this.updateScore(linesCleared);
            
            // Si exactement 2 lignes sont complétées, donner un cadeau à l'adversaire
            if (linesCleared === 2 && this.opponent) {
                this.opponent.receiveGift();
            }
        }
    }

    // Nouvelle méthode pour l'échange de lignes
    exchangeLine(fullLine) {
        // Trouver une ligne vide chez l'adversaire
        let emptyLineIndex = this.findEmptyLine(this.opponent.grid);
        if (emptyLineIndex !== -1) {
            // Échanger les lignes
            const emptyLine = [...this.opponent.grid[emptyLineIndex]];
            this.opponent.grid[emptyLineIndex] = fullLine;
            this.grid[this.findFullLine(this.grid)] = emptyLine;

            // Afficher les messages d'échange
            this.showExchangeMessage("Ligne donnée !");
            this.opponent.showExchangeMessage("Ligne reçue !");
        }
    }

    // Nouvelle méthode pour trouver une ligne vide
    findEmptyLine(grid) {
        for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
            if (grid[y].every(cell => cell === 0)) {
                return y;
            }
        }
        return -1;
    }

    // Nouvelle méthode pour trouver une ligne pleine
    findFullLine(grid) {
        for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
            if (grid[y].every(cell => cell !== 0)) {
                return y;
            }
        }
        return -1;
    }

    // Nouvelle méthode pour afficher le message d'échange
    showExchangeMessage(message) {
        const originalFillStyle = this.ctx.fillStyle;
        const originalFont = this.ctx.font;
        const originalTextAlign = this.ctx.textAlign;

        this.ctx.fillStyle = 'rgba(255, 165, 0, 0.7)'; // Orange semi-transparent
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);

        setTimeout(() => {
            this.ctx.fillStyle = originalFillStyle;
            this.ctx.font = originalFont;
            this.ctx.textAlign = originalTextAlign;
            this.draw();
        }, 1000);
    }

    updateScore(linesCleared) {
        const previousScore = this.score;
        const basePoints = 50;
        const bonusPoints = {
            2: 100,
            3: 200,
            4: 300
        };

        this.score += linesCleared * basePoints;
        if (linesCleared in bonusPoints) {
            this.score += bonusPoints[linesCleared];
        }

        // Mise à jour de l'affichage du score
        const scoreElement = document.getElementById(this.isHuman ? 'humanScore' : 'aiScore');
        scoreElement.textContent = this.score;

        // Vérifier si on doit activer le ralentissement
        const previousThousand = Math.floor(previousScore / 1000);
        const currentThousand = Math.floor(this.score / 1000);
        
        if (currentThousand > previousThousand) {
            this.activateSlowdown();
        }
    }

    update(time = 0) {
        if (this.gameOver) return;

        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        this.dropCounter += deltaTime;

        if (!this.isHuman) {
            this.aiUpdate(time);
        } else if (this.dropCounter > this.dropInterval) {
            this.movePiece(0, 1);
            this.dropCounter = 0;
        }

        this.draw();
        if (!this.gameOver) {
            requestAnimationFrame(this.update.bind(this));
        }
    }

    init() {
        this.spawnPiece();
        this.update();
        
        // Démarrer le cycle arc-en-ciel si pas déjà démarré
        if (!this.rainbowInterval && this.isHuman) { // On ne le démarre qu'une fois via le jeu humain
            this.startRainbowCycle();
        }
    }

    // Création d'une nouvelle pièce
    spawnPiece() {
        if (this.nextPiece) {
            // Utiliser la pièce suivante comme pièce courante
            this.currentPiece = this.nextPiece;
        } else {
            // Première pièce du jeu
            const shapes = Object.keys(SHAPES);
            const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
            this.currentPiece = {
                shape: SHAPES[randomShape],
                color: COLORS[randomShape],
                x: Math.floor(GRID_WIDTH / 2) - Math.floor(SHAPES[randomShape][0].length / 2),
                y: 0
            };
        }

        // Générer la prochaine pièce
        const shapes = Object.keys(SHAPES);
        const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
        this.nextPiece = {
            shape: SHAPES[randomShape],
            color: COLORS[randomShape],
            x: Math.floor(GRID_WIDTH / 2) - Math.floor(SHAPES[randomShape][0].length / 2),
            y: 0
        };

        // Afficher la prochaine pièce si c'est le joueur humain
        if (this.isHuman) {
            this.drawNextPiece();
        }

        // Vérifier si la nouvelle pièce peut être placée
        if (this.checkCollision()) {
            this.gameOver = true;
            this.handleGameOver();
        }
    }

    // Nouvelle méthode pour dessiner la prochaine pièce
    drawNextPiece() {
        if (!this.nextPieceCtx || !this.nextPiece) return;

        this.nextPieceCtx.clearRect(0, 0, this.nextPieceCanvas.width, this.nextPieceCanvas.height);
        
        const blockSize = 25;
        const pieceWidth = this.nextPiece.shape[0].length * blockSize;
        const pieceHeight = this.nextPiece.shape.length * blockSize;
        const startX = (this.nextPieceCanvas.width - pieceWidth) / 2;
        const startY = (this.nextPieceCanvas.height - pieceHeight) / 2;

        if (this.rainbowMode) {
            this.nextPieceCtx.shadowColor = this.nextPiece.color;
            this.nextPieceCtx.shadowBlur = 15;
        }

        this.nextPieceCtx.fillStyle = this.nextPiece.color;
        this.nextPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    this.nextPieceCtx.fillRect(
                        startX + x * blockSize,
                        startY + y * blockSize,
                        blockSize - 1,
                        blockSize - 1
                    );
                }
            });
        });

        this.nextPieceCtx.shadowBlur = 0;
    }

    // Dessin du jeu
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Dessin de la grille
        this.grid.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    if (this.rainbowMode) {
                        // Ajouter un effet de lueur
                        this.ctx.shadowColor = value;
                        this.ctx.shadowBlur = 10;
                    } else {
                        this.ctx.shadowBlur = 0;
                    }
                    this.ctx.fillStyle = value;
                    this.ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
                }
            });
        });

        // Dessin de la pièce courante
        if (this.currentPiece) {
            if (this.rainbowMode) {
                this.ctx.shadowColor = this.currentPiece.color;
                this.ctx.shadowBlur = 15;
            }
            this.ctx.fillStyle = this.currentPiece.color;
            this.currentPiece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        this.ctx.fillRect(
                            (this.currentPiece.x + x) * BLOCK_SIZE,
                            (this.currentPiece.y + y) * BLOCK_SIZE,
                            BLOCK_SIZE - 1,
                            BLOCK_SIZE - 1
                        );
                    }
                });
            });
        }
        
        // Réinitialiser les effets de shadow
        this.ctx.shadowBlur = 0;
    }

    // Ajout des méthodes pour l'IA
    aiUpdate(time) {
        if (time - this.aiLastMove > this.aiMoveDelay) {
            this.aiLastMove = time;
            this.makeAiMove();
        }
    }

    makeAiMove() {
        if (!this.currentPiece || this.gameOver) return;

        const bestMove = this.findBestMove();
        if (!bestMove) return;

        // Effectuer les rotations nécessaires
        const currentRotation = this.currentPiece.rotation || 0;
        const rotationsNeeded = (bestMove.rotation - currentRotation + 4) % 4;
        
        for (let i = 0; i < rotationsNeeded; i++) {
            this.rotatePiece();
        }

        // Déplacer horizontalement
        const moveX = bestMove.x - this.currentPiece.x;
        if (moveX > 0) {
            this.movePiece(1, 0);
        } else if (moveX < 0) {
            this.movePiece(-1, 0);
        }

        // Descendre la pièce
        this.movePiece(0, 1);
    }

    findBestMove() {
        let bestScore = -Infinity;
        let bestMove = null;
        const originalPiece = {
            shape: [...this.currentPiece.shape.map(row => [...row])],
            x: this.currentPiece.x,
            y: this.currentPiece.y,
            rotation: this.currentPiece.rotation || 0
        };

        // Tester toutes les rotations possibles
        for (let rotation = 0; rotation < 4; rotation++) {
            let testPiece = {
                ...originalPiece,
                rotation: rotation,
                shape: [...originalPiece.shape.map(row => [...row])]
            };

            // Appliquer la rotation
            for (let r = 0; r < rotation; r++) {
                testPiece.shape = testPiece.shape[0].map((_, i) =>
                    testPiece.shape.map(row => row[i]).reverse()
                );
            }

            // Tester toutes les positions horizontales
            const pieceWidth = testPiece.shape[0].length;
            for (let x = 0; x < GRID_WIDTH - pieceWidth + 1; x++) {
                testPiece.x = x;
                const score = this.evaluatePosition(testPiece);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { x, rotation };
                }
            }
        }

        return bestMove;
    }

    evaluatePosition(piece) {
        let score = 0;
        const testGrid = this.grid.map(row => [...row]);
        let testY = piece.y;

        // Simuler la chute
        while (!this.wouldCollide(piece, testGrid, testY)) {
            testY++;
        }
        testY--;

        // Si la position n'est pas valide, retourner un score très bas
        if (testY < 0) return -999999;

        // Placer la pièce dans la grille de test
        piece.shape.forEach((row, dy) => {
            row.forEach((value, dx) => {
                if (value && testY + dy >= 0) {
                    testGrid[testY + dy][piece.x + dx] = piece.color;
                }
            });
        });

        // Critères d'évaluation révisés
        score += this.evaluateLines(testGrid) * 500;         // Augmenté: Récompense pour les lignes complètes
        score -= this.evaluateHoles(testGrid) * 50;          // Augmenté: Pénalité pour les trous
        score -= this.evaluateHeight(testGrid) * 15;         // Augmenté: Pénalité pour la hauteur
        score += this.evaluateHorizontalFill(testGrid) * 30; // Augmenté: Récompense pour le remplissage horizontal
        score -= this.evaluateUnevenness(testGrid) * 20;     // Nouveau: Pénalité pour les différences de hauteur

        return score;
    }

    evaluateHeight(grid) {
        let maxHeights = 0;
        for (let x = 0; x < GRID_WIDTH; x++) {
            for (let y = 0; y < GRID_HEIGHT; y++) {
                if (grid[y][x] !== 0) {
                    maxHeights += GRID_HEIGHT - y;
                    break;
                }
            }
        }
        return maxHeights / GRID_WIDTH;
    }

    evaluateLines(grid) {
        return grid.filter(row => row.every(cell => cell !== 0)).length;
    }

    evaluateHoles(grid) {
        let holes = 0;
        for (let x = 0; x < GRID_WIDTH; x++) {
            let block = false;
            let columnHoles = 0;
            for (let y = 0; y < GRID_HEIGHT; y++) {
                if (grid[y][x] > 0) {
                    block = true;
                } else if (block) {
                    columnHoles++;
                }
            }
            // Pénaliser plus fortement les trous profonds
            holes += columnHoles * columnHoles;
        }
        return holes;
    }

    evaluateUnevenness(grid) {
        let unevenness = 0;
        let heights = [];

        // Calculer la hauteur de chaque colonne
        for (let x = 0; x < GRID_WIDTH; x++) {
            let height = GRID_HEIGHT;
            for (let y = 0; y < GRID_HEIGHT; y++) {
                if (grid[y][x] !== 0) {
                    height = y;
                    break;
                }
            }
            heights.push(height);
        }

        // Calculer les différences entre colonnes adjacentes
        for (let x = 0; x < GRID_WIDTH - 1; x++) {
            unevenness += Math.abs(heights[x] - heights[x + 1]);
        }

        return unevenness;
    }

    evaluateHorizontalFill(grid) {
        let score = 0;
        for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
            let rowCount = grid[y].filter(cell => cell !== 0).length;
            if (rowCount > 0) {
                // Récompense exponentielle pour les lignes presque complètes
                score += Math.pow(rowCount / GRID_WIDTH, 3) * 100;
                
                // Bonus pour les lignes consécutives
                if (y < GRID_HEIGHT - 1 && grid[y + 1].some(cell => cell !== 0)) {
                    score += rowCount * 2;
                }
            }
        }
        return score;
    }

    wouldCollide(piece, grid, y) {
        return piece.shape.some((row, dy) => {
            return row.some((value, dx) => {
                if (!value) return false;
                const newX = piece.x + dx;
                const newY = y + dy;
                return (
                    newX < 0 ||
                    newX >= GRID_WIDTH ||
                    newY >= GRID_HEIGHT ||
                    (newY >= 0 && grid[newY][newX])
                );
            });
        });
    }

    // Nouvelle méthode pour vérifier si le jeu est terminé
    checkGameOver() {
        // Vérifie si des blocs atteignent le haut de la grille
        const topRowOccupied = this.grid[0].some(cell => cell !== 0) || 
                              this.grid[1].some(cell => cell !== 0);
        
        if (topRowOccupied) {
            this.gameOver = true;
            this.handleGameOver();
            return true;
        }
        return false;
    }

    // Nouvelle méthode pour gérer la fin de partie
    handleGameOver() {
        console.log(`Game Over - ${this.isHuman ? 'Human' : 'AI'} - Score: ${this.score}`);
        
        // Afficher "Game Over" sur le canvas
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = 'red';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Game Over', this.canvas.width / 2, this.canvas.height / 2);
        
        if (this.gameOverCallback) {
            this.gameOverCallback(this.score);
        }

        // Mettre à jour et afficher le modal
        document.getElementById('finalHumanScore').textContent = humanGame.score;
        document.getElementById('finalAIScore').textContent = aiGame.score;
        this.gameOverModal.style.display = 'block';
    }

    // Nouvelle méthode pour recevoir un cadeau
    receiveGift() {
        // Sauvegarder la pièce actuelle
        const currentPiece = this.currentPiece;
        
        // Forcer la prochaine pièce à être un carré ou une ligne
        const easyPieces = ['O', 'I']; // O pour carré, I pour ligne
        const randomEasyPiece = easyPieces[Math.floor(Math.random() * easyPieces.length)];
        
        this.currentPiece = {
            shape: SHAPES[randomEasyPiece],
            color: COLORS[randomEasyPiece],
            x: Math.floor(GRID_WIDTH / 2) - Math.floor(SHAPES[randomEasyPiece][0].length / 2),
            y: 0
        };

        // Afficher un message de cadeau
        this.showGiftMessage();
    }

    // Nouvelle méthode pour afficher le message de cadeau
    showGiftMessage() {
        const originalFillStyle = this.ctx.fillStyle;
        const originalFont = this.ctx.font;
        const originalTextAlign = this.ctx.textAlign;

        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Cadeau !', this.canvas.width / 2, this.canvas.height / 2);

        // Restaurer les styles originaux après 1 seconde
        setTimeout(() => {
            this.ctx.fillStyle = originalFillStyle;
            this.ctx.font = originalFont;
            this.ctx.textAlign = originalTextAlign;
            this.draw();
        }, 1000);
    }

    // Nouvelle méthode pour activer le ralentissement
    activateSlowdown() {
        // Activer le ralentissement pour les deux joueurs
        humanGame.applySlowdown();
        aiGame.applySlowdown();
    }

    // Nouvelle méthode pour appliquer le ralentissement
    applySlowdown() {
        if (this.slowdownTimeout) {
            clearTimeout(this.slowdownTimeout);
        }

        // Ralentir de 20%
        this.dropInterval = this.baseDropInterval * 1.2;
        if (!this.isHuman) {
            this.aiMoveDelay = this.aiMoveDelay * 1.2;
        }
        
        this.slowdownActive = true;
        this.showSlowdownMessage();

        // Restaurer la vitesse normale après 10 secondes
        this.slowdownTimeout = setTimeout(() => {
            this.dropInterval = this.baseDropInterval;
            if (!this.isHuman) {
                this.aiMoveDelay = this.aiMoveDelay / 1.2;
            }
            this.slowdownActive = false;
        }, 10000);
    }

    // Nouvelle méthode pour afficher le message de ralentissement
    showSlowdownMessage() {
        const originalFillStyle = this.ctx.fillStyle;
        const originalFont = this.ctx.font;
        const originalTextAlign = this.ctx.textAlign;

        this.ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Ralentissement !', this.canvas.width / 2, this.canvas.height / 2);

        setTimeout(() => {
            this.ctx.fillStyle = originalFillStyle;
            this.ctx.font = originalFont;
            this.ctx.textAlign = originalTextAlign;
            this.draw();
        }, 1000);
    }

    // Nouvelle méthode pour démarrer le cycle arc-en-ciel
    startRainbowCycle() {
        this.rainbowInterval = setInterval(() => {
            this.activateRainbowMode();
        }, 30000); // Modifié de 120000 (2 minutes) à 30000 (30 secondes)
    }

    // Nouvelle méthode pour activer le mode arc-en-ciel
    activateRainbowMode() {
        // Activer pour les deux joueurs
        humanGame.applyRainbowMode(true);
        aiGame.applyRainbowMode(true);

        // Désactiver après 20 secondes
        if (this.rainbowTimeout) {
            clearTimeout(this.rainbowTimeout);
        }
        
        this.rainbowTimeout = setTimeout(() => {
            humanGame.applyRainbowMode(false);
            aiGame.applyRainbowMode(false);
        }, 20000);
    }

    // Nouvelle méthode pour appliquer/désactiver le mode arc-en-ciel
    applyRainbowMode(activate) {
        this.rainbowMode = activate;
        if (activate) {
            this.showRainbowMessage();
        }
        this.updateColors();
    }

    // Nouvelle méthode pour mettre à jour les couleurs
    updateColors() {
        if (this.rainbowMode) {
            // Générer des couleurs vives et brillantes aléatoires
            Object.keys(COLORS).forEach(shape => {
                COLORS[shape] = this.generateRainbowColor();
            });

            // Ajouter un effet de brillance aux pièces
            if (this.currentPiece) {
                this.currentPiece.glow = true;
            }
            if (this.nextPiece) {
                this.nextPiece.glow = true;
            }
        } else {
            // Restaurer les couleurs originales
            Object.keys(COLORS).forEach(shape => {
                COLORS[shape] = this.originalColors[shape];
            });

            // Retirer l'effet de brillance
            if (this.currentPiece) {
                this.currentPiece.glow = false;
            }
            if (this.nextPiece) {
                this.nextPiece.glow = false;
            }
        }

        this.draw();
        if (this.isHuman) {
            this.drawNextPiece();
        }
    }

    // Nouvelle méthode pour générer une couleur vive et brillante aléatoire
    generateRainbowColor() {
        const hue = Math.random() * 360;
        const saturation = 100; // Maximum saturation
        const lightness = 60; // Plus de luminosité (50-70 est un bon range pour des couleurs vives)
        const alpha = 0.9; // Légère transparence pour l'effet brillant
        return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
    }

    // Nouvelle méthode pour afficher le message arc-en-ciel
    showRainbowMessage() {
        const originalFillStyle = this.ctx.fillStyle;
        const originalFont = this.ctx.font;
        const originalTextAlign = this.ctx.textAlign;

        this.ctx.fillStyle = 'rgba(255, 192, 203, 0.7)'; // Rose semi-transparent
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Mode Arc-en-ciel !', this.canvas.width / 2, this.canvas.height / 2);

        setTimeout(() => {
            this.ctx.fillStyle = originalFillStyle;
            this.ctx.font = originalFont;
            this.ctx.textAlign = originalTextAlign;
            this.draw();
        }, 1000);
    }
}

// Initialisation des jeux
const humanGame = new TetrisGame('humanCanvas');
const aiGame = new TetrisGame('aiCanvas');

// Lier les adversaires
humanGame.opponent = aiGame;
aiGame.opponent = humanGame;

// Ajouter des callbacks de fin de partie
humanGame.gameOverCallback = (score) => {
    console.log('Human game over with score:', score);
    aiGame.gameOver = true;
};

aiGame.gameOverCallback = (score) => {
    console.log('AI game over with score:', score);
    humanGame.gameOver = true;
};

// Démarrage des jeux
humanGame.init();
aiGame.init(); 
aiGame.init(); 