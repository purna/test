/**
 * Board Manager - Handles saving, loading, and exporting Kanban boards
 */
class BoardManager {
    constructor(kanbanBoard, userManager) {
        this.kanbanBoard = kanbanBoard;
        this.userManager = userManager;
        this.currentBoardName = 'default';
        this.savedBoards = {};
        this.init();
    }

    init() {
        this.loadSavedBoardsList();
        this.setupEventListeners();
    }

    // Save board to browser storage
    saveBoard(boardName = this.currentBoardName) {
        // Get current user if available
        let currentUserId = null;
        if (this.userManager && this.userManager.currentUserId) {
            currentUserId = this.userManager.currentUserId;
        }

        // Get panel config
        let panelConfig = {
            count: 4,
            names: ['Backlog', 'To Do', 'In Progress', 'Done']
        };
        const savedConfig = localStorage.getItem('kanban-panel-config');
        if (savedConfig) {
            panelConfig = JSON.parse(savedConfig);
        }

        const boardData = {
            name: boardName,
            createdBy: currentUserId,
            tasks: this.kanbanBoard.tasks,
            nextTaskId: this.kanbanBoard.nextTaskId,
            panelConfig: panelConfig,
            users: this.userManager ? this.userManager.users : [],
            savedAt: new Date().toISOString()
        };

        // Save to localStorage
        this.savedBoards[boardName] = boardData;
        this.currentBoardName = boardName;
        localStorage.setItem('kanban-saved-boards', JSON.stringify(this.savedBoards));
        localStorage.setItem('kanban-current-board', boardName);

        this.showNotification(`Board "${boardName}" saved successfully`, 'success');
        return boardData;
    }

    // Load a saved board
    loadBoard(boardName) {
        if (this.savedBoards[boardName]) {
            const boardData = this.savedBoards[boardName];
            
            // Restore tasks
            this.kanbanBoard.tasks = boardData.tasks || [];
            this.kanbanBoard.nextTaskId = boardData.nextTaskId || 1;
            
            // Restore panel config
            if (boardData.panelConfig) {
                localStorage.setItem('kanban-panel-config', JSON.stringify(boardData.panelConfig));
            }
            
            this.kanbanBoard.saveTasks();
            this.kanbanBoard.renderBoard();
            
            // Restore users if available
            if (boardData.users && this.userManager) {
                this.userManager.users = boardData.users;
                this.userManager.saveUsers();
                if (window.kanbanBoard) {
                    window.kanbanBoard.populateAssigneeDropdown();
                }
            }
            
            this.currentBoardName = boardName;
            localStorage.setItem('kanban-current-board', boardName);
            
            // Show notification using settingsManager format
            if (window.settingsManager) {
                window.settingsManager.showNotification(`Board "${boardName}" loaded`, 'success');
            } else {
                this.showNotification(`Board "${boardName}" loaded`, 'success');
            }
            return true;
        }
        return false;
    }

    // Delete a saved board
    deleteBoard(boardName) {
        if (this.savedBoards[boardName]) {
            delete this.savedBoards[boardName];
            localStorage.setItem('kanban-saved-boards', JSON.stringify(this.savedBoards));
            this.showNotification(`Board "${boardName}" deleted`, 'info');
            return true;
        }
        return false;
    }

    // Export board as JSON file
    exportBoardJSON() {
        const boardData = {
            version: '1.0',
            name: this.currentBoardName,
            exportedAt: new Date().toISOString(),
            tasks: this.kanbanBoard.tasks,
            nextTaskId: this.kanbanBoard.nextTaskId,
            users: this.userManager ? this.userManager.users : []
        };

        const jsonString = JSON.stringify(boardData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `kanban-board-${this.currentBoardName}-${this.getDateString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Board exported as JSON', 'success');
    }

    // Import board from JSON file
    importBoardJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const boardData = JSON.parse(e.target.result);
                    
                    if (boardData.tasks) {
                        this.kanbanBoard.tasks = boardData.tasks;
                        this.kanbanBoard.nextTaskId = boardData.nextTaskId || 1;
                        this.kanbanBoard.saveTasks();
                        this.kanbanBoard.renderBoard();
                        
                        // Import users if present
                        if (boardData.users && this.userManager) {
                            boardData.users.forEach(user => {
                                if (!this.userManager.users.find(u => u.email === user.email)) {
                                    this.userManager.users.push(user);
                                }
                            });
                            this.userManager.saveUsers();
                            if (window.kanbanBoard) {
                                window.kanbanBoard.populateAssigneeDropdown();
                            }
                        }

                        this.showNotification('Board imported successfully', 'success');
                        resolve(true);
                    } else {
                        this.showNotification('Invalid board file format', 'error');
                        reject(new Error('Invalid format'));
                    }
                } catch (error) {
                    this.showNotification('Failed to parse board file', 'error');
                    reject(error);
                }
            };
            reader.onerror = () => {
                this.showNotification('Failed to read file', 'error');
                reject(new Error('Read error'));
            };
            reader.readAsText(file);
        });
    }

    // Load saved boards list from storage
    loadSavedBoardsList() {
        const savedBoards = localStorage.getItem('kanban-saved-boards');
        if (savedBoards) {
            this.savedBoards = JSON.parse(savedBoards);
        }

        const currentBoard = localStorage.getItem('kanban-current-board');
        if (currentBoard) {
            this.currentBoardName = currentBoard;
        }
    }

    // Get list of saved board names
    getSavedBoardNames() {
        return Object.keys(this.savedBoards);
    }

    // Get formatted date string
    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    // Setup event listeners
    setupEventListeners() {
        // Save board button
        const saveBoardBtn = document.getElementById('save-board-btn');
        if (saveBoardBtn) {
            saveBoardBtn.addEventListener('click', () => {
                const boardName = prompt('Enter board name:', this.currentBoardName);
                if (boardName) {
                    this.saveBoard(boardName);
                }
            });
        }
    }

    // Show notification
    showNotification(message, type = 'info') {
        if (window.notifications) {
            window.notifications.show(message, type);
        }
    }
}

// Initialize board manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for kanbanBoard and userManager to be ready
    const initBoardManager = () => {
        if (window.kanbanBoard && window.userManager) {
            window.boardManager = new BoardManager(window.kanbanBoard, window.userManager);
        } else {
            // Try again in 50ms
            setTimeout(initBoardManager, 50);
        }
    };
    initBoardManager();
});
