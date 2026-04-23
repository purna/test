/**
 * GitHubBoards.js - GitHub Projects Integration for pixelKanban
 * 
 * Provides integration with GitHub Projects (ProjectsV2) to sync kanban boards
 * with GitHub issues and project boards.
 * 
 * Features:
 * - OAuth or Personal Access Token authentication
 * - Fetch user's repositories and projects
 * - Push board data to GitHub as issues/project items
 * - Pull board data from GitHub projects
 * - Two-way sync between pixelKanban and GitHub
 */

class GitHubAPI {
    constructor() {
        this.BASE_URL = 'https://api.github.com';
        this.GRAPHQL_URL = 'https://api.github.com/graphql';
        // Read token from config or localStorage
        this.accessToken = localStorage.getItem('github_access_token') || githubConfig.accessToken || '';
        this.tokenType = localStorage.getItem('github_token_type') || githubConfig.tokenType || 'pat';
        this.user = null;
        // Read saved repo from localStorage or config
        const savedRepo = localStorage.getItem('github_selected_repo');
        this.selectedRepo = savedRepo ? JSON.parse(savedRepo) : null;
        if (!this.selectedRepo && githubConfig.defaultOwner && githubConfig.defaultRepo) {
            this.selectedRepo = {
                owner: { login: githubConfig.defaultOwner },
                name: githubConfig.defaultRepo,
                fullName: `${githubConfig.defaultOwner}/${githubConfig.defaultRepo}`
            };
        }
    }

    /**
     * Check if authenticated
     */
    isAuthenticated() {
        return !!this.accessToken;
    }

    /**
     * Set access token
     */
    setToken(token, type = 'pat') {
        this.accessToken = token;
        this.tokenType = type;
        localStorage.setItem('github_access_token', token);
        localStorage.setItem('github_token_type', type);
    }

    /**
     * Clear authentication
     */
    logout() {
        this.accessToken = null;
        this.user = null;
        localStorage.removeItem('github_access_token');
        localStorage.removeItem('github_token_type');
        localStorage.removeItem('github_selected_repo');
        localStorage.removeItem('github_selected_project');
    }

    /**
     * Make authenticated API request
     */
    async request(endpoint, options = {}) {
        if (!this.accessToken) {
            throw new Error('Not authenticated with GitHub');
        }

        const url = endpoint.startsWith('http') ? endpoint : `${this.BASE_URL}${endpoint}`;
        
        const headers = {
            'Authorization': `${this.tokenType === 'oauth' ? 'Bearer' : 'Bearer'} ${this.accessToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `GitHub API error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Make GraphQL request
     */
    async graphql(query, variables = {}) {
        if (!this.accessToken) {
            throw new Error('Not authenticated with GitHub');
        }

        try {
            const response = await fetch(this.GRAPHQL_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query, variables })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`GitHub API error ${response.status}: ${text.slice(0, 200)}`);
            }

            const result = await response.json();
            
            if (result.errors) {
                throw new Error(result.errors.map(e => e.message).join(', '));
            }

            return result.data;
        } catch (error) {
            console.error('GraphQL request failed:', error.message);
            throw error;
        }
    }

    /**
     * Get current user
     */
    async getCurrentUser() {
        if (this.user) return this.user;
        
        this.user = await this.request('/user');
        return this.user;
    }

    /**
     * Get user's repositories (accessible by authenticated user)
     */
    async getRepositories() {
        try {
            // Use /user/repos to get repos the authenticated user has access to
            // This includes private repos if token has 'repo' scope
            const repos = await this.request('/user/repos?sort=updated&per_page=100&visibility=all');
            return repos;
        } catch (error) {
            console.error('Failed to fetch repositories:', error);
            // Provide more helpful error message for common issues
            if (error.message && error.message.toLowerCase().includes('not found')) {
                throw new Error('Failed to load repositories. This usually means the access token lacks the required "repo" scope. Please generate a new token with "repo" (full control of repositories) permission at https://github.com/settings/tokens');
            }
            throw error;
        }
    }

    /**
     * Get repository issues
     */
    async getRepoIssues(owner, repo, state = 'all') {
        const issues = await this.request(`/repos/${owner}/${repo}/issues?state=${state}&per_page=100`);
        // Filter out pull requests
        return issues.filter(issue => !issue.pull_request);
    }

    /**
     * Get user's ProjectsV2
     * Uses GraphQL API (no REST fallback — requires 'repo' or 'read:user' scopes)
     */
    async getProjects() {
        const query = `
            query {
                viewer {
                    projectsV2(first: 20) {
                        nodes {
                            id
                            title
                            number
                        }
                    }
                }
            }
        `;
        
        try {
            const data = await this.graphql(query);
            const projects = data?.viewer?.projectsV2?.nodes || [];
            // Filter out any null entries
            return projects.filter(p => p && p.id && p.title);
        } catch (error) {
            console.warn('Failed to fetch ProjectsV2:', error.message);
            // Return empty array — projects UI will show "no projects" message
            return [];
        }
    }

    /**
     * Get project columns (for classic projects)
     */
    async getProjectColumns(projectId) {
        const columns = await this.request(`/projects/${projectId}/columns`);
        return columns;
    }

    /**
     * Get project items (cards)
     */
    async getProjectItems(projectId) {
        const columns = await this.getProjectColumns(projectId);
        const items = {};
        
        for (const column of columns) {
            const cards = await this.request(`/projects/columns/${column.id}/cards`);
            items[column.id] = {
                name: column.name,
                cards: cards
            };
        }
        
        return items;
    }

    /**
     * Create a new issue in a repository
     */
    async createIssue(owner, repo, title, body = '', labels = [], assignees = [], milestone = null) {
        const issue = await this.request(`/repos/${owner}/${repo}/issues`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                body,
                labels,
                assignees,
                milestone: milestone ? { number: milestone } : null
            })
        });
        return issue;
    }

    /**
     * Update an issue
     */
    async updateIssue(owner, repo, issueNumber, updates = {}) {
        // Convert milestone to the correct format for GitHub API { number: X }
        if (updates.milestone) {
            if (typeof updates.milestone === 'string' && updates.milestone.trim() !== '') {
                // It's a milestone name string? Actually we might store number as string.
                // If it's numeric string, treat as number
                const num = parseInt(updates.milestone);
                if (!isNaN(num)) {
                    updates.milestone = { number: num };
                } else {
                    // It's a name - we should have resolved earlier, but treat as null
                    updates.milestone = null;
                }
            } else if (typeof updates.milestone === 'number') {
                updates.milestone = { number: updates.milestone };
            } else if (typeof updates.milestone === 'object' && updates.milestone.number) {
                // Already in correct format
            } else {
                updates.milestone = null;
            }
        }
        
        const issue = await this.request(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        return issue;
    }

    /**
     * Add issue to project column
     */
    async addIssueToProjectColumn(projectId, issueId, columnId) {
        await this.request(`/projects/columns/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content_id: issueId,
                content_type: 'Issue',
                column_id: columnId
            })
        });
    }

    /**
     * Move project card to different column
     */
    async moveProjectCard(cardId, columnId, position = 'top') {
        await this.request(`/projects/columns/cards/${cardId}/moves`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                position,
                column_id: columnId
            })
        });
    }

    /**
     * Delete project card
     */
    async deleteProjectCard(cardId) {
        await this.request(`/projects/columns/cards/${cardId}`, {
            method: 'DELETE'
        });
    }

    /**
     * Get repository labels
     */
    async getRepoLabels(owner, repo) {
        const labels = await this.request(`/repos/${owner}/${repo}/labels?per_page=100`);
        return labels;
    }

    /**
     * Create a label
     */
    async createLabel(owner, repo, name, color = 'ffffff') {
        const label = await this.request(`/repos/${owner}/${repo}/labels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, color })
        });
        return label;
    }

    /**
     * Get repository assignees
     */
    async getRepoAssignees(owner, repo) {
        const assignees = await this.request(`/repos/${owner}/${repo}/assignees?per_page=100`);
        return assignees;
    }

    /**
     * Get repository collaborators
     */
    async getRepoCollaborators(owner, repo) {
        try {
            const collaborators = await this.request(`/repos/${owner}/${repo}/collaborators?per_page=100`);
            return collaborators;
        } catch (error) {
            if (error.message && error.message.includes('403')) {
                throw new Error('Insufficient permissions to access collaborators. Token needs "repo" scope and user must have admin/repo access to the repository.');
            }
            throw error;
        }
    }

    /**
     * Get repository milestones
     */
    async getRepoMilestones(owner, repo, state = 'open') {
        const milestones = await this.request(`/repos/${owner}/${repo}/milestones?state=${state}&per_page=100`);
        return milestones;
    }

    /**
     * Get milestone by name
     */
    async getMilestoneByName(owner, repo, name) {
        const milestones = await this.getRepoMilestones(owner, repo);
        return milestones.find(m => m.title.toLowerCase() === name.toLowerCase()) || null;
    }

    /**
     * Create a milestone
     */
    async createMilestone(owner, repo, title, description = '', color = 'ffffff') {
        const milestone = await this.request(`/repos/${owner}/${repo}/milestones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description,
                color
            })
        });
        return milestone;
    }

    /**
     * Search issues
     */
    async searchIssues(query) {
        const results = await this.request(`/search/issues?q=${encodeURIComponent(query)}`);
        return results.items;
    }
}

/**
 * GitHubBoards - Main integration class
 */
class GitHubBoards {
    constructor() {
        this.api = new GitHubAPI();
        this.syncStatus = 'idle'; // 'idle', 'syncing', 'success', 'error'
        this.lastSync = localStorage.getItem('github_last_sync');
        
        // Column mapping - read from config or use defaults
        this.columnMapping = githubConfig.labels ? {
            'backlog': { status: 'backlog', label: githubConfig.labels.backlog || 'backlog' },
            'todo': { status: 'todo', label: githubConfig.labels.todo || 'to do' },
            'in-progress': { status: 'in_progress', label: githubConfig.labels.inProgress || 'in progress' },
            'done': { status: 'closed', label: githubConfig.labels.done || 'done' }
        } : {
            'backlog': { status: 'backlog', label: 'backlog' },
            'todo': { status: 'todo', label: 'to do' },
            'in-progress': { status: 'in_progress', label: 'in progress' },
            'done': { status: 'closed', label: 'done' }
        };
    }

    /**
     * Check if GitHub is connected
     */
    isConnected() {
        return this.api.isAuthenticated();
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected(),
            user: this.api.user,
            lastSync: this.lastSync,
            syncStatus: this.syncStatus,
            selectedRepo: this.api.selectedRepo,
            selectedProject: this.api.selectedProject
        };
    }

    /**
     * Authenticate with GitHub using OAuth or PAT
     */
    async authenticate(token, type = 'pat') {
        this.api.setToken(token, type);
        
        try {
            const user = await this.api.getCurrentUser();
            this.showNotification(`Connected to GitHub as ${user.login}`, 'success');
            return { success: true, user };
        } catch (error) {
            this.api.logout();
            throw error;
        }
    }

    /**
     * Disconnect from GitHub
     */
    disconnect() {
        this.api.logout();
        this.showNotification('Disconnected from GitHub', 'info');
    }

    /**
     * Get list of repositories
     */
    async getRepositories() {
        return await this.api.getRepositories();
    }

    /**
     * Select a repository
     */
    selectRepo(repo) {
        this.api.selectedRepo = repo;
        localStorage.setItem('github_selected_repo', JSON.stringify(repo));
        // Notify other components
        window.dispatchEvent(new CustomEvent('github-repo-selected', { detail: { repo } }));
    }

    /**
     * Get selected repository
     */
    getSelectedRepo() {
        return this.api.selectedRepo;
    }

    /**
     * Get project columns for selected repo
     */
    async getProjectColumns() {
        const repo = this.api.selectedRepo;
        if (!repo) return [];

        // Try to get GitHub Projects first
        try {
            const projects = await this.api.getProjects();
            if (projects && projects.length > 0) {
                return projects;
            }
        } catch (e) {
            console.warn('Could not fetch projects:', e);
        }

        // Fallback: use labels as columns
        const labels = await this.api.getRepoLabels(repo.owner.login, repo.name);
        return labels.filter(l => 
            ['backlog', 'to do', 'in progress', 'done'].includes(l.name.toLowerCase())
        );
    }

    /**
     * Push board data to GitHub
     */
    async pushBoard(kanbanBoard) {
        if (!this.isConnected()) {
            throw new Error('Not connected to GitHub');
        }

        const repo = this.api.selectedRepo;
        if (!repo) {
            throw new Error('No repository selected');
        }

        this.syncStatus = 'syncing';
        
        try {
            const existingIssues = await this.api.getRepoIssues(repo.owner.login, repo.name, 'all');
            const existingLabels = await this.api.getRepoLabels(repo.owner.login, repo.name);
            const existingMilestones = await this.api.getRepoMilestones(repo.owner.login, repo.name);
            
            // Create label mapping
            const labelMap = {};
            existingLabels.forEach(label => {
                labelMap[label.name.toLowerCase()] = label;
            });

            // Create status labels if they don't exist
            const statusLabels = ['backlog', 'to do', 'in progress', 'done'];
            for (const status of statusLabels) {
                if (!labelMap[status]) {
                    const colors = githubConfig.labelColors || {
                        'backlog': '6e7681',
                        'to do': '0e7a86',
                        'in progress': 'a371f7',
                        'done': '3fb950'
                    };
                    await this.api.createLabel(repo.owner.login, repo.name, status, colors[status] || 'ffffff');
                }
            }

            // Create milestone mapping
            const milestoneMap = {};
            existingMilestones.forEach(ms => {
                milestoneMap[ms.title.toLowerCase()] = ms;
            });

            // Push each task as an issue
            for (const task of kanbanBoard.tasks) {
                const statusLabel = this.getStatusLabel(task.status);

                // Find existing issue by title
                const existingIssue = existingIssues.find(i => i.title === task.title);

                // Combine task labels with status label (deduplicated)
                const taskLabels = (task.labels || []).map(l => typeof l === 'object' ? l.name : l);
                const allLabels = [...new Set([statusLabel, ...taskLabels])];

                // Ensure all labels exist on GitHub (create missing ones)
                for (const labelName of allLabels) {
                    if (!labelMap[labelName.toLowerCase()]) {
                        // Generate a color for this label
                        const labelColor = this.getLabelColor(labelName);
                        const newLabel = await this.api.createLabel(repo.owner.login, repo.name, labelName, labelColor);
                        labelMap[labelName.toLowerCase()] = newLabel;
                    }
                }

                // Handle milestone if task has one
                let milestoneNumber = null;
                if (task.milestone && task.milestone.name) {
                    const milestoneName = task.milestone.name.toLowerCase();
                    if (milestoneMap[milestoneName]) {
                        milestoneNumber = milestoneMap[milestoneName].number;
                    } else {
                        // Create the milestone
                        const milestoneColors = githubConfig.milestoneColors || {};
                        const colorKey = Object.keys(milestoneColors).find(key => key.toLowerCase() === milestoneName);
                        const color = colorKey ? milestoneColors[colorKey] : '9ca3af';
                        const newMilestone = await this.api.createMilestone(
                            repo.owner.login,
                            repo.name,
                            task.milestone.name,
                            '',
                            color
                        );
                        milestoneNumber = newMilestone.number;
                        milestoneMap[milestoneName] = newMilestone;
                    }
                }

                if (existingIssue) {
                    // Update existing issue
                    const updates = {
                        body: this.formatTaskBody(task),
                        labels: allLabels
                    };

                    if (task.assignee) {
                        const user = await this.getAssigneeLogin(task.assignee);
                        if (user) {
                            updates.assignees = [user];
                        }
                    }

                    if (milestoneNumber) {
                        updates.milestone = milestoneNumber;
                    }

                    await this.api.updateIssue(repo.owner.login, repo.name, existingIssue.number, updates);
                } else {
                    // Create new issue
                    const body = this.formatTaskBody(task);
                    const assignees = task.assignee ? [await this.getAssigneeLogin(task.assignee)].filter(Boolean) : [];

                    await this.api.createIssue(repo.owner.login, repo.name, task.title, body, allLabels, assignees, milestoneNumber);
                }
            }

            this.syncStatus = 'success';
            this.lastSync = new Date().toISOString();
            localStorage.setItem('github_last_sync', this.lastSync);
            
            this.showNotification(`Pushed ${kanbanBoard.tasks.length} tasks to GitHub`, 'success');
            return { success: true, taskCount: kanbanBoard.tasks.length };
            
        } catch (error) {
            this.syncStatus = 'error';
            this.showNotification('Push failed: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * Pull board data from GitHub
     */
    async pullBoard() {
        if (!this.isConnected()) {
            throw new Error('Not connected to GitHub');
        }

        const repo = this.api.selectedRepo;
        if (!repo) {
            throw new Error('No repository selected');
        }

        this.syncStatus = 'syncing';
        
        try {
            const issues = await this.api.getRepoIssues(repo.owner.login, repo.name, 'all');
            
            // Map GitHub issues to kanban tasks
            const tasks = [];
            let nextTaskId = 1;

            for (const issue of issues) {
                const status = this.getKanbanStatus(issue.labels);
                const assignee = issue.assignees.length > 0 ? issue.assignees[0].login : '';

                // Parse body for additional task info
                const taskData = this.parseTaskBody(issue.body);

                // Extract milestone
                let milestone = null;
                if (issue.milestone) {
                    milestone = {
                        number: issue.milestone.number,
                        title: issue.milestone.title
                    };
                }

                // Store all labels from the issue as objects with name and color
                const labels = issue.labels.map(l => ({
                    name: l.name,
                    color: l.color
                }));

                tasks.push({
                    id: nextTaskId++,
                    title: issue.title,
                    description: taskData.description || '',
                    status: status,
                    priority: taskData.priority || 'medium',
                    assignee: assignee,
                    dueDate: taskData.dueDate || '',
                    milestone: milestone,
                    project: taskData.project || null,
                    parentIssueId: taskData.parentIssueId || null,
                    labels: labels,
                    comments: taskData.comments || [],
                    attachments: taskData.attachments || [],
                    createdAt: issue.created_at,
                    updatedAt: issue.updated_at,
                    githubIssueNumber: issue.number,
                    githubUrl: issue.html_url
                });
            }

            this.syncStatus = 'success';
            this.lastSync = new Date().toISOString();
            localStorage.setItem('github_last_sync', this.lastSync);
            
            this.showNotification(`Pulled ${tasks.length} tasks from GitHub`, 'success');
            return { 
                success: true, 
                tasks: tasks,
                nextTaskId: nextTaskId
            };
            
        } catch (error) {
            this.syncStatus = 'error';
            this.showNotification('Pull failed: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * Sync board (push local changes, then pull remote changes)
     */
    async syncBoard(kanbanBoard) {
        // First push local changes
        await this.pushBoard(kanbanBoard);
        
        // Then pull remote changes
        const result = await this.pullBoard();
        
        return result;
    }

    /**
     * Get status label for kanban status
     */
    getStatusLabel(status) {
        const mapping = {
            'backlog': 'backlog',
            'todo': 'to do',
            'in-progress': 'in progress',
            'done': 'done'
        };
        return mapping[status] || 'backlog';
    }

    /**
     * Get kanban status from GitHub labels
     */
    getKanbanStatus(labels) {
        const labelNames = labels.map(l => l.name.toLowerCase());

        if (labelNames.includes('done')) return 'done';
        if (labelNames.includes('in progress')) return 'in-progress';
        if (labelNames.includes('to do')) return 'todo';
        return 'backlog';
    }

    /**
     * Get a color for a label (generate consistent color from name)
     */
    getLabelColor(labelName) {
        // Use a hash of the label name to generate a consistent color
        let hash = 0;
        for (let i = 0; i < labelName.length; i++) {
            hash = labelName.charCodeAt(i) + ((hash << 5) - hash);
        }

        // Generate a pastel-like color (avoid too dark or too light)
        const h = Math.abs(hash % 360);
        const s = 60 + (Math.abs(hash) % 20); // 60-80%
        const l = 40 + (Math.abs(hash) % 20); // 40-60%

        // Convert HSL to hex
        return this.hslToHex(h, s, l);
    }

    /**
     * Convert HSL to hex
     */
    hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `${f(0)}${f(8)}${f(4)}`;
    }

    /**
     * Format task body for GitHub issue
     */
    formatTaskBody(task) {
        let body = task.description || '';
        
        if (task.priority && task.priority !== 'medium') {
            body += `\n\n**Priority:** ${task.priority}`;
        }
        
        if (task.dueDate) {
            body += `\n\n**Due Date:** ${task.dueDate}`;
        }
        
        if (task.milestone && task.milestone.name) {
            body += `\n\n**Milestone:** ${task.milestone.name}`;
        }
        
        if (task.project && task.project.title) {
            body += `\n\n**Project:** ${task.project.title}`;
        }
        
        // Mention parent issue if set to create a visible link in GitHub
        if (task.parentIssueId) {
            body += `\n\n**Parent Issue:** #${task.parentIssueId}`;
        }
        
        // Add metadata as JSON for parsing on pull
        const metadata = {
            _pixelKanban: true,
            priority: task.priority,
            dueDate: task.dueDate,
            milestone: task.milestone || null,
            labels: task.labels || [],
            project: task.project || null,
            parentIssueId: task.parentIssueId || null,
            description: task.description,
            comments: task.comments || [],
            attachments: task.attachments || []
        };

        body += `\n\n<!-- pixelKanban metadata:\n${JSON.stringify(metadata)}\n-->`;
        
        return body;
    }

    /**
     * Parse task body from GitHub issue
     */
    parseTaskBody(body) {
        if (!body) return {};

        try {
            // Try to extract metadata from comment
            const match = body.match(/<!-- pixelKanban metadata:\n([\s\S]*?)\n-->/);
            if (match) {
                return JSON.parse(match[1]);
            }
        } catch (e) {
            console.warn('Could not parse task metadata:', e);
        }

        // Parse basic info from body (fallback for old tasks)
        const priorityMatch = body.match(/\*\*Priority:\*\* (\w+)/);
        const dueDateMatch = body.match(/\*\*Due Date:\*\* ([\d-]+)/);
        const milestoneMatch = body.match(/\*\*Milestone:\*\* (.+)/);

        return {
            priority: priorityMatch ? priorityMatch[1] : 'medium',
            dueDate: dueDateMatch ? dueDateMatch[1] : '',
            milestone: milestoneMatch ? { name: milestoneMatch[1].trim() } : null,
            labels: [],
            description: body.replace(/<!--[\s\S]*?-->/, '').replace(/\*\*.*?\*\*/g, '').trim()
        };
    }

    /**
     * Get assignee login from ID
     */
    async getAssigneeLogin(assigneeId) {
        if (!assigneeId) return null;
        
        // If it's already a GitHub username
        if (typeof assigneeId === 'string' && !assigneeId.match(/^\d+$/)) {
            return assigneeId;
        }
        
        // Try to get from userManager
        if (window.userManager) {
            const user = window.userManager.getUser(assigneeId);
            if (user && user.githubUsername) {
                return user.githubUsername;
            }
        }
        
        return null;
    }

    /**
     * Import collaborators as users
     */
    async importCollaboratorsAsUsers() {
        if (!this.isConnected()) {
            throw new Error('Not connected to GitHub');
        }

        const repo = this.api.selectedRepo;
        if (!repo) {
            throw new Error('No repository selected');
        }

        try {
            const collaborators = await this.api.getRepoCollaborators(repo.owner.login, repo.name);
            let importedCount = 0;

            for (const collab of collaborators) {
                // Check if user already exists
                const existingUser = window.userManager?.getUserByEmail(collab.email);
                if (existingUser) continue;

                // Create user from collaborator
                window.userManager?.createUser({
                    name: collab.login,
                    email: collab.email || `${collab.login}@users.noreply.github.com`,
                    role: 'developer',
                    githubUsername: collab.login,
                    photoURL: collab.avatar_url
                });
                importedCount++;
            }

            this.showNotification(`Imported ${importedCount} collaborators as users`, 'success');
            return { success: true, count: importedCount };
        } catch (error) {
            this.showNotification('Failed to import collaborators: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (window.notifications) {
            window.notifications.show(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }
}

/**
 * GitHubBoardsUI - User interface for GitHub integration
 */
class GitHubBoardsUI {
    constructor(app) {
        this.app = app;
        this.githubBoards = new GitHubBoards();
        this.init();
    }

    init() {
        this.addGitHubButtonToHeader();
        this.addGitHubModalToPage();
    }

    addGitHubButtonToHeader() {
        const headerControls = document.querySelector('.header-controls');
        if (!headerControls) return;

        // Use existing button from HTML instead of creating duplicate
        const githubBtn = document.getElementById('github-btn');
        if (githubBtn) {
            // Ensure correct title
            githubBtn.title = 'GitHub Boards';
            // Attach click handler to open modal
            githubBtn.addEventListener('click', () => this.openModal());
            return;
        }

        // Fallback: create button if it doesn't exist
        const newBtn = document.createElement('button');
        newBtn.id = 'github-boards-btn';
        newBtn.className = 'btn icon-only';
        newBtn.title = 'GitHub Boards';
        newBtn.innerHTML = '<i class="fab fa-github"></i>';
        newBtn.addEventListener('click', () => this.openModal());
        headerControls.appendChild(newBtn);
    }

    addGitHubModalToPage() {
        if (document.getElementById('github-modal')) return;

        const modalHTML = `
            <div class="modal-overlay" id="github-modal">
                <div class="modal" style="max-width: 500px;">
                    <header>
                        <div class="modal-title">
                            <i class="fab fa-github"></i> GitHub Boards
                        </div>
                        <button class="modal-close" id="github-modal-close">&times;</button>
                    </header>
                    <div class="modal-content">
                        <!-- Connection Status -->
                        <div class="github-connection-section" id="github-connection-section">
                            <div class="github-status" id="github-status-display">
                                <i class="fas fa-plug"></i>
                                <span id="github-connection-status">Not connected</span>
                            </div>
                            
                            <!-- Login Form -->
                            <div id="github-login-form">
                                <div class="form-group">
                                    <label>Authentication Method</label>
                                    <select id="github-auth-type">
                                        <option value="pat">Personal Access Token</option>
                                        <option value="oauth">OAuth Token</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Access Token</label>
                                    <input type="password" id="github-token" placeholder="ghp_xxxx or gho_xxxx">
                                    <small style="color: var(--text-secondary);">
                                        <a href="https://github.com/settings/tokens" target="_blank" style="color: var(--primary-color);">
                                            Generate token
                                        </a> (needs repo scope)
                                    </small>
                                </div>
                                <button id="github-connect-btn" class="btn primary" style="width: 100%;">
                                    <i class="fas fa-link"></i> Connect to GitHub
                                </button>
                            </div>
                            
                            <!-- Connected View -->
                            <div id="github-connected-view" style="display: none;">
                                <div class="github-user-info" id="github-user-info">
                                    <img id="github-user-avatar" src="" alt="" style="width: 48px; height: 48px; border-radius: 50%;">
                                    <div>
                                        <div id="github-user-name" style="font-weight: bold;"></div>
                                        <div id="github-user-login" style="color: var(--text-secondary); font-size: 0.9em;"></div>
                                    </div>
                                </div>
                                
                                <hr style="margin: 16px 0; border: none; border-top: 1px solid var(--border-color);">
                                
                                <!-- Repository Selection -->
                                <div class="form-group">
                                    <label>Repository</label>
                                    <select id="github-repo-select">
                                        <option value="">Select a repository...</option>
                                    </select>
                                </div>
                                <button id="github-refresh-repos-btn" class="btn btn-sm" style="margin-top: 8px;">
                                    <i class="fas fa-refresh"></i> Refresh
                                </button>
                                
                                <!-- Sync Actions -->
                                <div class="github-sync-actions" style="margin-top: 16px;">
                                    <button id="github-push-btn" class="btn primary" style="width: 100%; margin-bottom: 8px;" disabled>
                                        <i class="fas fa-upload"></i> Push to GitHub
                                    </button>
                                    <button id="github-pull-btn" class="btn" style="width: 100%; margin-bottom: 8px;" disabled>
                                        <i class="fas fa-download"></i> Pull from GitHub
                                    </button>
                                    <button id="github-sync-btn" class="btn" style="width: 100%;" disabled>
                                        <i class="fas fa-sync"></i> Sync Both Ways
                                    </button>
                                </div>
                                
                                <!-- Import Collaborators -->
                                <div style="margin-top: 16px;">
                                    <button id="github-import-users-btn" class="btn" style="width: 100%;" disabled>
                                        <i class="fas fa-users"></i> Import Collaborators as Users
                                    </button>
                                    <div id="github-collaborators-list" style="margin-top: 12px; max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; padding: 8px;">
                                        <p style="color: var(--text-secondary); font-size: 0.9em;">Select a repository to see collaborators</p>
                                    </div>
                                </div>
                                
                                <hr style="margin: 16px 0; border: none; border-top: 1px solid var(--border-color);">
                                
                                <div class="github-last-sync" id="github-last-sync" style="color: var(--text-secondary); font-size: 0.9em;">
                                    Last sync: Never
                                </div>
                                
                                <button id="github-disconnect-btn" class="btn" style="width: 100%; margin-top: 12px; color: var(--error-color);">
                                    <i class="fas fa-unlink"></i> Disconnect
                                </button>
                            </div>
                        </div>
                        
                        <div id="github-status-message" class="github-status-message" style="margin-top: 12px;"></div>
                    </div>
                    <footer>
                        <div class="modal-actions">
                            <button class="btn" id="github-close-btn">Close</button>
                        </div>
                    </footer>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.setupEventListeners();
        this.updateUI();
    }

    setupEventListeners() {
        // Modal controls
        document.getElementById('github-modal-close')?.addEventListener('click', () => this.closeModal());
        document.getElementById('github-close-btn')?.addEventListener('click', () => this.closeModal());
        
        document.getElementById('github-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'github-modal') this.closeModal();
        });

        // Connect button
        document.getElementById('github-connect-btn')?.addEventListener('click', async () => {
            const token = document.getElementById('github-token').value.trim();
            const type = document.getElementById('github-auth-type').value;
            
            if (!token) {
                this.showStatus('Please enter a token', 'error');
                return;
            }
            
            try {
                await this.githubBoards.authenticate(token, type);
                this.updateUI();
                this.loadRepositories();
            } catch (error) {
                this.showStatus('Authentication failed: ' + error.message, 'error');
            }
        });

        // Disconnect button
        document.getElementById('github-disconnect-btn')?.addEventListener('click', () => {
            this.githubBoards.disconnect();
            this.updateUI();
        });

        // Repository selection
        document.getElementById('github-repo-select')?.addEventListener('change', (e) => {
            const repoJson = e.target.value;
            if (repoJson) {
                const repo = JSON.parse(repoJson);
                this.githubBoards.selectRepo(repo);
                this.enableSyncButtons();
            } else {
                this.disableSyncButtons();
            }
        });

        // Refresh repos
        document.getElementById('github-refresh-repos-btn')?.addEventListener('click', () => {
            this.loadRepositories();
        });

        // Push button
        document.getElementById('github-push-btn')?.addEventListener('click', async () => {
            if (window.kanbanBoard) {
                try {
                    await this.githubBoards.pushBoard(window.kanbanBoard);
                    this.updateSyncStatus();
                } catch (error) {
                    this.showStatus('Push failed: ' + error.message, 'error');
                }
            }
        });

        // Pull button
        document.getElementById('github-pull-btn')?.addEventListener('click', async () => {
            try {
                const result = await this.githubBoards.pullBoard();
                if (result.success && window.kanbanBoard) {
                    window.kanbanBoard.tasks = result.tasks;
                    window.kanbanBoard.nextTaskId = result.nextTaskId;
                    window.kanbanBoard.saveTasks();
                    window.kanbanBoard.renderBoard();
                }
                this.updateSyncStatus();
            } catch (error) {
                this.showStatus('Pull failed: ' + error.message, 'error');
            }
        });

        // Sync button
        document.getElementById('github-sync-btn')?.addEventListener('click', async () => {
            if (window.kanbanBoard) {
                try {
                    const result = await this.githubBoards.syncBoard(window.kanbanBoard);
                    if (result.success && window.kanbanBoard) {
                        window.kanbanBoard.tasks = result.tasks;
                        window.kanbanBoard.nextTaskId = result.nextTaskId;
                        window.kanbanBoard.saveTasks();
                        window.kanbanBoard.renderBoard();
                    }
                    this.updateSyncStatus();
                } catch (error) {
                    this.showStatus('Sync failed: ' + error.message, 'error');
                }
            }
        });
        
        // Import collaborators button
        document.getElementById('github-import-users-btn')?.addEventListener('click', async () => {
            try {
                await this.githubBoards.importCollaboratorsAsUsers();
                // Refresh the user dropdown in kanban board
                if (window.kanbanBoard) {
                    window.kanbanBoard.populateAssigneeDropdown();
                }
            } catch (error) {
                this.showStatus('Import failed: ' + error.message, 'error');
            }
        });
    }

    openModal() {
        document.getElementById('github-modal')?.classList.add('active');
        this.updateUI();
    }

    closeModal() {
        document.getElementById('github-modal')?.classList.remove('active');
    }

    async autoConnect() {
        // Auto-connect using config token
        if (!isGitHubConfigured()) return;
        
        try {
            await this.githubBoards.authenticate(
                githubConfig.accessToken, 
                githubConfig.tokenType || 'pat'
            );
            this.updateUI();
            this.loadRepositories();
        } catch (error) {
            console.warn('Auto-connect failed:', error.message);
        }
    }

    updateUI() {
        const status = this.githubBoards.getStatus();
        const loginForm = document.getElementById('github-login-form');
        const connectedView = document.getElementById('github-connected-view');
        const connectionStatus = document.getElementById('github-connection-status');
        
        // Auto-connect if token is configured
        if (!status.connected && isGitHubConfigured() && githubConfig.accessToken) {
            this.autoConnect();
            return;
        }
        
        if (status.connected) {
            loginForm.style.display = 'none';
            connectedView.style.display = 'block';
            if (status.user) {
                connectionStatus.textContent = `Connected as ${status.user.login}`;
                
                // Update user info
                const avatar = document.getElementById('github-user-avatar');
                const name = document.getElementById('github-user-name');
                const login = document.getElementById('github-user-login');
                
                if (status.user.avatar_url) avatar.src = status.user.avatar_url;
                name.textContent = status.user.name || status.user.login;
                login.textContent = `@${status.user.login}`;
            } else {
                connectionStatus.textContent = 'Connected';
            }
            
            // Load repositories if not loaded
            this.loadRepositories();
        } else {
            loginForm.style.display = 'block';
            connectedView.style.display = 'none';
            connectionStatus.textContent = 'Not connected';
        }
        
        this.updateSyncStatus();
    }

    /**
     * Guess the current site's repository based on the URL.
     * Works for GitHub Pages deployments (user or project sites).
     */
    guessCurrentSiteRepo() {
        try {
            const hostname = window.location.hostname;
            // Only attempt on GitHub Pages domains
            if (!hostname.includes('github.io')) {
                return null;
            }
            
            // Extract owner from hostname: e.g., 'username' from 'username.github.io'
            const hostParts = hostname.split('.');
            const owner = hostParts[0]; // 'username'
            
            // Determine repo from path
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            let repo;
            if (pathParts.length > 0) {
                // Project site: https://username.github.io/repo/
                repo = pathParts[0];
            } else {
                // User site: https://username.github.io/ -> repo is username.github.io
                repo = `${owner}.github.io`;
            }
            
            return {
                owner: { login: owner },
                name: repo,
                fullName: `${owner}/${repo}`
            };
        } catch (e) {
            console.warn('Failed to guess current site repo:', e);
            return null;
        }
    }

    async loadRepositories() {
        const repoSelect = document.getElementById('github-repo-select');
        if (!repoSelect) return;
        
        try {
            const repos = await this.githubBoards.getRepositories();
            
            repoSelect.innerHTML = '<option value="">Select a repository...</option>';
            
            const savedRepo = this.githubBoards.getSelectedRepo();
            let selected = false;
            
            repos.forEach(repo => {
                const option = document.createElement('option');
                option.value = JSON.stringify({
                    owner: repo.owner,
                    name: repo.name,
                    fullName: repo.full_name
                });
                option.textContent = repo.full_name;
                
                if (savedRepo && savedRepo.fullName === repo.full_name) {
                    option.selected = true;
                    selected = true;
                    this.enableSyncButtons();
                }
                
                repoSelect.appendChild(option);
            });
            
            // If no repo selected yet, try to auto-detect based on current site URL
            if (!selected && !savedRepo) {
                const guessed = this.guessCurrentSiteRepo();
                if (guessed) {
                    // Find matching repo in the list
                    const match = repos.find(r => 
                        r.owner.login === guessed.owner.login && r.name === guessed.name
                    );
                    if (match) {
                        // Select this repo
                        this.githubBoards.selectRepo({
                            owner: { login: match.owner.login },
                            name: match.name,
                            fullName: match.full_name
                        });
                        // Update select UI
                        repoSelect.value = JSON.stringify({
                            owner: { login: match.owner.login },
                            name: match.name,
                            fullName: match.full_name
                        });
                        selected = true;
                        this.enableSyncButtons();
                        console.log(`Auto-selected repository: ${match.full_name} based on site URL`);
                    }
                }
            }
            
        } catch (error) {
            this.showStatus('Failed to load repositories: ' + error.message, 'error');
        }
    }

    enableSyncButtons() {
        document.getElementById('github-push-btn').disabled = false;
        document.getElementById('github-pull-btn').disabled = false;
        document.getElementById('github-sync-btn').disabled = false;
        document.getElementById('github-import-users-btn').disabled = false;
        this.loadCollaborators();
    }

    disableSyncButtons() {
        document.getElementById('github-push-btn').disabled = true;
        document.getElementById('github-pull-btn').disabled = true;
        document.getElementById('github-sync-btn').disabled = true;
        document.getElementById('github-import-users-btn').disabled = true;
    }

    updateSyncStatus() {
        const status = this.githubBoards.getStatus();
        const lastSyncEl = document.getElementById('github-last-sync');
        
        if (lastSyncEl) {
            if (status.lastSync) {
                const date = new Date(status.lastSync);
                lastSyncEl.textContent = `Last sync: ${date.toLocaleString()}`;
            } else {
                lastSyncEl.textContent = 'Last sync: Never';
            }
        }
    }

    async loadCollaborators() {
        const collaboratorsEl = document.getElementById('github-collaborators-list');
        if (!collaboratorsEl) return;
        
        const repo = this.githubBoards.getSelectedRepo();
        if (!repo) {
            collaboratorsEl.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9em;">Select a repository to see collaborators</p>';
            return;
        }
        
        try {
            const collaborators = await this.githubBoards.getRepoCollaborators(repo.owner.login, repo.name);
            
            if (collaborators.length === 0) {
                collaboratorsEl.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9em;">No collaborators found</p>';
                return;
            }
            
            collaboratorsEl.innerHTML = collaborators.map(collab => `
                <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--border-color);">
                    <img src="${collab.avatar_url}" style="width: 24px; height: 24px; border-radius: 50%;">
                    <span style="font-size: 0.9em;">${collab.login}</span>
                </div>
            `).join('');
        } catch (error) {
            collaboratorsEl.innerHTML = '<p style="color: var(--error-color); font-size: 0.9em;">Failed to load collaborators</p>';
        }
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('github-status-message');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = type === 'error' ? 'var(--error-color)' : 
                                   type === 'success' ? 'var(--success-color)' : 
                                   'var(--text-secondary)';
            
            setTimeout(() => {
                statusEl.textContent = '';
            }, 5000);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const initGitHub = () => {
        if (window.Notifications) {
            window.githubBoardsUI = new GitHubBoardsUI({
                kanbanBoard: window.kanbanBoard,
                notifications: window.Notifications
            });
            // Note: GitHub button event listener is now set up inside GitHubBoardsUI.addGitHubButtonToHeader()
        } else {
            setTimeout(initGitHub, 100);
        }
    };
    initGitHub();
});
