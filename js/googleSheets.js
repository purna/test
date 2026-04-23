/**
 * Google Sheets Integration - Save and Load Kanban Boards
 * Uses Google Sheets API v4 with OAuth2 authentication
 */
class GoogleSheetsManager {
    constructor() {
        this.apiKey = null;
        this.clientId = null;
        this.accessToken = null;
        this.isSignedIn = false;
        this.init();
    }

    init() {
        this.loadCredentials();
        this.setupEventListeners();
        this.checkAuthStatus();
        // Listen for custom events from settings manager
        window.addEventListener('open-google-sheets', () => this.openModal());
    }

    loadCredentials() {
        // Load credentials from localStorage or environment
        this.apiKey = localStorage.getItem('google_sheets_api_key') || 'YOUR_API_KEY';
        this.clientId = localStorage.getItem('google_client_id') || 'YOUR_CLIENT_ID.apps.googleusercontent.com';
    }

    setupEventListeners() {
        // Open Google Sheets modal
        const gsModalBtn = document.getElementById('google-sheets-btn');
        if (gsModalBtn) {
            gsModalBtn.addEventListener('click', () => this.openModal());
        }

        // Modal close buttons
        const closeBtn = document.getElementById('google-sheets-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        const closeFooterBtn = document.getElementById('google-sheets-close-btn');
        if (closeFooterBtn) {
            closeFooterBtn.addEventListener('click', () => this.closeModal());
        }

        // Save/Load/Create buttons
        const saveBtn = document.getElementById('gs-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveToSheet());
        }

        const loadBtn = document.getElementById('gs-load-btn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadFromSheet());
        }

        const createBtn = document.getElementById('gs-create-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.createNewSheet());
        }

        // Close modal on overlay click
        const modal = document.getElementById('google-sheets-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'google-sheets-modal') {
                    this.closeModal();
                }
            });
        }

        // Google Sign-In callback
        window.handleGoogleSignIn = (response) => this.handleSignIn(response);
    }

    checkAuthStatus() {
        // Check if user is already signed in
        const savedToken = localStorage.getItem('google_access_token');
        if (savedToken) {
            this.accessToken = savedToken;
            this.isSignedIn = true;
            this.updateSignedInView();
        }
    }

    handleSignIn(response) {
        if (response.credential) {
            this.accessToken = response.credential;
            this.isSignedIn = true;
            localStorage.setItem('google_access_token', this.accessToken);
            this.updateSignedInView();
            this.showStatus('Successfully signed in with Google', 'success');
        } else {
            this.showStatus('Sign-in failed. Please try again.', 'error');
        }
    }

    signOut() {
        this.accessToken = null;
        this.isSignedIn = false;
        localStorage.removeItem('google_access_token');
        this.updateSignedInView();
        this.showStatus('Signed out successfully', 'info');
    }

    updateSignedInView() {
        const authSection = document.getElementById('google-sheets-auth');
        const signedInSection = document.getElementById('google-sheets-signedin');

        if (this.isSignedIn) {
            if (authSection) authSection.style.display = 'none';
            if (signedInSection) signedInSection.style.display = 'block';
        } else {
            if (authSection) authSection.style.display = 'block';
            if (signedInSection) signedInSection.style.display = 'none';
        }
    }

    openModal() {
        const modal = document.getElementById('google-sheets-modal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    closeModal() {
        const modal = document.getElementById('google-sheets-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    getSpreadsheetId(url) {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : null;
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('gs-status');
        if (statusEl) {
            statusEl.innerHTML = `<div class="gs-status-${type}">${message}</div>`;
            statusEl.style.display = 'block';

            // Auto-hide after 5 seconds
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 5000);
        }
    }

    // Save board data to Google Sheets
    async saveToSheet() {
        if (!this.isSignedIn) {
            this.showStatus('Please sign in with Google first', 'error');
            return;
        }

        const spreadsheetUrl = document.getElementById('gs-spreadsheet-url').value;
        const sheetName = document.getElementById('gs-sheet-name').value || 'Kanban';

        if (!spreadsheetUrl) {
            this.showStatus('Please enter a Google Sheets URL', 'error');
            return;
        }

        const spreadsheetId = this.getSpreadsheetId(spreadsheetUrl);
        if (!spreadsheetId) {
            this.showStatus('Invalid Google Sheets URL', 'error');
            return;
        }

        this.showStatus('Saving board to Google Sheets...', 'info');

        try {
            // Prepare board data for sheets
            const boardData = this.prepareBoardData();

            // Convert to sheet format
            const values = this.boardToSheetFormat(boardData);

            // First, ensure the sheet exists
            await this.ensureSheetExists(spreadsheetId, sheetName);

            // Write data to the sheet
            const range = `${sheetName}!A1`;
            const body = {
                values: values
            };

            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }
            );

            if (response.ok) {
                this.showStatus('Board saved successfully to Google Sheets!', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to save');
            }
        } catch (error) {
            console.error('Error saving to Google Sheets:', error);
            this.showStatus('Error saving: ' + error.message, 'error');
        }
    }

    // Load board data from Google Sheets
    async loadFromSheet() {
        if (!this.isSignedIn) {
            this.showStatus('Please sign in with Google first', 'error');
            return;
        }

        const spreadsheetUrl = document.getElementById('gs-spreadsheet-url').value;
        const sheetName = document.getElementById('gs-sheet-name').value || 'Kanban';

        if (!spreadsheetUrl) {
            this.showStatus('Please enter a Google Sheets URL', 'error');
            return;
        }

        const spreadsheetId = this.getSpreadsheetId(spreadsheetUrl);
        if (!spreadsheetId) {
            this.showStatus('Invalid Google Sheets URL', 'error');
            return;
        }

        this.showStatus('Loading board from Google Sheets...', 'info');

        try {
            // Read data from the sheet
            const range = `${sheetName}!A:Z`;
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.values && data.values.length > 0) {
                    const boardData = this.sheetToBoardFormat(data.values);
                    this.applyLoadedBoard(boardData);
                    this.showStatus('Board loaded successfully from Google Sheets!', 'success');
                } else {
                    this.showStatus('No data found in the specified sheet', 'error');
                }
            } else {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to load');
            }
        } catch (error) {
            console.error('Error loading from Google Sheets:', error);
            this.showStatus('Error loading: ' + error.message, 'error');
        }
    }

    // Create a new Google Sheet for the board
    async createNewSheet() {
        if (!this.isSignedIn) {
            this.showStatus('Please sign in with Google first', 'error');
            return;
        }

        const boardName = prompt('Enter a name for the new spreadsheet:', 'Kanban Board');
        if (!boardName) return;

        this.showStatus('Creating new spreadsheet...', 'info');

        try {
            const response = await fetch(
                'https://sheets.googleapis.com/v4/spreadsheets',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        properties: {
                            title: boardName
                        },
                        sheets: [{
                            properties: {
                                title: 'Kanban'
                            }
                        }]
                    })
                }
            );

            if (response.ok) {
                const data = await response.json();
                const spreadsheetUrl = data.spreadsheetUrl;
                document.getElementById('gs-spreadsheet-url').value = spreadsheetUrl;
                document.getElementById('gs-sheet-name').value = 'Kanban';
                this.showStatus(`New spreadsheet created! URL: ${spreadsheetUrl}`, 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to create spreadsheet');
            }
        } catch (error) {
            console.error('Error creating spreadsheet:', error);
            this.showStatus('Error creating: ' + error.message, 'error');
        }
    }

    // Ensure the specified sheet exists
    async ensureSheetExists(spreadsheetId, sheetName) {
        try {
            // Check if sheet exists
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                const sheetExists = data.sheets?.some(s => s.properties.title === sheetName);

                if (!sheetExists) {
                    // Add the sheet
                    await fetch(
                        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${this.accessToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                requests: [{
                                    addSheet: {
                                        properties: {
                                            title: sheetName
                                        }
                                    }
                                }]
                            })
                        }
                    );
                }
            }
        } catch (error) {
            console.error('Error ensuring sheet exists:', error);
        }
    }

    // Prepare board data for saving
    prepareBoardData() {
        const tasks = window.kanbanBoard ? window.kanbanBoard.tasks : [];
        const users = window.userManager ? window.userManager.users : [];

        return {
            boardName: window.boardManager ? window.boardManager.currentBoardName : 'default',
            savedAt: new Date().toISOString(),
            tasks: tasks,
            users: users,
            nextTaskId: window.kanbanBoard ? window.kanbanBoard.nextTaskId : 1
        };
    }

    // Convert board data to Google Sheets format (2D array)
    boardToSheetFormat(boardData) {
        const values = [];

        // Header row
        values.push([
            'ID', 'Title', 'Description', 'Status', 'Priority', 'Assignee', 
            'Due Date', 'Emoji', 'Created Date', 'Attachments', 'Comments'
        ]);

        // Task rows
        boardData.tasks.forEach(task => {
            const assignee = task.assignee ? this.getUserDisplayName(task.assignee) : '';
            const attachments = task.attachments ? JSON.stringify(task.attachments) : '';
            const comments = task.comments ? JSON.stringify(task.comments) : '';

            values.push([
                task.id || '',
                task.title || '',
                task.description || '',
                task.status || 'backlog',
                task.priority || 'medium',
                assignee,
                task.dueDate || '',
                task.emoji || '',
                task.createdDate || '',
                attachments,
                comments
            ]);
        });

        // Users section (separated by empty row)
        values.push([]);
        values.push(['Users']);
        values.push(['ID', 'Name', 'Email', 'Role']);

        boardData.users.forEach(user => {
            values.push([
                user.id || '',
                user.name || '',
                user.email || '',
                user.role || ''
            ]);
        });

        return values;
    }

    // Convert Google Sheets data back to board format
    sheetToBoardFormat(values) {
        const boardData = {
            tasks: [],
            users: []
        };

        let inUsersSection = false;
        let usersHeadersFound = false;

        for (let i = 0; i < values.length; i++) {
            const row = values[i];

            // Check for empty row (separator between tasks and users)
            if (row.length === 0 || (row.length === 1 && !row[0])) {
                inUsersSection = true;
                continue;
            }

            // Users section
            if (inUsersSection) {
                if (row[0] === 'ID' && row[1] === 'Name') {
                    usersHeadersFound = true;
                    continue;
                }

                if (usersHeadersFound && row[0] && row[1]) {
                    boardData.users.push({
                        id: row[0],
                        name: row[1],
                        email: row[2] || '',
                        role: row[3] || ''
                    });
                }
                continue;
            }

            // Skip header row
            if (i === 0) continue;

            // Task row
            if (row[0] && row[1]) {
                const task = {
                    id: row[0],
                    title: row[1],
                    description: row[2] || '',
                    status: this.normalizeStatus(row[3] || 'backlog'),
                    priority: row[4] || 'medium',
                    dueDate: row[6] || '',
                    emoji: row[7] || '',
                    createdDate: row[8] || ''
                };

                // Parse assignee email to user ID
                if (row[5]) {
                    const user = boardData.users.find(u => u.name === row[5] || u.email === row[5]);
                    task.assignee = user ? user.id : '';
                }

                // Parse attachments
                if (row[9]) {
                    try {
                        task.attachments = JSON.parse(row[9]);
                    } catch (e) {
                        task.attachments = [];
                    }
                }

                // Parse comments
                if (row[10]) {
                    try {
                        task.comments = JSON.parse(row[10]);
                    } catch (e) {
                        task.comments = [];
                    }
                }

                boardData.tasks.push(task);
            }
        }

        return boardData;
    }

    normalizeStatus(status) {
        const statusMap = {
            'backlog': 'backlog',
            'todo': 'todo',
            'to do': 'todo',
            'in progress': 'in-progress',
            'in-progress': 'in-progress',
            'done': 'done',
            'completed': 'done'
        };
        return statusMap[status.toLowerCase()] || 'backlog';
    }

    getUserDisplayName(userId) {
        if (!window.userManager) return '';
        const user = window.userManager.users.find(u => u.id === userId);
        return user ? user.name : '';
    }

    applyLoadedBoard(boardData) {
        if (window.kanbanBoard && boardData.tasks) {
            window.kanbanBoard.tasks = boardData.tasks;
            window.kanbanBoard.nextTaskId = boardData.nextTaskId || 1;
            window.kanbanBoard.saveTasks();
            window.kanbanBoard.renderBoard();
        }

        if (window.userManager && boardData.users) {
            boardData.users.forEach(user => {
                if (!window.userManager.users.find(u => u.email === user.email)) {
                    window.userManager.users.push(user);
                }
            });
            window.userManager.saveUsers();
            if (window.kanbanBoard) {
                window.kanbanBoard.populateAssigneeDropdown();
            }
        }

        if (window.boardManager) {
            window.boardManager.currentBoardName = boardData.boardName || 'loaded';
        }
    }
}

// Initialize Google Sheets manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.googleSheetsManager = new GoogleSheetsManager();
});
