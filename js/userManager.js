/**
 * User Management System with Firebase Authentication
 */
class UserManager {
    constructor() {
        this.users = [];
        this.nextUserId = 1;
        this.currentUserId = null; // Track current logged in user
        this.firebaseUser = null; // Track Firebase user
        this.roles = ['Developer', 'Designer', 'Manager', 'QA']; // Default roles
        this.init();
    }

    init() {
        this.loadRoles();
        this.loadUsers();
        this.setupFirebaseAuth();
        this.setupEventListeners();
        // Listen for custom events from settings manager
        window.addEventListener('trigger-google-signin', () => this.signInWithGoogle());
    }

    // ========== ROLES MANAGEMENT ==========
    
    // Load roles from localStorage
    loadRoles() {
        const savedRoles = localStorage.getItem('kanban-roles');
        if (savedRoles) {
            this.roles = JSON.parse(savedRoles);
        }
    }

    // Save roles to localStorage
    saveRoles() {
        localStorage.setItem('kanban-roles', JSON.stringify(this.roles));
    }

    // Create a new role
    createRole(name) {
        if (this.roles.includes(name)) {
            this.showNotification('Role already exists', 'error');
            return false;
        }
        this.roles.push(name);
        this.saveRoles();
        this.showNotification('Role created successfully', 'success');
        return true;
    }

    // Update an existing role
    updateRole(oldName, newName) {
        const index = this.roles.indexOf(oldName);
        if (index === -1) {
            this.showNotification('Role not found', 'error');
            return false;
        }
        if (this.roles.includes(newName) && newName !== oldName) {
            this.showNotification('Role name already exists', 'error');
            return false;
        }
        this.roles[index] = newName;
        this.saveRoles();
        this.showNotification('Role updated successfully', 'success');
        return true;
    }

    // Delete a role
    deleteRole(name) {
        // Check if any users have this role
        const usersWithRole = this.users.filter(u => u.role === name);
        if (usersWithRole.length > 0) {
            if (!confirm(`${usersWithRole.length} user(s) have this role. Are you sure you want to delete it? These users will need their roles reassigned.`)) {
                return false;
            }
            // Update users with this role to first available role
            const newRole = this.roles.find(r => r !== name) || '';
            usersWithRole.forEach(user => {
                user.role = newRole;
            });
            this.saveUsers();
        }
        this.roles = this.roles.filter(r => r !== name);
        this.saveRoles();
        this.showNotification('Role deleted successfully', 'success');
        return true;
    }

    // Get all roles
    getRoles() {
        return [...this.roles];
    }

    // Populate role dropdown
    populateRoleDropdown(selectElement, selectedRole = '') {
        if (!selectElement) return;
        selectElement.innerHTML = '';
        this.roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role;
            option.textContent = role;
            if (role === selectedRole) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    }

    // Firebase Authentication Setup
    setupFirebaseAuth() {
        if (!isFirebaseConfigured()) {
            console.log('Firebase not configured, skipping auth setup');
            return;
        }

        // Listen for auth state changes
        window.firebaseAuth.onAuthStateChanged((user) => {
            this.handleAuthStateChange(user);
        });
    }

    // Handle authentication state changes
    async handleAuthStateChange(user) {
        this.firebaseUser = user;
        
        if (user) {
            // User is signed in with Firebase
            console.log('Firebase user signed in:', user.displayName);
            
            // Sync Firebase user with local users
            await this.syncFirebaseUser(user);
            
            // Update UI
            this.updateAuthUI(user);
            this.showNotification(`Welcome, ${user.displayName}!`, 'success');
        } else {
            // User is signed out
            console.log('Firebase user signed out');
            this.updateAuthUI(null);
        }
    }

    // Get user by Firebase UID
    getUserByFirebaseUid(uid) {
        return this.users.find(u => u.firebaseUid === uid);
    }

    // Sync Firebase user with local user system
    async syncFirebaseUser(firebaseUser) {
        // Check if user already exists by Firebase UID first (best practice)
        let localUser = this.getUserByFirebaseUid(firebaseUser.uid);
        
        // Fallback to email match for existing users created before UID migration
        if (!localUser) {
            localUser = this.getUserByEmail(firebaseUser.email);
            if (localUser) {
                // Update existing user with Firebase UID
                this.updateUser(localUser.id, { firebaseUid: firebaseUser.uid });
            }
        }
        
        if (!localUser) {
            // Create new local user from Firebase data
            localUser = this.createUser({
                name: firebaseUser.displayName,
                email: firebaseUser.email,
                role: 'developer',
                firebaseUid: firebaseUser.uid,
                photoURL: firebaseUser.photoURL || ''
            });
            console.log('Created local user from Firebase:', localUser);
        } else {
            // Update existing user with Firebase data
            this.updateUser(localUser.id, {
                name: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL || ''
            });
        }

        // Sync user to Firestore if available
        if (window.firebaseDb) {
            try {
                await window.firebaseDb.collection("users").doc(firebaseUser.uid).set({
                    name: firebaseUser.displayName,
                    email: firebaseUser.email,
                    photoURL: firebaseUser.photoURL || '',
                    lastLogin: new Date().toISOString()
                }, { merge: true });
                console.log('User synced to Firestore');
            } catch (error) {
                console.error('Error syncing user to Firestore:', error);
            }
        }
        
        // Set as current user
        this.currentUserId = localUser.id;
        
        // Save default user
        localStorage.setItem('kanban-default-user', localUser.id.toString());
        
        return localUser;
    }

    // Sign in with Google
    async signInWithGoogle() {
        if (!isFirebaseConfigured()) {
            alert('Firebase is not configured. Please add your Firebase config to js/firebaseConfig.js');
            return null;
        }
        
        try {
            const result = await signInWithGoogle();
            return result;
        } catch (error) {
            console.error('Google sign-in error:', error);
            this.showNotification('Google sign-in failed: ' + error.message, 'error');
            return null;
        }
    }

    // Sign out
    async signOut() {
        if (!isFirebaseConfigured()) return;
        
        try {
            await signOut();
            this.showNotification('Signed out successfully', 'info');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    }

    // Update UI based on auth state
    updateAuthUI(user) {
        const loginBtn = document.getElementById('google-login-btn');
        const userDisplay = document.getElementById('user-display');
        const userNameDisplay = document.getElementById('user-name-display');
        const userPhoto = document.getElementById('user-photo');
        
        if (user) {
            // User is signed in
            if (loginBtn) loginBtn.style.display = 'none';
            if (userDisplay) {
                userDisplay.style.display = 'flex';
                userNameDisplay.textContent = user.displayName;
                if (userPhoto && user.photoURL) {
                    userPhoto.src = user.photoURL;
                    userPhoto.style.display = 'block';
                } else if (userPhoto) {
                    userPhoto.style.display = 'none';
                }
            }
        } else {
            // User is signed out
            if (loginBtn) loginBtn.style.display = 'inline-flex';
            if (userDisplay) userDisplay.style.display = 'none';
        }
    }

    // User CRUD Operations
    createUser(userData) {
        const user = {
            id: this.nextUserId++,
            name: userData.name,
            email: userData.email || '',
            role: userData.role || 'developer',
            firebaseUid: userData.firebaseUid || null,
            photoURL: userData.photoURL || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.users.push(user);
        this.saveUsers();
        
        // Set as current user
        this.currentUserId = user.id;
        
        return user;
    }

    updateUser(id, updates) {
        const user = this.users.find(u => u.id === id);
        if (user) {
            Object.assign(user, updates, { updatedAt: new Date().toISOString() });
            this.saveUsers();
        }
        return user;
    }

    deleteUser(id) {
        // Check if user is assigned to any tasks
        const assignedTasks = this.getUserAssignedTasks(id);
        if (assignedTasks.length > 0) {
            if (!confirm(`This user is assigned to ${assignedTasks.length} task(s). Remove assignment and delete user?`)) {
                return false;
            }
            // Remove user assignment from tasks
            assignedTasks.forEach(task => {
                if (window.kanbanBoard) {
                    window.kanbanBoard.updateTask(task.id, { assignee: '' });
                }
            });
        }

        this.users = this.users.filter(u => u.id !== id);
        this.saveUsers();
        return true;
    }

    getUser(id) {
        // Handle both string and number IDs for comparison
        const idNum = typeof id === 'string' ? parseInt(id) : id;
        return this.users.find(u => u.id == idNum);
    }

    getUserByEmail(email) {
        return this.users.find(u => u.email === email);
    }

    // User Task Assignment
    getUserAssignedTasks(userId) {
        if (!window.kanbanBoard) return [];
        const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;
        return window.kanbanBoard.tasks.filter(task => {
            const taskAssigneeNum = typeof task.assignee === 'string' ? parseInt(task.assignee) : task.assignee;
            return taskAssigneeNum === userIdNum;
        });
    }

    assignTaskToUser(taskId, userId) {
        if (window.kanbanBoard) {
            window.kanbanBoard.updateTask(taskId, { assignee: userId });
        }
    }

    unassignTask(taskId) {
        if (window.kanbanBoard) {
            window.kanbanBoard.updateTask(taskId, { assignee: '' });
        }
    }

    // Modal Management
    openUserModal(user = null) {
        const modal = document.getElementById('user-modal');
        const form = document.getElementById('user-form');
        const title = document.getElementById('user-modal-title');
        const roleSelect = document.getElementById('user-role');

        if (user) {
            title.textContent = 'Edit User';
            document.getElementById('user-name').value = user.name;
            document.getElementById('user-email').value = user.email;
            this.populateRoleDropdown(roleSelect, user.role);
            form.dataset.userId = user.id;
        } else {
            title.textContent = 'Add User';
            form.reset();
            this.populateRoleDropdown(roleSelect);
            delete form.dataset.userId;
        }

        modal.classList.add('active');
    }

    closeUserModal() {
        document.getElementById('user-modal').classList.remove('active');
    }

    saveUser() {
        const form = document.getElementById('user-form');
        const userId = form.dataset.userId || form.getAttribute('data-user-id');
        
        // Get form values directly
        const userData = {
            name: document.getElementById('user-name').value,
            email: document.getElementById('user-email').value,
            role: document.getElementById('user-role').value
        };

        if (userId) {
            this.updateUser(parseInt(userId), userData);
        } else {
            const newUser = this.createUser(userData);
            // Set as current user for task assignment
            this.currentUserId = newUser.id;
        }

        this.closeUserModal();
        this.showNotification(`User ${userId ? 'updated' : 'created'} successfully`, 'success');
        
        // Refresh the assignee dropdown in kanban board
        if (window.kanbanBoard) {
            window.kanbanBoard.populateAssigneeDropdown();
            // Re-enable comments now that users exist
            window.kanbanBoard.setupCommentListeners();
            // Refresh comments list if a task is open
            if (window.kanbanBoard.currentTaskId) {
                const task = window.kanbanBoard.tasks.find(t => t.id === window.kanbanBoard.currentTaskId);
                if (task) {
                    window.kanbanBoard.renderCommentsList(task.comments || []);
                }
            }
        }
        
        // Refresh users list in settings if open
        if (window.settingsManager) {
            window.settingsManager.renderUsersList();
        }
    }

    // Get current user
    getCurrentUser() {
        if (this.currentUserId) {
            return this.users.find(u => u.id === this.currentUserId);
        }
        return null;
    }

    // Set current user
    setCurrentUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (user) {
            this.currentUserId = userId;
            this.showNotification(`Switched to ${user.name}`, 'info');
        }
    }

    // User List Management (for future expansion)
    renderUserList() {
        // This could be used to display a user management panel
        // For now, users are managed through the modal
    }

    // Data Persistence
    saveUsers() {
        localStorage.setItem('kanban-users', JSON.stringify(this.users));
        localStorage.setItem('kanban-next-user-id', this.nextUserId.toString());
        console.log('Users saved to localStorage:', this.users);
    }

    loadUsers() {
        const savedUsers = localStorage.getItem('kanban-users');
        const savedNextId = localStorage.getItem('kanban-next-user-id');

        if (savedUsers) {
            this.users = JSON.parse(savedUsers);
        }

        if (savedNextId) {
            this.nextUserId = parseInt(savedNextId);
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Add user button
        const addUserBtn = document.getElementById('add-user-btn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => this.openUserModal());
        }

        // Google login button
        const googleLoginBtn = document.getElementById('google-login-btn');
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', () => this.signInWithGoogle());
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.signOut());
        }

        // User modal
        const userModalClose = document.getElementById('user-modal-close');
        if (userModalClose) {
            userModalClose.addEventListener('click', () => this.closeUserModal());
        }

        const userCancelBtn = document.getElementById('user-cancel-btn');
        if (userCancelBtn) {
            userCancelBtn.addEventListener('click', () => this.closeUserModal());
        }

        const userSaveBtn = document.getElementById('user-save-btn');
        if (userSaveBtn) {
            userSaveBtn.addEventListener('click', () => this.saveUser());
        }

        // Close modal on overlay click
        const userModal = document.getElementById('user-modal');
        if (userModal) {
            userModal.addEventListener('click', (e) => {
                if (e.target.id === 'user-modal') {
                    this.closeUserModal();
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeUserModal();
            }
        });
    }

    // Utility Methods
    showNotification(message, type = 'info') {
        if (window.notifications) {
            window.notifications.show(message, type);
        }
    }

    // Export/Import Users
    exportUsers() {
        return {
            users: this.users,
            nextUserId: this.nextUserId
        };
    }

    importUsers(data) {
        if (data.users) {
            this.users = data.users;
        }
        if (data.nextUserId) {
            this.nextUserId = data.nextUserId;
        }
        this.saveUsers();
    }
}

// Initialize user manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.userManager = new UserManager();
});