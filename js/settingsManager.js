/**
 * Settings Manager - Handles settings modal, user management, and panel configuration
 */
class SettingsManager {
    constructor() {
        this.kanbanBoard = null;
        this.userManager = null;
        this.boardManager = null;
        this.panelConfig = {
            count: 4,
            names: ['Backlog', 'To Do', 'In Progress', 'Done']
        };
        this.dateFormat = 'uk'; // Default to UK format (DD/MM/YYYY)
        this.autoSaveEnabled = true; // Enable auto-save by default
        this.autoSaveInterval = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready then set up listeners
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupInitialState());
        } else {
            this.setupInitialState();
        }
    }

    setupInitialState() {
        this.loadPanelConfig();
        this.setupEventListeners();
        // Update auto-save button state to match current setting
        this.updateAutoSaveButton();
        // Start auto-save if enabled
        if (this.autoSaveEnabled) {
            this.startAutoSave();
        }
    }

    // Update auto-save button UI to match current state
    updateAutoSaveButton() {
        const autoSaveBtn = document.getElementById('auto-save-btn');
        if (!autoSaveBtn) return;
        
        if (this.autoSaveEnabled) {
            autoSaveBtn.classList.add('active');
            autoSaveBtn.innerHTML = '<i class="fas fa-check"></i> Auto-Save On';
        } else {
            autoSaveBtn.classList.remove('active');
            autoSaveBtn.innerHTML = '<i class="fas fa-save"></i> Auto-Save';
        }
    }

    // Set managers after they are initialized
    setManagers(kanbanBoard, userManager, boardManager) {
        this.kanbanBoard = kanbanBoard;
        this.userManager = userManager;
        this.boardManager = boardManager;
        this.loadDefaultUser();
        this.renderBoardsList();
        this.renderUsersList();
        this.renderRolesList();
        this.renderPanelConfig();
        this.renderDefaultUserSelect();
    }

    // ========== ROLES MANAGEMENT ==========

    // Render roles list
    renderRolesList() {
        const container = document.getElementById('roles-list');
        if (!container) return;

        container.innerHTML = '';

        const roles = this.userManager ? this.userManager.getRoles() : ['Developer', 'Designer', 'Manager', 'QA'];

        // Add new role input at the top
        const newRoleItem = document.createElement('div');
        newRoleItem.className = 'role-item new-role-item';
        newRoleItem.innerHTML = `
            <div class="role-name-container">
                <input type="text" class="role-name-input new-role-input" placeholder="Add a new role..." maxlength="30">
            </div>
            <div class="role-item-actions">
                <button class="btn btn-sm primary add-role-inline-btn"><i class="fas fa-plus"></i> Add</button>
            </div>
        `;
        container.appendChild(newRoleItem);

        // Add event listener for new role input
        const newRoleInput = newRoleItem.querySelector('.new-role-input');
        const addRoleBtn = newRoleItem.querySelector('.add-role-inline-btn');
        
        const addNewRole = () => {
            const newRole = newRoleInput.value.trim();
            if (newRole) {
                if (this.userManager.createRole(newRole)) {
                    this.renderRolesList();
                    this.showNotification('Role added', 'success');
                }
            }
        };
        
        newRoleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addNewRole();
            } else if (e.key === 'Escape') {
                newRoleInput.value = '';
                newRoleInput.blur();
            }
        });
        
        addRoleBtn.addEventListener('click', addNewRole);

        if (roles.length === 0) {
            container.innerHTML += '<p class="empty-message" style="margin-top: 12px;">No roles defined yet.</p>';
            return;
        }

        roles.forEach(role => {
            const item = document.createElement('div');
            item.className = 'role-item';
            item.dataset.role = role;

            item.innerHTML = `
                <div class="role-name-container">
                    <input type="text" class="role-name-input" value="${this.escapeHtml(role)}" data-original-role="${this.escapeHtml(role)}">
                </div>
                <div class="role-item-actions">
                    <button class="btn btn-sm delete-role-btn" data-role="${this.escapeHtml(role)}"><i class="fas fa-trash"></i></button>
                </div>
            `;

            container.appendChild(item);
        });

        // Add event listeners for inline editing
        container.querySelectorAll('.role-name-input').forEach(input => {
            input.addEventListener('blur', (e) => {
                const originalRole = e.target.dataset.originalRole;
                const newRole = e.target.value.trim();
                
                if (newRole && newRole !== originalRole) {
                    this.userManager.updateRole(originalRole, newRole);
                    this.renderRolesList();
                    // Update role dropdowns in user modals
                    this.updateUserModalsRoles();
                }
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                } else if (e.key === 'Escape') {
                    e.target.value = originalRole;
                    e.target.blur();
                }
            });
        });

        // Add event listeners for delete buttons
        container.querySelectorAll('.delete-role-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const role = e.target.closest('.delete-role-btn').dataset.role;
                this.deleteRole(role);
            });
        });
    }

    // Update role dropdowns in user modals
    updateUserModalsRoles() {
        const roleSelects = document.querySelectorAll('#user-role');
        roleSelects.forEach(select => {
            if (window.userManager) {
                window.userManager.populateRoleDropdown(select, select.value);
            }
        });
    }

    // Open role edit modal
    openRoleEditModal(role = null) {
        const modal = document.getElementById('role-modal');
        const title = document.getElementById('role-modal-title');
        const input = document.getElementById('role-name-input');
        const hiddenInput = document.getElementById('role-original-name');

        if (!modal || !title || !input) return;

        if (role) {
            title.textContent = 'Edit Role';
            input.value = role;
            hiddenInput.value = role;
        } else {
            title.textContent = 'Add Role';
            input.value = '';
            hiddenInput.value = '';
        }

        modal.classList.add('active');
        input.focus();
    }

    // Close role modal
    closeRoleModal() {
        const modal = document.getElementById('role-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    // Save role
    saveRole() {
        const input = document.getElementById('role-name-input');
        const hiddenInput = document.getElementById('role-original-name');

        if (!input || !input.value.trim()) {
            this.showNotification('Please enter a role name', 'error');
            return;
        }

        const newName = input.value.trim();
        const oldName = hiddenInput.value;

        if (oldName) {
            // Update existing role
            if (this.userManager.updateRole(oldName, newName)) {
                this.renderRolesList();
                this.closeRoleModal();
            }
        } else {
            // Create new role
            if (this.userManager.createRole(newName)) {
                this.renderRolesList();
                this.closeRoleModal();
            }
        }
    }

    // Delete role
    deleteRole(role) {
        if (this.userManager.deleteRole(role)) {
            this.renderRolesList();
        }
    }

    // Default user handling
    loadDefaultUser() {
        const savedDefaultUser = localStorage.getItem('kanban-default-user');
        if (savedDefaultUser) {
            this.defaultUserId = parseInt(savedDefaultUser);
            // Set the userManager's currentUserId if it exists
            if (this.userManager) {
                this.userManager.currentUserId = this.defaultUserId;
            }
        }
    }

    saveDefaultUser(userId) {
        this.defaultUserId = userId ? parseInt(userId) : null;
        localStorage.setItem('kanban-default-user', this.defaultUserId || '');
        
        // Update userManager's currentUserId
        if (this.userManager) {
            this.userManager.currentUserId = this.defaultUserId;
        }
        
        this.showNotification(`Default user ${userId ? 'set' : 'cleared'}`, 'success');
    }

    renderDefaultUserSelect() {
        const select = document.getElementById('default-user-select');
        if (!select) return;

        select.innerHTML = '<option value="">No default user</option>';

        if (this.userManager && this.userManager.users) {
            this.userManager.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.name || user.email || 'Unnamed User';
                select.appendChild(option);
            });
        }

        select.value = this.defaultUserId || '';

        select.onchange = () => {
            this.saveDefaultUser(select.value);
        };
    }

    // Panel Configuration
    loadPanelConfig() {
        const savedConfig = localStorage.getItem('kanban-panel-config');
        if (savedConfig) {
            this.panelConfig = JSON.parse(savedConfig);
        }
        // Load date format
        const savedDateFormat = localStorage.getItem('kanban-date-format');
        if (savedDateFormat) {
            this.dateFormat = savedDateFormat;
        }
    }

    savePanelConfig() {
        localStorage.setItem('kanban-panel-config', JSON.stringify(this.panelConfig));
        localStorage.setItem('kanban-date-format', this.dateFormat);
        this.applyPanelConfig();
    }

    applyPanelConfig() {
        if (this.kanbanBoard) {
            this.kanbanBoard.columns = this.getColumnIds();
            this.kanbanBoard.renderBoard();
        }
    }

    getColumnIds() {
        const ids = [];
        for (let i = 0; i < this.panelConfig.count; i++) {
            ids.push(`column-${i}`);
        }
        return ids;
    }

    renderPanelConfig() {
        const panelCountSelect = document.getElementById('panel-count');
        const panelNamesContainer = document.getElementById('panel-names-config');
        const dateFormatSelect = document.getElementById('date-format');
        
        if (panelCountSelect) {
            panelCountSelect.value = this.panelConfig.count;
        }

        if (panelNamesContainer) {
            panelNamesContainer.innerHTML = '';
            for (let i = 0; i < this.panelConfig.count; i++) {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = this.panelConfig.names[i] || `Column ${i + 1}`;
                input.dataset.index = i;
                input.placeholder = `Column ${i + 1} name`;
                panelNamesContainer.appendChild(input);
            }
        }
        
        // Set date format dropdown
        if (dateFormatSelect) {
            dateFormatSelect.value = this.dateFormat;
        }
    }

    // Settings Modal
    openSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.add('active');
            // Refresh lists from current data
            this.refreshAllLists();
        }
    }

    closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    refreshAllLists() {
        // Force reload users from userManager
        if (this.userManager && this.userManager.users) {
            // Users are already accessible, just refresh the display
        }
        this.renderBoardsList();
        this.renderUsersList();
        this.renderPanelConfig();
        this.renderDefaultUserSelect();
    }

    // Boards List
    renderBoardsList() {
        const container = document.getElementById('saved-boards-list');
        if (!container) return;

        const boards = this.boardManager ? this.boardManager.getSavedBoardNames() : [];
        
        container.innerHTML = '';

        if (boards.length === 0) {
            container.innerHTML = '<p class="empty-message">No saved boards. Create a new board above.</p>';
            return;
        }

        boards.forEach(boardName => {
            const board = this.boardManager.savedBoards[boardName];
            const item = document.createElement('div');
            item.className = 'board-item';
            
            // Check if this is the current board
            const isCurrentBoard = boardName === this.boardManager.currentBoardName;
            if (isCurrentBoard) {
                item.classList.add('current');
            }
            
            // Get creator name if available
            let creatorName = 'Unknown';
            if (board.createdBy && this.userManager) {
                const creator = this.userManager.getUser(board.createdBy);
                if (creator) {
                    creatorName = creator.name;
                }
            }
            
            item.innerHTML = `
                <div class="board-info">
                    <span class="board-name">${boardName}${isCurrentBoard ? ' (Current)' : ''}</span>
                    <span class="board-meta">Created by ${creatorName} • ${this.formatDate(board.savedAt)}</span>
                </div>
                <div class="board-item-actions">
                    <button class="btn btn-sm load-board-btn" data-board="${boardName}">${isCurrentBoard ? 'Reload' : 'Load'}</button>
                    <button class="btn btn-sm delete-board-btn" data-board="${boardName}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            container.appendChild(item);
        });

        // Add event listeners
        container.querySelectorAll('.load-board-btn').forEach(btn => {
            btn.onclick = (e) => {
                const boardName = e.target.dataset.board;
                if (this.boardManager) {
                    this.boardManager.loadBoard(boardName);
                }
            };
        });

        container.querySelectorAll('.delete-board-btn').forEach(btn => {
            btn.onclick = (e) => {
                const boardName = e.target.closest('.delete-board-btn').dataset.board;
                if (confirm(`Delete board "${boardName}"?`)) {
                    if (this.boardManager) {
                        this.boardManager.deleteBoard(boardName);
                        this.renderBoardsList();
                    }
                }
            };
        });
    }

    // Users List
    renderUsersList() {
        const container = document.getElementById('users-list');
        if (!container) return;

        // Get users array safely
        let users = [];
        if (this.userManager && this.userManager.users) {
            users = this.userManager.users;
        }

        container.innerHTML = '';

        if (users.length === 0) {
            container.innerHTML = '<p class="empty-message">No users created. Click "Add User" in the header to create one.</p>';
            return;
        }

        users.forEach(user => {
            const item = document.createElement('div');
            item.className = 'user-item';
            const displayName = user.name || user.email || 'Unnamed User';
            const displayEmail = user.email || 'No email';
            const displayRole = user.role || 'No role';
            
            item.innerHTML = `
                <div class="user-info">
                    <span class="user-name">${displayName}</span>
                    <span class="user-email">${displayEmail}</span>
                    <span class="user-role">${displayRole}</span>
                </div>
                <div class="user-item-actions">
                    <button class="btn btn-sm edit-user-btn" data-user="${user.id}" onclick="settingsManager.handleEditUser(${user.id})"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn btn-sm delete-user-btn" data-user="${user.id}" onclick="settingsManager.handleDeleteUser(${user.id})"><i class="fas fa-trash"></i></button>
                </div>
            `;
            container.appendChild(item);
        });
    }

    // Utility
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        if (this.dateFormat === 'us') {
            // US format: MM/DD/YYYY
            return `${month}/${day}/${year}`;
        } else {
            // UK format: DD/MM/YYYY
            return `${day}/${month}/${year}`;
        }
    }

    // Format date with time
    formatDateTime(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (this.dateFormat === 'us') {
            return `${month}/${day}/${year} ${time}`;
        } else {
            return `${day}/${month}/${year} ${time}`;
        }
    }

    // Fallback method to open user modal directly
    openUserModalDirect(user) {
        const modal = document.getElementById('user-modal');
        const form = document.getElementById('user-form');
        const title = document.getElementById('user-modal-title');

        if (!modal || !form || !title) {
            console.error('User modal elements not found');
            return;
        }

        title.textContent = 'Edit User';
        const nameInput = document.getElementById('user-name');
        const emailInput = document.getElementById('user-email');
        const roleSelect = document.getElementById('user-role');

        if (nameInput) nameInput.value = user.name || '';
        if (emailInput) emailInput.value = user.email || '';
        if (roleSelect) roleSelect.value = user.role || 'developer';

        form.setAttribute('data-user-id', user.id);
        modal.classList.add('active');
    }

    // Handler methods for onclick attributes
    handleEditUser(userId) {
        if (this.userManager) {
            const user = this.userManager.getUser(userId);
            if (user) {
                // Try using userManager method first
                if (typeof this.userManager.openUserModal === 'function') {
                    this.userManager.openUserModal(user);
                } else {
                    // Fallback: directly open modal and set values
                    this.openUserModalDirect(user);
                }
            }
        }
    }

    handleDeleteUser(userId) {
        if (this.userManager && confirm('Delete this user?')) {
            this.userManager.deleteUser(userId);
            this.renderUsersList();
            if (this.kanbanBoard) {
                this.kanbanBoard.populateAssigneeDropdown();
            }
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Settings button in header - open settings modal
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }

        // Settings modal close buttons
        const settingsClose = document.getElementById('settings-modal-close');
        if (settingsClose) {
            settingsClose.addEventListener('click', () => this.closeSettings());
        }
        const settingsCancel = document.getElementById('settings-cancel-btn');
        if (settingsCancel) {
            settingsCancel.addEventListener('click', () => this.closeSettings());
        }
        // Settings modal overlay
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target.id === 'settings-modal') {
                    this.closeSettings();
                }
            });
        }

        // Settings tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Boards tab actions - Create board
        document.getElementById('create-board-btn')?.addEventListener('click', () => {
            const input = document.getElementById('new-board-name');
            const boardName = input.value.trim();
            if (boardName && this.boardManager) {
                this.boardManager.saveBoard(boardName);
                this.boardManager.currentBoardName = boardName;
                this.renderBoardsList();
                this.showNotification(`Board "${boardName}" created and loaded`, 'success');
                input.value = '';
            }
        });

        // Boards tab - Save board
        document.getElementById('save-board-btn')?.addEventListener('click', () => {
            if (this.boardManager) {
                const boardName = this.boardManager.currentBoardName || 'default';
                this.boardManager.saveBoard(boardName);
                this.showSaveComplete();
            }
        });

        // Auto-save toggle
        document.getElementById('auto-save-btn')?.addEventListener('click', () => this.toggleAutoSave());

        // Export JSON
        document.getElementById('export-json-btn')?.addEventListener('click', () => {
            if (this.boardManager) this.boardManager.exportBoardJSON();
        });

        // Import JSON button
        document.getElementById('import-json-btn')?.addEventListener('click', () => {
            document.getElementById('import-json-input')?.click();
        });

        // Import JSON file input
        document.getElementById('import-json-input')?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0] && this.boardManager) {
                this.boardManager.importBoardJSON(e.target.files[0]);
                e.target.value = '';
            }
        });

        // Panels tab
        document.getElementById('panel-count')?.addEventListener('change', () => {
            this.panelConfig.count = parseInt(document.getElementById('panel-count').value);
            this.renderPanelConfig();
        });

        document.getElementById('save-panels-config')?.addEventListener('click', () => {
            const inputs = document.querySelectorAll('#panel-names-config input');
            inputs.forEach((input, index) => {
                this.panelConfig.names[index] = input.value.trim() || `Column ${index + 1}`;
            });
            const dateFormatSelect = document.getElementById('date-format');
            if (dateFormatSelect) {
                this.dateFormat = dateFormatSelect.value;
            }
            this.savePanelConfig();
            this.showNotification('Panel configuration saved', 'success');
        });

        // Role modal events
        const roleModalClose = document.getElementById('role-modal-close');
        if (roleModalClose) {
            roleModalClose.addEventListener('click', () => this.closeRoleModal());
        }
        const roleCancelBtn = document.getElementById('role-cancel-btn');
        if (roleCancelBtn) {
            roleCancelBtn.addEventListener('click', () => this.closeRoleModal());
        }
        const roleSaveBtn = document.getElementById('role-save-btn');
        if (roleSaveBtn) {
            roleSaveBtn.addEventListener('click', () => this.saveRole());
        }
        const roleModal = document.getElementById('role-modal');
        if (roleModal) {
            roleModal.addEventListener('click', (e) => {
                if (e.target.id === 'role-modal') this.closeRoleModal();
            });
        }

        // Escape for role modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const roleModal = document.getElementById('role-modal');
                if (roleModal && roleModal.classList.contains('active')) {
                    this.closeRoleModal();
                }
            }
        });

        // Escape for settings modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const settingsModal = document.getElementById('settings-modal');
                if (settingsModal && settingsModal.classList.contains('active')) {
                    this.closeSettings();
                }
            }
        });

    }


    // Auto-save functionality
    startAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            if (this.boardManager) {
                const boardName = this.boardManager.currentBoardName || 'default';
                this.boardManager.saveBoard(boardName);
                this.showSaveComplete();
            }
        }, 30000);
    }

    toggleAutoSave() {
        this.autoSaveEnabled = !this.autoSaveEnabled;
        this.updateAutoSaveButton();
        
        if (this.autoSaveEnabled) {
            // Start auto-save (saves every 30 seconds)
            this.startAutoSave();
            this.showNotification('Auto-save enabled', 'success');
        } else {
            // Stop auto-save
            if (this.autoSaveInterval) {
                clearInterval(this.autoSaveInterval);
                this.autoSaveInterval = null;
            }
            this.showNotification('Auto-save disabled', 'info');
        }
    }

    // Show save complete checkmark
    showSaveComplete() {
        const saveBoardBtn = document.getElementById('save-board-btn');
        if (saveBoardBtn) {
            const originalContent = saveBoardBtn.innerHTML;
            saveBoardBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
            saveBoardBtn.classList.add('saved');
            
            setTimeout(() => {
                saveBoardBtn.innerHTML = originalContent;
                saveBoardBtn.classList.remove('saved');
            }, 2000);
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });

        // Initialize comments tab if selected
        if (tabName === 'comments') {
            this.populateCommentsUserSelect();
        }
    }

    // Populate user select for comments tab
    populateCommentsUserSelect() {
        const select = document.getElementById('comments-user-select');
        if (!select) return;

        select.innerHTML = '<option value="">Select a user...</option>';

        if (this.userManager && this.userManager.users) {
            this.userManager.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.name || user.email || 'Unnamed User';
                select.appendChild(option);
            });
        }

        // Add event listener
        select.onchange = () => {
            this.renderUserComments(select.value);
        };
    }

    // Render comments for a selected user
    renderUserComments(userId) {
        const container = document.getElementById('user-comments-list');
        if (!container) return;

        if (!userId) {
            container.innerHTML = '<p class="empty-message">Select a user to view their comments</p>';
            return;
        }

        // Handle both string and number IDs
        const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;
        
        const user = this.userManager ? this.userManager.getUser(userIdNum) : null;
        if (!user) {
            container.innerHTML = '<p class="empty-message">User not found</p>';
            return;
        }

        // Find all comments made by this user
        const comments = [];
        if (this.kanbanBoard && this.kanbanBoard.tasks) {
            this.kanbanBoard.tasks.forEach(task => {
                if (task.comments && task.comments.length > 0) {
                    task.comments.forEach(comment => {
                        const commentUserId = typeof comment.userId === 'string' ? parseInt(comment.userId) : comment.userId;
                        if (commentUserId === userIdNum) {
                            comments.push({
                                comment: comment,
                                task: task
                            });
                        }
                    });
                }
            });
        }

        container.innerHTML = '';

        if (comments.length === 0) {
            container.innerHTML = `<p class="empty-message">No comments found for ${user.name || user.email}</p>`;
            return;
        }

        // Sort by date (newest first)
        comments.sort((a, b) => new Date(b.comment.createdAt) - new Date(a.comment.createdAt));

        // Get panel configuration
        const panelConfig = this.kanbanBoard ? this.kanbanBoard.panelConfig : { names: ['Backlog', 'To Do', 'In Progress', 'Done'] };
        const columns = this.kanbanBoard ? this.kanbanBoard.columns : ['backlog', 'todo', 'in-progress', 'done'];

        // Group by panel/status using an array to preserve order
        const groups = [];
        const groupMap = {};
        
        comments.forEach(({comment, task}) => {
            const panelIndex = columns.indexOf(task.status);
            const panelName = panelIndex >= 0 && panelIndex < panelConfig.names.length 
                ? panelConfig.names[panelIndex] 
                : task.status;
            
            if (!groupMap[panelName]) {
                groupMap[panelName] = {
                    name: panelName,
                    index: panelIndex >= 0 ? panelIndex : 999,
                    items: []
                };
                groups.push(groupMap[panelName]);
            }
            groupMap[panelName].items.push({comment, task});
        });

        // Sort groups by panel index to match kanban board order
        groups.sort((a, b) => a.index - b.index);

        // Render groups with panel titles
        groups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'user-comment-group';
            groupDiv.innerHTML = `<div class="comment-group-title">${group.name}</div>`;

            group.items.forEach(({comment, task}) => {
                const item = document.createElement('div');
                item.className = 'user-comment-item';

                // Handle user ID lookup - assigneeId can be string or number
                const assigneeId = comment.assigneeId;
                let assigneeName = 'Unassigned';
                if (assigneeId !== null && assigneeId !== undefined) {
                    // Try to get user by both number and string ID
                    assigneeName = this.kanbanBoard.getUserName(assigneeId) || 'Unassigned';
                }

                item.innerHTML = `
                    <div class="comment-task-info">
                        <div class="comment-task-title">
                            <i class="fas fa-clipboard-list"></i>
                            ${this.escapeHtml(task.title)}
                        </div>
                        <div class="comment-assignee-info">
                            <i class="fas fa-user"></i> Assigned to: ${this.escapeHtml(assigneeName)}
                        </div>
                        <div class="comment-date">${this.formatDateTime(comment.createdAt)}</div>
                        <div class="comment-preview">${this.escapeHtml(comment.text)}</div>
                    </div>
                    <div class="comment-actions">
                        <button class="btn btn-sm go-to-task-btn" data-task-id="${task.id}">
                            <i class="fas fa-external-link-alt"></i> Open
                        </button>
                    </div>
                `;

                groupDiv.appendChild(item);
            });

            container.appendChild(groupDiv);
        });

        // Add event listeners for go to task buttons
        container.querySelectorAll('.go-to-task-btn').forEach(btn => {
            btn.onclick = (e) => {
                const taskId = parseInt(e.target.closest('.go-to-task-btn').dataset.taskId);
                this.goToTask(taskId);
            };
        });
    }

    // Go to task (close settings and open task modal)
    goToTask(taskId) {
        if (this.kanbanBoard) {
            const task = this.kanbanBoard.tasks.find(t => t.id === taskId);
            if (task) {
                this.closeSettings();
                this.kanbanBoard.openTaskModal(task);
            }
        }
    }

    // Escape HTML
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        if (window.notifications) {
            window.notifications.show(message, type);
        }
    }
}

// Initialize settings manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
    
    // Wait for other managers to be ready
    const checkForManagers = setInterval(() => {
        if (window.kanbanBoard && window.userManager && window.boardManager && window.settingsManager) {
            window.settingsManager.setManagers(
                window.kanbanBoard,
                window.userManager,
                window.boardManager
            );
            clearInterval(checkForManagers);
        }
    }, 100);
    
    // Fallback in case managers are already ready
    setTimeout(() => {
        if (window.kanbanBoard && window.userManager && window.boardManager && window.settingsManager) {
            window.settingsManager.setManagers(
                window.kanbanBoard,
                window.userManager,
                window.boardManager
            );
        }
    }, 500);
});
