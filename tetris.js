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
        this.dropInterval = 1000; // Temps en ms entre chaque descente automatique
        this.lastTime = 0;
        
        if (this.isHuman) {
            this.setupControls();
        }
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
        // Création d'une nouvelle matrice pour la rotation
        this.currentPiece.shape = this.currentPiece.shape[0].map((_, i) =>
            this.currentPiece.shape.map(row => row[i]).reverse()
        );

        // Annuler la rotation si elle cause une collision
        if (this.checkCollision()) {
            this.currentPiece.shape = originalShape;
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
    }

    clearLines() {
        let linesCleared = 0;
        for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
            if (this.grid[y].every(cell => cell !== 0)) {
                // Supprimer la ligne complète
                this.grid.splice(y, 1);
                // Ajouter une nouvelle ligne vide en haut
                this.grid.unshift(new Array(GRID_WIDTH).fill(0));
                linesCleared++;
                y++; // Vérifier la même position après avoir fait descendre les lignes
            }
        }
        
        // Mise à jour du score
        if (linesCleared > 0) {
            this.updateScore(linesCleared);
        }
    }

    updateScore(linesCleared) {
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
    }

    update(time = 0) {
        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        this.dropCounter += deltaTime;

        if (this.dropCounter > this.dropInterval) {
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
    }

    // Création d'une nouvelle pièce
    spawnPiece() {
        const shapes = Object.keys(SHAPES);
        const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
        this.currentPiece = {
            shape: SHAPES[randomShape],
            color: COLORS[randomShape],
            x: Math.floor(GRID_WIDTH / 2) - Math.floor(SHAPES[randomShape][0].length / 2),
            y: 0
        };
    }

    // Dessin du jeu
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Dessin de la grille
        this.grid.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    this.ctx.fillStyle = value;
                    this.ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
                }
            });
        });

        // Dessin de la pièce courante
        if (this.currentPiece) {
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
    }
}

// Initialisation des jeux
const humanGame = new TetrisGame('humanCanvas');
const aiGame = new TetrisGame('aiCanvas');

// Démarrage des jeux
humanGame.init();
aiGame.init(); 