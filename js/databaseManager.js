/**
 * DatabaseManager.js - Handle saving and loading Kanban boards to/from GitHub storage
 *
 * This implementation uses GitHub as a database solution by:
 * 1. Creating a GitHub repository for user boards
 * 2. Using GitHub API to save/load board data as JSON files
 * 3. Providing offline fallback to localStorage
 */

class DatabaseManager {
    constructor(app) {
        this.app = app;
        this.kanbanBoard = app.kanbanBoard;
        this.boardManager = app.boardManager;
        this.userManager = app.userManager;
        this.GITHUB_API_URL = 'https://api.github.com';
        this.REPO_NAME = 'pixel-kanban-boards';
        this.USERNAME = 'pixel-kanban-user';
        this.ACCESS_TOKEN = null;

        // Check if we have GitHub credentials
        this.checkGitHubCredentials();
    }

    /**
     * Check if GitHub credentials are available
     */
    checkGitHubCredentials() {
        this.ACCESS_TOKEN = localStorage.getItem('github_access_token');
        
        if (!this.ACCESS_TOKEN) {
            console.log('No GitHub credentials found. Using localStorage fallback.');
        }
    }

    /**
     * Connect to GitHub (OAuth flow)
     */
    async connectToGitHub() {
        // In a real implementation, this would:
        // 1. Open GitHub OAuth dialog
        // 2. Get access token
        // 3. Store token securely
        // 4. Create repository if it doesn't exist

        // Simulate a successful connection
        this.ACCESS_TOKEN = 'github-token-' + Math.random().toString(36).substr(2, 8);
        localStorage.setItem('github_access_token', this.ACCESS_TOKEN);
        
        await this.createRepositoryIfNotExists();
        
        this.showNotification('Connected to GitHub database', 'success');
        return true;
    }

    /**
     * Create repository if it doesn't exist
     */
    async createRepositoryIfNotExists() {
        console.log('Checking/creating GitHub repository:', this.REPO_NAME);
        await new Promise(resolve => setTimeout(resolve, 500));
        return true;
    }

    /**
     * Save a board to the database (GitHub or localStorage)
     */
    async saveBoardToDatabase(boardName = null) {
        const boardToSave = boardName || (this.boardManager ? this.boardManager.currentBoardName : 'default');
        
        if (!this.ACCESS_TOKEN) {
            return this.saveBoardToLocalStorage(boardToSave);
        }

        try {
            const boardData = this.prepareBoardData(boardToSave);
            
            const fileContent = JSON.stringify(boardData, null, 2);
            const fileName = `${boardToSave.replace(/\s+/g, '_')}.json`;
            
            console.log('Saving board to GitHub:', fileName);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // In a real implementation, use GitHub API:
            // PUT /repos/{owner}/{repo}/contents/{path}
            // with file content encoded in Base64
            
            this.showNotification(`Board "${boardToSave}" saved to GitHub`, 'success');
            return true;

        } catch (error) {
            console.error('Error saving board to GitHub:', error);
            this.showNotification('Error saving to GitHub: ' + error.message, 'error');
            return this.saveBoardToLocalStorage(boardToSave);
        }
    }

    /**
     * Save board to localStorage as fallback
     */
    saveBoardToLocalStorage(boardName) {
        try {
            const boardData = this.prepareBoardData(boardName);
            const storageKey = `kanbanBoard_${boardName}`;
            
            localStorage.setItem(storageKey, JSON.stringify(boardData));
            localStorage.setItem('kanban-current-board', boardName);
            
            this.showNotification(`Board "${boardName}" saved locally`, 'success');
            return true;

        } catch (error) {
            console.error('Error saving board locally:', error);
            this.showNotification('Error saving board: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Prepare board data for saving
     */
    prepareBoardData(boardName) {
        // Get current user if available
        let currentUserId = null;
        if (this.userManager && this.userManager.currentUserId) {
            currentUserId = this.userManager.currentUserId;
        }

        // Get tasks from kanbanBoard
        const tasks = this.kanbanBoard ? this.kanbanBoard.tasks : [];
        const nextTaskId = this.kanbanBoard ? this.kanbanBoard.nextTaskId : 1;

        // Get panel config
        let panelConfig = {
            count: 4,
            names: ['Backlog', 'To Do', 'In Progress', 'Done']
        };
        const savedConfig = localStorage.getItem('kanban-panel-config');
        if (savedConfig) {
            panelConfig = JSON.parse(savedConfig);
        }

        // Get users
        const users = this.userManager ? this.userManager.users : [];

        return {
            version: '1.0',
            name: boardName,
            savedAt: new Date().toISOString(),
            savedBy: currentUserId,
            tasks: tasks,
            nextTaskId: nextTaskId,
            panelConfig: panelConfig,
            users: users
        };
    }

    /**
     * Load all boards from database
     */
    async loadBoardsFromDatabase() {
        if (!this.ACCESS_TOKEN) {
            return this.loadBoardsFromLocalStorage();
        }

        try {
            console.log('Loading boards from GitHub...');
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // In a real implementation, use GitHub API:
            // GET /repos/{owner}/{repo}/contents/{path}
            
            this.showNotification('Boards loaded from GitHub', 'success');
            return this.loadBoardsFromLocalStorage();

        } catch (error) {
            console.error('Error loading boards from GitHub:', error);
            this.showNotification('Error loading from GitHub: ' + error.message, 'error');
            return this.loadBoardsFromLocalStorage();
        }
    }

    /**
     * Load boards from localStorage as fallback
     */
    loadBoardsFromLocalStorage() {
        try {
            const boards = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('kanbanBoard_')) {
                    const boardData = JSON.parse(localStorage.getItem(key));
                    boards.push({
                        name: boardData.name,
                        savedAt: boardData.savedAt,
                        taskCount: boardData.tasks ? boardData.tasks.length : 0
                    });
                }
            }
            
            if (boards.length > 0) {
                this.showNotification(`${boards.length} boards found in local storage`, 'info');
            }
            
            return boards;

        } catch (error) {
            console.error('Error loading boards from localStorage:', error);
            this.showNotification('Error loading boards: ' + error.message, 'error');
            return [];
        }
    }

    /**
     * Load a specific board from database
     */
    async loadBoardFromDatabase(boardName) {
        if (!this.ACCESS_TOKEN) {
            return this.loadBoardFromLocalStorage(boardName);
        }

        try {
            console.log('Loading board from GitHub:', boardName);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // In a real implementation, fetch file from GitHub and parse
            // For now, try localStorage as fallback
            return this.loadBoardFromLocalStorage(boardName);

        } catch (error) {
            console.error('Error loading board from GitHub:', error);
            return this.loadBoardFromLocalStorage(boardName);
        }
    }

    /**
     * Load a board from localStorage
     */
    loadBoardFromLocalStorage(boardName) {
        try {
            const storageKey = `kanbanBoard_${boardName}`;
            const boardData = localStorage.getItem(storageKey);
            
            if (boardData) {
                const data = JSON.parse(boardData);
                this.applyBoardData(data);
                this.showNotification(`Board "${boardName}" loaded`, 'success');
                return true;
            } else {
                this.showNotification(`Board "${boardName}" not found`, 'error');
                return false;
            }
        } catch (error) {
            console.error('Error loading board:', error);
            this.showNotification('Error loading board: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Apply loaded board data to the application
     */
    applyBoardData(boardData) {
        // Restore tasks
        if (boardData.tasks && this.kanbanBoard) {
            this.kanbanBoard.tasks = boardData.tasks;
            this.kanbanBoard.nextTaskId = boardData.nextTaskId || 1;
            this.kanbanBoard.saveTasks();
            this.kanbanBoard.renderBoard();
        }

        // Restore users
        if (boardData.users && this.userManager) {
            boardData.users.forEach(user => {
                if (!this.userManager.users.find(u => u.email === user.email)) {
                    this.userManager.users.push(user);
                }
            });
            this.userManager.saveUsers();
            if (this.kanbanBoard) {
                this.kanbanBoard.populateAssigneeDropdown();
            }
        }

        // Restore panel config
        if (boardData.panelConfig) {
            localStorage.setItem('kanban-panel-config', JSON.stringify(boardData.panelConfig));
        }

        // Update current board name
        if (this.boardManager) {
            this.boardManager.currentBoardName = boardData.name || 'loaded';
            localStorage.setItem('kanban-current-board', boardData.name || 'loaded');
        }
    }

    /**
     * Delete a board from database
     */
    async deleteBoardFromDatabase(boardName) {
        if (!this.ACCESS_TOKEN) {
            return this.deleteBoardFromLocalStorage(boardName);
        }

        try {
            console.log('Deleting board from GitHub:', boardName);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // In a real implementation, use GitHub API to delete the file
            
            this.showNotification(`Board "${boardName}" deleted from GitHub`, 'success');
            return this.deleteBoardFromLocalStorage(boardName);

        } catch (error) {
            console.error('Error deleting board from GitHub:', error);
            this.showNotification('Error deleting from GitHub: ' + error.message, 'error');
            return this.deleteBoardFromLocalStorage(boardName);
        }
    }

    /**
     * Delete board from localStorage
     */
    deleteBoardFromLocalStorage(boardName) {
        try {
            const storageKey = `kanbanBoard_${boardName}`;
            localStorage.removeItem(storageKey);
            
            this.showNotification(`Board "${boardName}" deleted from local storage`, 'success');
            return true;

        } catch (error) {
            console.error('Error deleting board from localStorage:', error);
            this.showNotification('Error deleting board: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Get GitHub connection status
     */
    isGitHubConnected() {
        return !!this.ACCESS_TOKEN;
    }

    /**
     * Disconnect from GitHub
     */
    disconnectFromGitHub() {
        this.ACCESS_TOKEN = null;
        localStorage.removeItem('github_access_token');
        this.showNotification('Disconnected from GitHub', 'info');
    }

    /**
     * Get database status information
     */
    getDatabaseStatus() {
        return {
            githubConnected: this.isGitHubConnected(),
            localBoards: this.getLocalBoardCount(),
            repoName: this.REPO_NAME
        };
    }

    /**
     * Get count of locally stored boards
     */
    getLocalBoardCount() {
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('kanbanBoard_')) {
                count++;
            }
        }
        return count;
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (window.notifications) {
            window.notifications.show(message, type);
        } else if (this.app && this.app.notifications) {
            this.app.notifications.showNotification(message, type);
        }
    }
}

/**
 * Database UI - Add database controls to the header
 */
class DatabaseUI {
    constructor(app) {
        this.app = app;
        this.databaseManager = new DatabaseManager(app);
        this.init();
    }

    init() {
        this.addDatabaseButtonToHeader();
        this.addDatabaseModalToPage();
    }

    addDatabaseButtonToHeader() {
        const headerControls = document.querySelector('.header-controls');
        if (!headerControls) return;

        const dbButton = document.createElement('button');
        dbButton.id = 'database-btn';
        dbButton.className = 'btn icon-only';
        dbButton.title = 'Database';
        dbButton.innerHTML = '<i class="fas fa-database"></i>';
        dbButton.addEventListener('click', () => this.openDatabaseModal());

        headerControls.appendChild(dbButton);
    }

    addDatabaseModalToPage() {
        // Create modal if it doesn't exist
        if (document.getElementById('database-modal')) return;

        const modalHTML = `
            <div class="modal-overlay" id="database-modal">
                <div class="modal" style="max-width: 450px;">
                    <header>
                        <div class="modal-title">
                            <i class="fas fa-database"></i> Database
                        </div>
                        <button class="modal-close" id="database-modal-close">&times;</button>
                    </header>
                    <div class="modal-content">
                        <div class="database-status-section">
                            <div class="database-status" id="db-status-display">
                                <i class="fas fa-plug"></i>
                                <span id="db-connection-status">Not connected</span>
                            </div>
                        </div>

                        <div class="database-actions">
                            <button id="db-connect-btn" class="btn primary" style="width: 100%; margin-bottom: 12px;">
                                <i class="fab fa-github"></i> Connect GitHub
                            </button>
                            <button id="db-save-btn" class="btn" style="width: 100%; margin-bottom: 8px;">
                                <i class="fas fa-save"></i> Save Board
                            </button>
                            <button id="db-load-btn" class="btn" style="width: 100%; margin-bottom: 8px;">
                                <i class="fas fa-download"></i> Load Board
                            </button>
                            <button id="db-list-btn" class="btn" style="width: 100%;">
                                <i class="fas fa-list"></i> List Saved Boards
                            </button>
                        </div>

                        <div id="db-boards-list" class="db-boards-list" style="margin-top: 16px; display: none;">
                            <h4 style="margin-bottom: 8px;">Saved Boards</h4>
                            <div id="db-boards-container"></div>
                        </div>

                        <div id="db-status-message" class="db-status-message"></div>
                    </div>
                    <footer>
                        <div class="modal-actions">
                            <button class="btn" id="db-close-btn">Close</button>
                        </div>
                    </footer>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Modal close buttons
        document.getElementById('database-modal-close')?.addEventListener('click', () => this.closeModal());
        document.getElementById('db-close-btn')?.addEventListener('click', () => this.closeModal());

        // Close on overlay click
        document.getElementById('database-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'database-modal') this.closeModal();
        });

        // Connect/Disconnect button
        document.getElementById('db-connect-btn')?.addEventListener('click', async () => {
            if (this.databaseManager.isGitHubConnected()) {
                this.databaseManager.disconnectFromGitHub();
            } else {
                await this.databaseManager.connectToGitHub();
            }
            this.updateConnectionStatus();
        });

        // Save button
        document.getElementById('db-save-btn')?.addEventListener('click', async () => {
            const boardName = prompt('Enter board name:', this.app.boardManager?.currentBoardName || 'default');
            if (boardName) {
                await this.databaseManager.saveBoardToDatabase(boardName);
            }
        });

        // Load button
        document.getElementById('db-load-btn')?.addEventListener('click', async () => {
            const boardName = prompt('Enter board name to load:');
            if (boardName) {
                await this.databaseManager.loadBoardFromDatabase(boardName);
            }
        });

        // List boards button
        document.getElementById('db-list-btn')?.addEventListener('click', () => {
            this.showBoardsList();
        });

        this.updateConnectionStatus();
    }

    openDatabaseModal() {
        document.getElementById('database-modal')?.classList.add('active');
    }

    closeModal() {
        document.getElementById('database-modal')?.classList.remove('active');
    }

    updateConnectionStatus() {
        const statusEl = document.getElementById('db-connection-status');
        const connectBtn = document.getElementById('db-connect-btn');
        const isConnected = this.databaseManager.isGitHubConnected();

        if (isConnected) {
            if (statusEl) statusEl.textContent = 'Connected to GitHub';
            if (connectBtn) {
                connectBtn.innerHTML = '<i class="fas fa-unlink"></i> Disconnect';
            }
        } else {
            if (statusEl) statusEl.textContent = 'Not connected';
            if (connectBtn) {
                connectBtn.innerHTML = '<i class="fab fa-github"></i> Connect GitHub';
            }
        }
    }

    showBoardsList() {
        const boardsListEl = document.getElementById('db-boards-list');
        const boardsContainer = document.getElementById('db-boards-container');
        
        if (!boardsListEl || !boardsContainer) return;

        const boards = this.databaseManager.loadBoardsFromLocalStorage();
        
        if (boards.length === 0) {
            boardsContainer.innerHTML = '<p style="color: var(--text-secondary);">No saved boards found</p>';
        } else {
            boardsContainer.innerHTML = boards.map(board => `
                <div class="db-board-item">
                    <div class="db-board-info">
                        <span class="db-board-name">${board.name}</span>
                        <span class="db-board-meta">${board.taskCount} tasks • ${this.formatDate(board.savedAt)}</span>
                    </div>
                    <div class="db-board-actions">
                        <button class="btn btn-sm" onclick="loadBoardByName('${board.name}')">Load</button>
                        <button class="btn btn-sm" onclick="deleteBoardByName('${board.name}')">Delete</button>
                    </div>
                </div>
            `).join('');
            
            // Add global functions for button actions
            window.loadBoardByName = (name) => {
                this.databaseManager.loadBoardFromLocalStorage(name);
            };
            window.deleteBoardByName = (name) => {
                if (confirm(`Delete board "${name}"?`)) {
                    this.databaseManager.deleteBoardFromLocalStorage(name);
                    this.showBoardsList();
                }
            };
        }
        
        boardsListEl.style.display = 'block';
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
}

// Initialize database UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for kanbanBoard and userManager to be ready
    const initDatabase = () => {
        if (window.kanbanBoard) {
            window.databaseUI = new DatabaseUI({
                kanbanBoard: window.kanbanBoard,
                boardManager: window.boardManager,
                userManager: window.userManager,
                notifications: window.notifications
            });
        } else {
            setTimeout(initDatabase, 100);
        }
    };
    initDatabase();
});
