/**
 * Kanban Board Management
 */
class KanbanBoard {
    constructor() {
        this.tasks = [];
        this.nextTaskId = 1;
        this.columns = ['backlog', 'todo', 'in-progress', 'done'];
        this.columnNames = ['Backlog', 'To Do', 'In Progress', 'Done'];
        this.panelConfig = {
            count: 4,
            names: ['Backlog', 'To Do', 'In Progress', 'Done']
        };
        // Cache for GitHub label colors: { labelName: 'hexcolor' }
        this.labelColorMap = {};
        this.iconStyle = localStorage.getItem('kanban-icon-style') || 'emoji'; // 'emoji' or 'fontawesome'
        this.init();
    }

    // Set icon style and re-render board
    setIconStyle(style) {
        this.iconStyle = style;
        localStorage.setItem('kanban-icon-style', style);
        this.renderBoard();
    }

    // Get icon for a type based on current icon style
    getIcon(type) {
        const iconMap = {
            pencil: { emoji: '✏️', fontawesome: 'fas fa-pencil-alt' },
            trash: { emoji: '🗑️', fontawesome: 'fas fa-trash' },
            image: { emoji: '🖼️', fontawesome: 'fas fa-image' },
            video: { emoji: '🎬', fontawesome: 'fas fa-video' },
            music: { emoji: '🎵', fontawesome: 'fas fa-music' },
            file: { emoji: '📄', fontawesome: 'fas fa-file' },
            link: { emoji: '🔗', fontawesome: 'fas fa-link' },
            user: { emoji: '👤', fontawesome: 'fas fa-user' },
            edit: { emoji: '✏️', fontawesome: 'fas fa-edit' },
            check: { emoji: '✅', fontawesome: 'fas fa-check' },
            clipboard: { emoji: '📋', fontawesome: 'fas fa-clipboard-list' },
            cog: { emoji: '⚙️', fontawesome: 'fas fa-cog' },
            save: { emoji: '💾', fontawesome: 'fas fa-save' },
            export: { emoji: '📤', fontawesome: 'fas fa-file-export' },
            import: { emoji: '📥', fontawesome: 'fas fa-file-import' },
            plus: { emoji: '➕', fontawesome: 'fas fa-plus' },
            undo: { emoji: '↩️', fontawesome: 'fas fa-undo' },
            close: { emoji: '✖️', fontawesome: 'fas fa-times' },
            envelope: { emoji: '✉️', fontawesome: 'fas fa-envelope' }
        };

        const icons = iconMap[type] || iconMap.file;
        if (this.iconStyle === 'emoji') {
            return icons.emoji;
        } else {
            return `<i class="${icons.fontawesome}"></i>`;
        }
    }

    /**
     * Get a color for a label - accepts string label name or object {name, color}
     * First checks local label settings, then GitHub cache, then generates a consistent color
     * Returns color without # prefix
     */
    getLabelColor(label) {
        // If label is an object with color property, use it
        if (typeof label === 'object' && label && label.color) {
            return label.color.replace('#', '');
        }

        // Get label name as string
        const labelName = typeof label === 'string' ? label : (label?.name || '');
        if (!labelName) return '0075ca'; // Default blue

        // First check local label settings (kanban-labels in localStorage)
        try {
            const stored = localStorage.getItem('kanban-labels');
            if (stored) {
                const labels = JSON.parse(stored);
                const found = labels.find(l => l.name === labelName);
                if (found && found.color) {
                    return found.color.replace('#', '');
                }
            }
        } catch (e) {
            // Ignore parse errors
        }

        // Then check GitHub label cache
        if (this.labelColorMap && this.labelColorMap[labelName]) {
            return this.labelColorMap[labelName].replace('#', '');
        }

        // Fallback: generate consistent color from name
        let hash = 0;
        for (let i = 0; i < labelName.length; i++) {
            hash = labelName.charCodeAt(i) + ((hash << 5) - hash);
        }

        const h = Math.abs(hash % 360);
        const s = 60 + (Math.abs(hash) % 20);
        const l = 40 + (Math.abs(hash) % 20);

        return this.hslToHex(h, s, l);
    }

    init() {
        // Migrate any corrupted milestone data
        this.migrateTaskData();
        this.loadTasks();
        this.renderBoard();
        this.setupEventListeners();
        this.setupEmailModalListeners();
        this.setupMessagesSidebarListeners();
    }

    // Migrate task data to fix any corruption
    migrateTaskData() {
        try {
            const saved = localStorage.getItem('kanban-tasks');
            if (!saved) return;
            const tasks = JSON.parse(saved);
            let changed = false;
            tasks.forEach(task => {
                // Fix corrupted milestone data
                if (task.milestone && typeof task.milestone === 'object') {
                    // Check if it's a valid milestone object
                    if (!task.milestone.name && !task.milestone.title) {
                        // Try to extract from string representation
                        const str = String(task.milestone);
                        if (str.includes('[object Object]')) {
                            task.milestone = null;
                            changed = true;
                        }
                    }
                }
            });
            if (changed) {
                localStorage.setItem('kanban-tasks', JSON.stringify(tasks));
                console.log('Migrated task data: fixed corrupted milestone');
            }
        } catch (e) {
            console.warn('Failed to migrate task data:', e);
        }
    }

    // Safely get milestone display name
    getMilestoneDisplayName(milestone) {
        if (!milestone) return '';
        if (typeof milestone === 'string') {
            // If it's "[object Object]", return empty string
            if (milestone === '[object Object]') return '';
            return milestone;
        }
        if (typeof milestone === 'object') {
            return milestone.name || milestone.title || '';
        }
        return String(milestone);
    }

    // Task Management
    createTask(data) {
        const task = {
            id: this.nextTaskId++,
            title: data.title,
            description: data.description || '',
            emoji: data.emoji || '',
            assignee: data.assignee || '',
            userId: data.userId || null,
            priority: data.priority || 'medium',
            status: data.status || 'backlog',
            dueDate: data.dueDate || '',
            milestone: data.milestone || null, // { name: string, number: number } or null
            project: data.project || null,   // { id: string, title: string } or null
            parentIssueId: data.parentIssueId || null,
            labels: data.labels || [], // Array of label names
            backgroundColor: data.backgroundColor || '#2d2d2d',
            attachments: data.attachments || [], // Array of {type, url, name}
            comments: data.comments || [], // Array of {id, userId, text, createdAt}
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.tasks.push(task);
        this.saveTasks();
        return task;
    }

    updateTask(id, updates) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            Object.assign(task, updates, { updatedAt: new Date().toISOString() });
            this.saveTasks();
            this.renderBoard();
        }
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveTasks();
        this.renderBoard();
    }

    moveTask(taskId, newStatus) {
        this.updateTask(taskId, { status: newStatus });
    }

    // Rendering
    renderBoard() {
        // Load panel configuration
        this.loadPanelConfig();

        // Render columns based on configuration
        this.columns.forEach((status, index) => {
            const column = document.getElementById(`${status}-tasks`);
            if (column) {
                column.innerHTML = '';
                const columnTasks = this.tasks.filter(task => task.status === status);
                columnTasks.forEach(task => this.renderTask(task, column));
            }
        });

        // Update column headers with names
        this.columns.forEach((status, index) => {
            const columnElement = document.getElementById(`${status}-tasks`);
            if (columnElement && columnElement.closest && columnElement.closest('.kanban-column')) {
                const header = columnElement.closest('.kanban-column').querySelector('.column-header h3');
                if (header && this.panelConfig.names[index]) {
                    header.textContent = this.panelConfig.names[index];
                }
            }
        });

        this.updateTaskCounts();
    }

    // Load panel configuration
    loadPanelConfig() {
        const savedConfig = localStorage.getItem('kanban-panel-config');
        if (savedConfig) {
            this.panelConfig = JSON.parse(savedConfig);
        }
    }

    // Update task counts
    updateTaskCounts() {
        this.columns.forEach(status => {
            const countElement = document.getElementById(`${status}-count`);
            if (countElement) {
                const count = this.tasks.filter(task => task.status === status).length;
                countElement.textContent = count;
            }
        });
    }

    renderTask(task, container) {
        const taskElement = document.createElement('div');
        taskElement.className = 'task-card';
        taskElement.draggable = true;
        taskElement.dataset.taskId = task.id;

        // Apply background color
        if (task.backgroundColor && task.backgroundColor !== '#2d2d2d') {
            taskElement.style.backgroundColor = task.backgroundColor;
        }

        const assigneeName = task.assignee ? this.getUserName(task.assignee) : 'Unassigned';
        const assigneeEmail = task.assignee ? this.getUserEmail(task.assignee) : '';
        const dueDate = task.dueDate ? this.formatTaskDate(task.dueDate) : '';
        const createdDate = this.formatTaskDate(task.createdAt);

        // Determine due date color based on urgency
        let dueDateClass = '';
        if (task.dueDate) {
            const due = new Date(task.dueDate);
            const now = new Date();
            const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            if (due < now) {
                dueDateClass = 'past-due';
            } else if (due <= oneWeekFromNow) {
                dueDateClass = 'due-soon';
            } else {
                dueDateClass = 'due-later';
            }
        }

        // Determine milestone class for styling
        let milestoneClass = 'task-milestone-badge';
        const milestoneName = this.getMilestoneDisplayName(task.milestone);
        if (milestoneName) {
            const msName = milestoneName.toLowerCase().replace(/\s+/g, '-');
            milestoneClass += ` milestone-${msName}`;
        }

        // Build label badges HTML
        let labelsHTML = '';
        if (task.labels && task.labels.length > 0) {
            labelsHTML = '<div class="task-labels">';
            task.labels.forEach(label => {
                const labelName = typeof label === 'object' ? label.name : label;
                const bgColor = this.getLabelColor(label);
                const textColor = this.getLabelTextColor(bgColor);
                labelsHTML += `<span class="task-label-badge" style="background-color: #${bgColor}; color: ${textColor}">${this.escapeHtml(labelName)}</span>`;
            });
            labelsHTML += '</div>';
        }

        // Render attachments as a list
        let attachmentsHTML = '';
        if (task.attachments && task.attachments.length > 0) {
            attachmentsHTML = '<div class="task-attachments">';
            task.attachments.forEach((att, index) => {
                const isImage = att.type === 'image';
                const preview = isImage ? `<img src="${att.url}" alt="${att.name}" onerror="this.style.display='none'">` : '';
                
                // Use appropriate icon based on setting
                let iconHtml;
                if (this.iconStyle === 'emoji') {
                    const iconMap = {
                        image: '🖼️',
                        video: '🎬',
                        audio: '🎵',
                        document: '📄',
                        link: '🔗'
                    };
                    iconHtml = iconMap[att.type] || '📄';
                } else {
                    const iconClass = this.getAttachmentIcon(att.type);
                    iconHtml = `<i class="fas ${iconClass}"></i>`;
                }

                attachmentsHTML += `
                    <div class="attachment-item" onclick="kanbanBoard.openGallery('${task.id}', ${index})">
                        <div class="attachment-icon">${preview || iconHtml}</div>
                        <div class="attachment-name">${att.name || att.url}</div>
                    </div>
                `;
            });
            attachmentsHTML += '</div>';
        }

        taskElement.innerHTML = `
            <div class="task-card-header">
                <div class="task-title-row">
                    ${task.emoji ? `<span class="task-emoji">${this.escapeHtml(task.emoji)}</span>` : ''}
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                </div>
            </div>
            <div class="task-card-body">
                <div class="task-description">${this.escapeHtml(task.description)}</div>
                ${attachmentsHTML}
                <div class="task-meta">
                    <div class="task-assignee" ${assigneeEmail ? 'style="cursor: pointer;" data-email="' + assigneeEmail + '"' : ''}>${assigneeName}</div>
                    <div class="task-priority ${task.priority}">${task.priority}</div>
                </div>
            </div>
            <div class="task-card-footer">
                ${dueDate ? `<div class="task-due-date ${dueDateClass}">Due: ${dueDate}</div>` : ''}
                ${milestoneName ? `<div class="${milestoneClass}">${this.escapeHtml(milestoneName)}</div>` : ''}
                ${labelsHTML}
                <div class="task-created-date">Created: ${createdDate}</div>
                <div class="task-actions">
                    <button class="task-action-btn edit" data-action="edit" title="Edit Task">
                        ${this.getIcon('pencil')}
                    </button>
                    <button class="task-action-btn delete" data-action="delete" title="Delete Task">
                        ${this.getIcon('trash')}
                    </button>
                </div>
            </div>
        `;

        // Add click handler for assignee email
        const assigneeEl = taskElement.querySelector('.task-assignee[data-email]');
        if (assigneeEl) {
            assigneeEl.addEventListener('click', () => {
                this.openEmailModal(assigneeEmail, task.title);
            });
        }

        // Add event listeners for actions
        taskElement.querySelectorAll('.task-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                if (action === 'edit') {
                    this.openTaskModal(task);
                } else if (action === 'delete') {
                    this.deleteTaskWithConfirmation(task.id);
                }
            });
        });

        // Add double-click to edit
        taskElement.addEventListener('dblclick', () => this.openTaskModal(task));

        container.appendChild(taskElement);
    }

    // Check if URL is a video
    isVideoUrl(url) {
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
        return videoExtensions.some(ext => url.toLowerCase().includes(ext)) ||
            url.includes('youtube.com') ||
            url.includes('youtu.be') ||
            url.includes('vimeo.com');
    }

    // Open gallery modal
    openGallery(taskId, attachmentIndex = 0) {
        const task = this.tasks.find(t => t.id == taskId);
        if (!task || !task.attachments || task.attachments.length === 0) return;

        this.currentGalleryTaskId = taskId;
        this.currentGalleryIndex = attachmentIndex;

        const modal = document.getElementById('gallery-modal');
        const content = document.getElementById('gallery-content');
        const title = document.getElementById('gallery-modal-title');
        const prevBtn = document.getElementById('gallery-prev-btn');
        const nextBtn = document.getElementById('gallery-next-btn');

        title.textContent = `Attachments: ${task.title}`;

        // Show/hide navigation buttons based on attachment count
        if (task.attachments.length > 1) {
            if (prevBtn) prevBtn.style.display = 'flex';
            if (nextBtn) nextBtn.style.display = 'flex';
        } else {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
        }

        this.renderGalleryAttachment(task, attachmentIndex);
        modal.classList.add('active');
    }

    // Render a single gallery attachment
    renderGalleryAttachment(task, index) {
        const content = document.getElementById('gallery-content');
        const counter = document.getElementById('gallery-counter');

        if (!task.attachments[index]) return;

        const att = task.attachments[index];
        const isYouTube = this.isYouTubeUrl(att.url);
        const isVimeo = this.isVimeoUrl(att.url);
        const isVideo = this.isVideoUrl(att.url) || isYouTube || isVimeo;
        const isImage = att.type === 'image';
        const isAudio = att.type === 'audio';

        // Update counter
        if (counter) {
            counter.textContent = `${index + 1} / ${task.attachments.length}`;
        }

        let html = '';

        if (isYouTube) {
            // YouTube embed
            const videoId = this.getYouTubeVideoId(att.url);
            html = `<div class="gallery-preview">
                <div class="gallery-video-player">
                    <iframe 
                        src="https://www.youtube.com/embed/${videoId}" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen
                        style="width: 100%; max-width: 800px; aspect-ratio: 16/9;">
                    </iframe>
                </div>
                <div class="gallery-info">
                    <h4>${this.escapeHtml(att.name || 'YouTube Video')}</h4>
                    <a href="${att.url}" target="_blank" class="btn btn-sm">Open on YouTube</a>
                </div>
            </div>`;
        } else if (isVimeo) {
            // Vimeo embed
            const videoId = this.getVimeoVideoId(att.url);
            html = `<div class="gallery-preview">
                <div class="gallery-video-player">
                    <iframe 
                        src="https://player.vimeo.com/video/${videoId}" 
                        frameborder="0" 
                        allow="autoplay; fullscreen; picture-in-picture" 
                        allowfullscreen
                        style="width: 100%; max-width: 800px; aspect-ratio: 16/9;">
                    </iframe>
                </div>
                <div class="gallery-info">
                    <h4>${this.escapeHtml(att.name || 'Vimeo Video')}</h4>
                    <a href="${att.url}" target="_blank" class="btn btn-sm">Open on Vimeo</a>
                </div>
            </div>`;
        } else if (isVideo) {
            // Video player for direct video files
            html = `<div class="gallery-preview">
                <div class="gallery-video-player">
                    <video controls autoplay style="max-width: 100%; max-height: 60vh;">
                        <source src="${att.url}" type="video/${this.getVideoType(att.url)}">
                        Your browser does not support the video tag.
                    </video>
                </div>
                <div class="gallery-info">
                    <h4>${this.escapeHtml(att.name || 'Video')}</h4>
                    <a href="${att.url}" target="_blank" class="btn btn-sm">Open in New Tab</a>
                </div>
            </div>`;
        } else if (isAudio) {
            // Audio player
            html = `<div class="gallery-review">
                <div class="gallery-audio-player">
                    <div class="audio-icon">${this.getIcon('music')}</div>
                    <audio controls style="width: 100%;">
                        <source src="${att.url}">
                        Your browser does not support the audio tag.
                    </audio>
                </div>
                <div class="gallery-info">
                    <h4>${this.escapeHtml(att.name || 'Audio')}</h4>
                    <a href="${att.url}" target="_blank" class="btn btn-sm">Open in New Tab</a>
                </div>
            </div>`;
        } else if (isImage) {
            // Image preview
            html = `<div class="gallery-review">
                <div class="gallery-image-review">
                    <img src="${att.url}" alt="${this.escapeHtml(att.name)}" onerror="this.parentHTML='<div class=\"gallery-error\">${this.getIcon('image')}<p>Image failed to load</p></div>';">
                </div>
                <div class="gallery-info">
                    <h4>${this.escapeHtml(att.name || 'Image')}</h4>
                    <a href="${att.url}" target="_blank" class="btn btn-sm">Open Original</a>
                </div>
            </div>`;
        } else {
            // Generic file link
            html = `<div class="gallery-review">
                <div class="gallery-generic-review">
                    ${this.getIcon('file')}
                    <p>${this.escapeHtml(att.name || att.url)}</p>
                </div>
                <div class="gallery-info">
                    <a href="${att.url}" target="_blank" class="btn btn-sm">Open File</a>
                </div>
            </div>`;
        }

        content.innerHTML = html;
    }

    // Check if URL is YouTube
    isYouTubeUrl(url) {
        return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('youtube.be');
    }

    // Get YouTube video ID
    getYouTubeVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
            return match[2];
        }
        // Handle youtu.be short links
        if (url.includes('youtu.be/')) {
            return url.split('youtu.be/')[1].split('?')[0];
        }
        return null;
    }

    // Check if URL is Vimeo
    isVimeoUrl(url) {
        return url.includes('vimeo.com');
    }

    // Get Vimeo video ID
    getVimeoVideoId(url) {
        const regExp = /vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/;
        const match = url.match(regExp);
        if (match && match[1]) {
            return match[1];
        }
        return null;
    }

    // Navigate to previous attachment
    galleryPrev() {
        if (!this.currentGalleryTaskId) return;
        const task = this.tasks.find(t => t.id == this.currentGalleryTaskId);
        if (!task || !task.attachments) return;

        this.currentGalleryIndex = (this.currentGalleryIndex - 1 + task.attachments.length) % task.attachments.length;
        this.renderGalleryAttachment(task, this.currentGalleryIndex);
    }

    // Navigate to next attachment
    galleryNext() {
        if (!this.currentGalleryTaskId) return;
        const task = this.tasks.find(t => t.id == this.currentGalleryTaskId);
        if (!task || !task.attachments) return;

        this.currentGalleryIndex = (this.currentGalleryIndex + 1) % task.attachments.length;
        this.renderGalleryAttachment(task, this.currentGalleryIndex);
    }

    // Get video type from URL
    getVideoType(url) {
        if (url.includes('.mp4')) return 'mp4';
        if (url.includes('.webm')) return 'webm';
        if (url.includes('.ogg')) return 'ogg';
        return 'mp4';
    }

    // Close gallery modal
    closeGalleryModal() {
        document.getElementById('gallery-modal').classList.remove('active');
        this.currentGalleryTaskId = null;
        this.currentGalleryIndex = 0;
    }

    // Get user email by ID
    getUserEmail(userId) {
        if (window.userManager && window.userManager.users) {
            const user = window.userManager.users.find(u => u.id == userId);
            return user ? user.email || '' : '';
        }
        return '';
    }

    // Convert HSL to hex
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

    // Get appropriate text color (black or white) based on background luminance
    getLabelTextColor(bgHexColor) {
        // Remove # if present
        const hex = bgHexColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    // Open email modal
    openEmailModal(email, taskTitle) {
        if (!email) return;

        const modal = document.getElementById('email-modal');
        document.getElementById('email-to').value = email;
        document.getElementById('email-subject').value = `Regarding task: ${taskTitle}`;
        document.getElementById('email-body').value = '';

        // Update send button to open email client
        const sendBtn = document.getElementById('email-send-btn');
        const subject = encodeURIComponent(`Regarding task: ${taskTitle}`);
        const body = encodeURIComponent('');
        sendBtn.href = `mailto:${email}?subject=${subject}&body=${body}`;

        modal.classList.add('active');
    }

    closeEmailModal() {
        document.getElementById('email-modal').classList.remove('active');
    }

    // Helper method to format dates based on settings
    formatTaskDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);

        // Get date format from settingsManager if available
        let dateFormat = 'uk';
        if (window.settingsManager) {
            dateFormat = window.settingsManager.dateFormat || 'uk';
        }

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        if (dateFormat === 'us') {
            return `${month}/${day}/${year}`;
        } else {
            return `${day}/${month}/${year}`;
        }
    }

    // Helper method to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Delete task with confirmation
    deleteTaskWithConfirmation(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
                this.deleteTask(taskId);
            }
        }
    }

    // Modal Management
    async openTaskModal(task = null) {
        const modal = document.getElementById('task-modal');
        const form = document.getElementById('task-form');
        const title = document.getElementById('task-modal-title');
        const milestoneSelect = document.getElementById('task-milestone');

        if (task) {
            title.textContent = 'Edit Task';
            document.getElementById('task-emoji').value = task.emoji || '';
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-description').value = task.description;
            document.getElementById('task-assignee').value = task.assignee;
            document.getElementById('task-priority').value = task.priority;
            document.getElementById('task-due-date').value = task.dueDate;
            document.getElementById('task-bg-color').value = task.backgroundColor || '#2d2d2d';
            this.renderAttachmentsList(task.attachments || []);
            this.renderCommentsList(task.comments || []);
            form.dataset.taskId = task.id;
            this.currentTaskId = task.id;
        } else {
            title.textContent = 'Add Task';
            form.reset();
            document.getElementById('task-bg-color').value = '#2d2d2d';
            this.renderAttachmentsList([]);
            this.renderCommentsList([]);
            delete form.dataset.taskId;
            this.currentTaskId = null;
        }

        this.populateAssigneeDropdown();
        await this.populateMilestoneDropdown();

        // Reset placeholder opacity before populating labels
        const placeholder = document.querySelector('#label-select-trigger .label-select-placeholder');
        if (placeholder) placeholder.style.opacity = '1';

        await this.populateLabelsDropdown();
        await this.populateProjectDropdown();

        // Set milestone after populating dropdown — match by number
        if (task && milestoneSelect && task.milestone) {
            const num = task.milestone.number || null;
            const title = this.getMilestoneDisplayName(task.milestone);
            // Try matching by number first, then by title text
            const byNum = num ? [...milestoneSelect.options].find(o => String(o.dataset.number) === String(num)) : null;
            const byTitle = title ? [...milestoneSelect.options].find(o => o.dataset.title === title || o.textContent === title) : null;
            if (byNum) milestoneSelect.value = byNum.value;
            else if (byTitle) milestoneSelect.value = byTitle.value;
            else milestoneSelect.value = '';
        } else if (milestoneSelect) {
            milestoneSelect.value = '';
        }

        // Set project after populating dropdown
        const projectSelect = document.getElementById('task-project');
        if (task && projectSelect) {
            if (task.project && task.project.id) {
                projectSelect.value = task.project.id;
            } else if (task.projectId) {
                projectSelect.value = task.projectId;
            }
        } else if (projectSelect) {
            projectSelect.value = '';
        }

        // Set selected labels after options are rendered
        if (task && task.labels) {
            this.setSelectedLabels(task.labels);
        }

        this.setupAttachmentListeners();
        this.setupCommentListeners();
        this.setupColorPickerListeners();
        this.setupEmojiPickerListeners();
        modal.classList.add('active');
    }

    // Setup emoji picker listeners
    setupEmojiPickerListeners() {
        const emojiInput = document.getElementById('task-emoji');
        const emojiDropdown = document.querySelector('.emoji-picker-dropdown');

        if (!emojiInput || !emojiDropdown) return;

        // Toggle dropdown on input focus/click
        emojiInput.addEventListener('focus', () => {
            emojiDropdown.classList.add('active');
        });

        emojiInput.addEventListener('click', () => {
            emojiDropdown.classList.add('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!emojiInput.contains(e.target) && !emojiDropdown.contains(e.target)) {
                emojiDropdown.classList.remove('active');
            }
        });

        // Handle emoji selection
        emojiDropdown.querySelectorAll('.emoji-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const emoji = btn.dataset.emoji;
                emojiInput.value = emoji;
                emojiDropdown.classList.remove('active');
            });
        });
    }

    // Setup color picker listeners
    setupColorPickerListeners() {
        const colorInput = document.getElementById('task-bg-color');
        const colorSelect = document.getElementById('task-bg-color-preset');

        if (colorInput) {
            colorInput.oninput = () => {
                colorSelect.value = '';
            };
        }

        if (colorSelect) {
            colorSelect.onchange = () => {
                if (colorSelect.value) {
                    colorInput.value = colorSelect.value;
                }
            };
        }
    }

    // Render attachments list in modal
    renderAttachmentsList(attachments) {
        const container = document.getElementById('attachments-list');
        if (!container) return;

        container.innerHTML = '';

        if (attachments.length === 0) {
            container.innerHTML = '<p class="empty-message">No attachments yet. Click a button below to add.</p>';
            return;
        }

        attachments.forEach((att, index) => {
            const item = document.createElement('div');
            item.className = 'attachment-item';

            const icon = this.getAttachmentIcon(att.type);
            const preview = att.type === 'image' ? `<img src="${att.url}" alt="${att.name || 'Image'}" onerror="this.style.display='none'">` : '';

            item.innerHTML = `
                <div class="attachment-preview">${preview || '<i class="fas ' + icon + '"></i>'}</div>
                <div class="attachment-info">
                    <span class="attachment-name">${att.name || att.url}</span>
                    <span class="attachment-type">${att.type}</span>
                </div>
                <button type="button" class="btn btn-sm remove-attachment" data-index="${index}"><i class="fas fa-times"></i></button>
            `;

            // Add click handler for preview
            item.style.cursor = 'pointer';
            item.onclick = (e) => {
                if (!e.target.closest('.remove-attachment')) {
                    // Find the task this attachment belongs to
                    const task = this.tasks.find(t => t.id === this.currentTaskId);
                    if (task) {
                        this.openGallery(task.id, index);
                    }
                }
            };

            container.appendChild(item);
        });

        // Add remove handlers
        container.querySelectorAll('.remove-attachment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(e.target.closest('.remove-attachment').dataset.index);
                this.removeAttachment(idx);
            });
        });
    }

    // Get icon for attachment type
    getAttachmentIcon(type) {
        const icons = {
            image: 'fa-image',
            video: 'fa-video',
            audio: 'fa-music',
            document: 'fa-file',
            link: 'fa-link'
        };
        return icons[type] || 'fa-file';
    }

    // Setup attachment add button listeners
    setupAttachmentListeners() {
        const types = ['image', 'video', 'audio', 'doc', 'link'];

        types.forEach(type => {
            const btn = document.getElementById(`add-${type}-btn`);

            if (btn) {
                btn.onclick = () => {
                    // Hide all input groups first
                    types.forEach(t => {
                        const group = document.getElementById(`new-${t}-group`);
                        if (group) group.style.display = 'none';
                    });

                    // Show this input group
                    const group = document.getElementById(`new-${type}-group`);
                    if (group) {
                        group.style.display = 'flex';
                        const input = group.querySelector('input[type="url"]');
                        if (input) {
                            input.focus();
                            input.onkeydown = (e) => {
                                if (e.key === 'Escape') {
                                    group.style.display = 'none';
                                    input.value = '';
                                }
                            };
                        }
                    }
                };
            }
        });

        // Add button listeners for each attachment type
        document.querySelectorAll('.add-attachment-btn').forEach(btn => {
            btn.onclick = (e) => {
                const type = e.target.dataset.type;
                const inputId = e.target.dataset.input;
                const input = document.getElementById(inputId);

                if (input && input.value.trim()) {
                    this.addAttachment(type, input.value.trim());
                    input.value = '';

                    // Hide the input group
                    const group = document.getElementById(`new-${type}-group`);
                    if (group) group.style.display = 'none';
                }
            };
        });
    }

    // Add attachment
    addAttachment(type, url) {
        let attachments = this.currentAttachments || [];

        // Map doc to document
        const attType = type === 'doc' ? 'document' : type;

        attachments.push({
            type: attType,
            url: url,
            name: url.split('/').pop().split('?')[0] || 'Untitled'
        });

        this.currentAttachments = attachments;
        this.renderAttachmentsList(attachments);
    }

    // Remove attachment
    removeAttachment(index) {
        let attachments = this.currentAttachments || [];
        attachments.splice(index, 1);
        this.currentAttachments = attachments;
        this.renderAttachmentsList(attachments);
    }

    // Render comments list in modal
    renderCommentsList(comments) {
        const container = document.getElementById('comments-list');
        if (!container) return;

        // Check if users exist
        const usersExist = window.userManager && window.userManager.users && window.userManager.users.length > 0;

        container.innerHTML = '';

        if (!usersExist) {
            container.innerHTML = '<p class="no-comments">Create a user first to add and view comments.</p>';
            return;
        }

        if (comments.length === 0) {
            container.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
            return;
        }

        // Get task assignee name (default)
        const task = this.tasks.find(t => t.id === this.currentTaskId);
        const taskAssignee = task && task.assignee ? this.getUserName(task.assignee) : 'Unassigned';

        comments.forEach(comment => {
            const userName = this.getUserName(comment.userId);
            const userInitial = userName.charAt(0).toUpperCase();
            const commentDate = this.formatFullDate(comment.createdAt);

            // Use comment's assigneeId if set, otherwise fall back to task assignee
            const commentAssignee = (comment.assigneeId !== undefined && comment.assigneeId !== null)
                ? this.getUserName(comment.assigneeId)
                : taskAssignee;

            const item = document.createElement('div');
            item.className = 'comment-item';
            item.dataset.commentId = comment.id;

            item.innerHTML = `
                <div class="comment-avatar">${userInitial}</div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${this.escapeHtml(userName)}</span>
                        <span class="comment-date">${commentDate}</span>
                    </div>
                    <div class="comment-assignee">
                        ${this.getIcon('user')} Task assigned to: ${this.escapeHtml(commentAssignee)}
                    </div>
                    <div class="comment-text">${this.escapeHtml(comment.text)}</div>
                    <div class="comment-actions">
                        <button type="button" class="btn btn-sm edit-comment-btn" data-comment-id="${comment.id}">
                            ${this.getIcon('edit')} Edit
                        </button>
                        <button type="button" class="btn btn-sm delete-comment-btn" data-comment-id="${comment.id}">
                            ${this.getIcon('trash')} Delete
                        </button>
                    </div>
                </div>
            `;

            container.appendChild(item);
        });

        // Add event listeners for edit and delete buttons
        container.querySelectorAll('.edit-comment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const commentId = parseInt(e.target.closest('.edit-comment-btn').dataset.commentId);
                this.openCommentEditModal(commentId);
            });
        });

        container.querySelectorAll('.delete-comment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const commentId = parseInt(e.target.closest('.delete-comment-btn').dataset.commentId);
                this.deleteComment(commentId);
            });
        });
    }

    // Format full date with time
    formatFullDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);

        // Get date format from settingsManager if available
        let dateFormat = 'uk';
        if (window.settingsManager) {
            dateFormat = window.settingsManager.dateFormat || 'uk';
        }

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        if (dateFormat === 'us') {
            return `${month}/${day}/${year} ${hours}:${minutes}`;
        } else {
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        }
    }

    // Setup comment event listeners
    setupCommentListeners() {
        const addBtn = document.getElementById('add-comment-btn');
        const commentText = document.getElementById('new-comment-text');

        // Check if users exist
        const usersExist = window.userManager && window.userManager.users && window.userManager.users.length > 0;

        if (!usersExist) {
            // Disable comment functionality when no users exist
            if (addBtn) {
                addBtn.disabled = true;
                addBtn.title = 'Create a user first to add comments';
            }
            if (commentText) {
                commentText.disabled = true;
                commentText.placeholder = 'Create a user first to add comments';
            }
            return;
        }

        if (addBtn) {
            addBtn.disabled = false;
            addBtn.title = '';
        }
        if (commentText) {
            commentText.disabled = false;
            commentText.placeholder = 'Add a comment...';
        }

        if (addBtn) {
            addBtn.onclick = () => {
                if (commentText && commentText.value.trim()) {
                    this.addComment(commentText.value.trim());
                    commentText.value = '';
                }
            };
        }

        if (commentText) {
            commentText.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (commentText.value.trim()) {
                        this.addComment(commentText.value.trim());
                        commentText.value = '';
                    }
                }
            };
        }

        // Comment edit modal listeners
        this.setupCommentEditModalListeners();
    }

    // Setup comment edit modal listeners
    setupCommentEditModalListeners() {
        const modal = document.getElementById('comment-edit-modal');
        if (!modal) return;

        const closeBtn = document.getElementById('comment-edit-modal-close');
        const cancelBtn = document.getElementById('comment-edit-cancel-btn');
        const saveBtn = document.getElementById('comment-edit-save-btn');

        if (closeBtn) {
            closeBtn.onclick = () => modal.classList.remove('active');
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => modal.classList.remove('active');
        }

        if (saveBtn) {
            saveBtn.onclick = () => this.saveCommentEdit();
        }

        // Close on overlay click
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        };

        // Close on Escape
        document.onkeydown = (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                modal.classList.remove('active');
            }
        };
    }

    // Open comment edit modal
    openCommentEditModal(commentId) {
        const task = this.tasks.find(t => t.id === this.currentTaskId);
        if (!task || !task.comments) return;

        const comment = task.comments.find(c => c.id === commentId);
        if (!comment) return;

        const modal = document.getElementById('comment-edit-modal');
        const editText = document.getElementById('comment-edit-text');
        const assigneeSelect = document.getElementById('comment-edit-assignee');

        // Populate assignee dropdown
        assigneeSelect.innerHTML = '<option value="">Unassigned</option>';
        if (window.userManager && window.userManager.users) {
            window.userManager.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.name || user.email || 'Unnamed User';
                assigneeSelect.appendChild(option);
            });
        }

        editText.value = comment.text;
        assigneeSelect.value = comment.assigneeId || '';

        modal.classList.add('active');
        this.currentCommentId = commentId;
        editText.focus();
    }

    // Save comment edit
    saveCommentEdit() {
        const editText = document.getElementById('comment-edit-text');
        const assigneeSelect = document.getElementById('comment-edit-assignee');
        if (!editText || !this.currentCommentId) return;

        const task = this.tasks.find(t => t.id === this.currentTaskId);
        if (!task || !task.comments) return;

        const comment = task.comments.find(c => c.id === this.currentCommentId);
        if (comment) {
            comment.text = editText.value.trim();
            comment.assigneeId = assigneeSelect.value || null;
            comment.updatedAt = new Date().toISOString();
            this.saveTasks();
            this.renderCommentsList(task.comments);
            this.showNotification('Comment updated', 'success');
        }

        document.getElementById('comment-edit-modal').classList.remove('active');
        this.currentCommentId = null;
    }

    // Add comment
    addComment(text) {
        if (!this.currentTaskId) return;

        const task = this.tasks.find(t => t.id === this.currentTaskId);
        if (!task) return;

        if (!task.comments) task.comments = [];

        const comment = {
            id: Date.now(),
            userId: window.userManager ? window.userManager.currentUserId : null,
            assigneeId: task.assignee || null,  // Default to task assignee
            text: text,
            createdAt: new Date().toISOString()
        };

        task.comments.push(comment);
        this.saveTasks();
        this.renderCommentsList(task.comments);
        this.showNotification('Comment added', 'success');
    }

    // Delete comment
    deleteComment(commentId) {
        const task = this.tasks.find(t => t.id === this.currentTaskId);
        if (!task || !task.comments) return;

        if (!confirm('Are you sure you want to delete this comment?')) return;

        task.comments = task.comments.filter(c => c.id !== commentId);
        this.saveTasks();
        this.renderCommentsList(task.comments);
        this.showNotification('Comment deleted', 'success');
    }

    // Get selected label names from the custom picker badges
    getSelectedLabels() {
        const selectedContainer = document.getElementById('selected-labels');
        if (!selectedContainer) return [];
        return Array.from(selectedContainer.children).map(badge => badge.dataset.label);
    }

    // Close task modal
    closeTaskModal() {
        // Clear selected labels display and reset placeholder opacity
        const selectedContainer = document.getElementById('selected-labels');
        const trigger = document.getElementById('label-select-trigger');
        const placeholder = trigger?.querySelector('.label-select-placeholder');
        if (selectedContainer) {
            selectedContainer.innerHTML = '';
        }
        if (placeholder) {
            placeholder.style.opacity = '1';
        }
        // Close dropdown if open
        const dropdown = document.getElementById('label-select-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        document.getElementById('task-modal').classList.remove('active');
        this.currentTaskId = null;
        this.currentAttachments = [];
    }

    // Messages Sidebar
    openMessagesSidebar() {
        const sidebar = document.getElementById('messages-sidebar');
        const overlay = document.getElementById('messages-overlay');
        if (sidebar) {
            sidebar.classList.add('active');
            this.populateMessagesUserSelect();
        }
        if (overlay) {
            overlay.classList.add('active');
        }
    }

    closeMessagesSidebar() {
        const sidebar = document.getElementById('messages-sidebar');
        const overlay = document.getElementById('messages-overlay');
        if (sidebar) {
            sidebar.classList.remove('active');
        }
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    populateMessagesUserSelect() {
        const select = document.getElementById('messages-user-select');
        if (!select) return;

        // Wait for userManager to be ready
        if (!window.userManager) {
            select.innerHTML = '<option value="">Loading users...</option>';
            return;
        }

        select.innerHTML = '<option value="">Select a user...</option>';

        if (window.userManager.users && window.userManager.users.length > 0) {
            window.userManager.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.name || user.email || 'Unnamed User';
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="">No users available</option>';
        }

        select.onchange = () => {
            this.renderMessagesList(select.value);
        };
    }

    renderMessagesList(userId) {
        const container = document.getElementById('messages-list');
        if (!container) return;

        if (!userId) {
            container.innerHTML = '<p class="message-empty">Select a user to view their comments</p>';
            return;
        }

        // Handle both string and number IDs
        const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;

        // Wait for userManager to be ready
        if (!window.userManager) {
            container.innerHTML = '<p class="message-empty">Loading users...</p>';
            return;
        }

        const user = window.userManager.getUser(userIdNum);
        if (!user) {
            container.innerHTML = '<p class="message-empty">User not found</p>';
            return;
        }

        // Find all comments made by this user
        const messages = [];
        if (this.tasks) {
            this.tasks.forEach(task => {
                if (task.comments && task.comments.length > 0) {
                    task.comments.forEach(comment => {
                        const commentUserId = typeof comment.userId === 'string' ? parseInt(comment.userId) : comment.userId;
                        if (commentUserId === userIdNum) {
                            messages.push({
                                comment: comment,
                                task: task
                            });
                        }
                    });
                }
            });
        }

        container.innerHTML = '';

        if (messages.length === 0) {
            container.innerHTML = `<p class="message-empty">No comments found for ${user.name || user.email}</p>`;
            return;
        }

        // Sort by date (newest first)
        messages.sort((a, b) => new Date(b.comment.createdAt) - new Date(a.comment.createdAt));

        // Get panel configuration
        const panelConfig = this.panelConfig || { names: ['Backlog', 'To Do', 'In Progress', 'Done'] };
        const columns = this.columns || ['backlog', 'todo', 'in-progress', 'done'];

        // Group by panel/status using an array to preserve order
        const groups = [];
        const groupMap = {};

        messages.forEach(({ comment, task }) => {
            // Get panel index and name
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
            groupMap[panelName].items.push({ comment, task });
        });

        // Sort groups by panel index to match kanban board order
        groups.sort((a, b) => a.index - b.index);

        // Render groups in order
        groups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'message-group';
            groupDiv.innerHTML = `<div class="message-group-title">${group.name}</div>`;

            group.items.forEach(({ comment, task }) => {
                const userName = this.getUserName(comment.userId);
                const userInitial = userName.charAt(0).toUpperCase();
                const commentDate = this.formatFullDate(comment.createdAt);

                const item = document.createElement('div');
                item.className = 'message-item';
                item.dataset.taskId = task.id;

                item.innerHTML = `
                    <div class="message-avatar">${userInitial}</div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-author">${this.escapeHtml(userName)}</span>
                            <span class="message-date">${commentDate}</span>
                        </div>
                        <div class="message-task">
                            ${this.getIcon('clipboard')} ${this.escapeHtml(task.title)}
                        </div>
                        <div class="message-text">${this.escapeHtml(comment.text)}</div>
                    </div>
                `;

                item.onclick = () => {
                    this.goToTask(task.id);
                };

                groupDiv.appendChild(item);
            });

            container.appendChild(groupDiv);
        });
    }

    // Go to task (close messages sidebar and open task modal)
    goToTask(taskId) {
        this.closeMessagesSidebar();
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            this.openTaskModal(task);
        }
    }

    // Setup messages sidebar listeners
    setupMessagesSidebarListeners() {
        const messagesBtn = document.getElementById('messages-btn');
        const closeBtn = document.getElementById('messages-sidebar-close');
        const overlay = document.getElementById('messages-overlay');

        if (messagesBtn) {
            messagesBtn.onclick = () => this.openMessagesSidebar();
        }

        if (closeBtn) {
            closeBtn.onclick = () => this.closeMessagesSidebar();
        }

        if (overlay) {
            overlay.onclick = () => this.closeMessagesSidebar();
        }

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMessagesSidebar();
            }
        });
    }

    // Save task with attachments and comments
    saveTask() {
        const form = document.getElementById('task-form');
        const taskId = form.dataset.taskId;

        // Get milestone value from select
        const milestoneSelect = document.getElementById('task-milestone');
        let milestone = null;
        if (milestoneSelect && milestoneSelect.value) {
            const selectedOption = milestoneSelect.selectedOptions[0];
            milestone = {
                number: parseInt(milestoneSelect.value) || null,
                name: selectedOption ? selectedOption.dataset.title || selectedOption.textContent : ''
            };
        }

        // Get project value
        const projectSelect = document.getElementById('task-project');
        let project = null;
        if (projectSelect && projectSelect.value) {
            project = {
                id: projectSelect.value,
                title: projectSelect.selectedOptions[0].textContent
            };
        }

        // Get form values directly
        const taskData = {
            emoji: document.getElementById('task-emoji').value,
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-description').value,
            assignee: document.getElementById('task-assignee').value,
            priority: document.getElementById('task-priority').value,
            dueDate: document.getElementById('task-due-date').value,
            milestone: milestone,
            project: project,
            parentIssueId: null,
            backgroundColor: document.getElementById('task-bg-color').value,
            attachments: this.currentAttachments || [],
            labels: this.getSelectedLabels()
        };

        if (taskId) {
            // Editing existing task - preserve comments (they may have been edited)
            const existingTask = this.tasks.find(t => t.id === parseInt(taskId));
            if (existingTask) {
                // Update the task with form values, preserving comments
                taskData.comments = existingTask.comments;
                this.updateTask(parseInt(taskId), taskData);
                // Extra save to ensure comments are persisted
                this.saveTasks();
            }
            this.showNotification('Task updated successfully', 'success');
        } else {
            // Creating new task
            // Get status from the button that opened the modal
            const addButton = document.querySelector('.add-task-btn:focus') ||
                document.querySelector('.add-task-btn[data-status]');
            if (addButton) {
                taskData.status = addButton.dataset.status;
            } else {
                taskData.status = 'backlog';
            }
            // Add userId reference if user is logged in
            if (window.userManager && window.userManager.currentUserId) {
                taskData.userId = window.userManager.currentUserId;
            }
            this.createTask(taskData);
            this.showNotification('Task created successfully', 'success');
        }

        this.currentAttachments = [];
        this.currentTaskId = null;
        this.closeTaskModal();
        this.renderBoard();
    }

    // User Management Integration
    populateAssigneeDropdown() {
        const select = document.getElementById('task-assignee');
        const currentValue = select.value;

        // Clear existing options except the first one
        select.innerHTML = '<option value="">Unassigned</option>';

        // Add users from userManager
        if (window.userManager && window.userManager.users) {
            window.userManager.users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.name || user.email || 'Unnamed User';
                select.appendChild(option);
            });
        }

        select.value = currentValue;
    }

    // GitHub Milestone Integration
    async populateMilestoneDropdown() {
        const select = document.getElementById('task-milestone');
        const hint   = document.getElementById('milestone-hint');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">No Milestone</option>';

        const setHint = (msg, isError = false) => {
            if (hint) {
                hint.textContent = msg;
                hint.style.color = isError ? 'var(--error-color, #ff6b6b)' : 'var(--text-secondary, #888)';
            }
        };

        // Not connected — disable and explain
        if (!window.githubBoardsUI || !window.githubBoardsUI.githubBoards.isConnected()) {
            select.disabled = true;
            setHint('Connect to GitHub to load milestones');
            return;
        }

        const repo = window.githubBoardsUI.githubBoards.getSelectedRepo();
        if (!repo) {
            select.disabled = true;
            setHint('Select a repository to load milestones');
            return;
        }

        select.disabled = true;
        setHint('Loading milestones…');

        try {
            const milestones = await window.githubBoardsUI.githubBoards.api.getRepoMilestones(
                repo.owner.login,
                repo.name
            );

            if (milestones.length === 0) {
                setHint('No open milestones in this repository');
                select.disabled = false;
                return;
            }

            milestones.forEach(ms => {
                // Defensive: ensure ms is an object with expected properties
                if (typeof ms !== 'object' || ms === null) {
                    console.warn('Invalid milestone data:', ms);
                    return; // skip this entry
                }
                
                const title = ms.title || ms.name || String(ms);
                const number = ms.number || ms.id || 0;
                
                // Skip if title is still an object (shouldn't happen after String() above)
                if (typeof title === 'object') {
                    console.warn('Milestone title is still an object:', ms);
                    return;
                }
                
                const option = document.createElement('option');
                option.value = number;           // store numeric ID as value
                option.textContent = title;
                option.dataset.title  = title;
                option.dataset.number = number;
                select.appendChild(option);
            });

            // Restore previous selection — match by number or title
            if (currentValue) {
                // Try number first, then title
                const byNumber = [...select.options].find(o => String(o.dataset.number) === String(currentValue));
                const byTitle  = [...select.options].find(o => o.dataset.title  === currentValue);
                if (byNumber) select.value = byNumber.value;
                else if (byTitle) select.value = byTitle.value;
            }

            setHint(`${milestones.length} milestone${milestones.length !== 1 ? 's' : ''} loaded`);
            select.disabled = false;

        } catch (error) {
            console.warn('Failed to load milestones:', error);
            setHint('Failed to load milestones: ' + error.message, true);
            select.disabled = false;
        }
    }

    // GitHub Projects Integration
    async populateProjectDropdown() {
        const select = document.getElementById('task-project');
        const hint   = document.getElementById('project-hint');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">No Project</option>';

        const setHint = (msg, isError = false) => {
            if (hint) {
                hint.textContent = msg;
                hint.style.color = isError ? 'var(--error-color, #ff6b6b)' : 'var(--text-secondary, #888)';
            }
        };

        if (!window.githubBoardsUI || !window.githubBoardsUI.githubBoards.isConnected()) {
            select.disabled = true;
            setHint('Connect to GitHub to load projects');
            return;
        }

        const repo = window.githubBoardsUI.githubBoards.getSelectedRepo();
        if (!repo) {
            select.disabled = true;
            setHint('Select a repository to load projects');
            return;
        }

        select.disabled = true;
        setHint('Loading projects…');

        try {
            // Pass owner + repo so getProjects() can try repo-linked projects first
            const projects = await window.githubBoardsUI.githubBoards.api.getProjects(
                repo.owner.login,
                repo.name
            );

            if (!projects || projects.length === 0) {
                select.disabled = true;
                setHint('No projects found — create one on GitHub first');
                return;
            }

            projects.forEach(proj => {
                const option = document.createElement('option');
                option.value = proj.id;
                option.textContent = proj.title;
                option.dataset.number = proj.number || '';
                select.appendChild(option);
            });

            // Restore previous selection
            if (currentValue) select.value = currentValue;

            setHint(`${projects.length} project${projects.length !== 1 ? 's' : ''} loaded`);
            select.disabled = false;

        } catch (error) {
            console.warn('Failed to load projects:', error);
            select.disabled = false;
            setHint('Failed to load projects: ' + error.message, true);
        }
    }

    // GitHub Labels Integration - Populate custom label picker
    async populateLabelsDropdown() {
        const container = document.getElementById('label-select-container');
        const trigger = document.getElementById('label-select-trigger');
        const dropdown = document.getElementById('label-select-dropdown');
        const optionsContainer = document.getElementById('label-options');
        const placeholder = trigger?.querySelector('.label-select-placeholder');

        if (!container || !trigger || !dropdown || !optionsContainer) return;

        // Close dropdown if open
        dropdown.style.display = 'none';
        trigger.classList.remove('active');

        // Clear any existing selection before rebuilding
        const selectedContainer = document.getElementById('selected-labels');
        if (selectedContainer) selectedContainer.innerHTML = '';

        // Load locally configured labels from settings (kanban-labels in localStorage)
        let localLabels = [];
        try {
            const stored = localStorage.getItem('kanban-labels');
            if (stored) {
                localLabels = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load local labels:', e);
        }

        // Default GitHub labels fallback (with default colors)
        const defaultLabels = [
            { name: 'documentation', color: '0075ca' },
            { name: 'duplicate', color: 'cfd3d7' },
            { name: 'enhancement', color: 'a2eeef' },
            { name: 'good first issue', color: '7057ff' },
            { name: 'help wanted', color: '008672' },
            { name: 'invalid', color: 'e4e669' },
            { name: 'question', color: 'd876e3' },
            { name: 'wontfix', color: 'ffffff' }
        ];

        let labels = [];

        // If GitHub integration active and repo selected, fetch real labels
        if (window.githubBoardsUI && window.githubBoardsUI.githubBoards.isConnected()) {
            const repo = window.githubBoardsUI.githubBoards.getSelectedRepo();
            if (repo) {
                try {
                    const githubLabels = await window.githubBoardsUI.githubBoards.api.getRepoLabels(
                        repo.owner.login,
                        repo.name
                    );
                    // Merge: start with local labels, override with GitHub labels (by name)
                    this.labelColorMap = this.labelColorMap || {};
                    githubLabels.forEach(gl => {
                        this.labelColorMap[gl.name] = gl.color;
                    });

                    // Build merged list: prefer GitHub labels, fill missing from local/default
                    const allNames = new Set([
                        ...githubLabels.map(l => l.name),
                        ...localLabels.map(l => l.name),
                        ...defaultLabels.map(l => l.name)
                    ]);

                    labels = [];
                    allNames.forEach(name => {
                        let label = githubLabels.find(l => l.name === name)
                            || localLabels.find(l => l.name === name)
                            || defaultLabels.find(l => l.name === name);
                        if (label) {
                            labels.push({ name: label.name, color: label.color });
                        }
                    });
                    labels.sort((a, b) => a.name.localeCompare(b.name));
                } catch (error) {
                    console.warn('Failed to load GitHub labels, using local/default:', error);
                    labels = [...localLabels, ...defaultLabels.filter(d => !localLabels.find(l => l.name === d.name))];
                    if (labels.length === 0) labels = defaultLabels;
                }
            } else {
                // No repo selected, use local labels or defaults
                labels = localLabels.length > 0 ? localLabels : defaultLabels;
            }
        } else {
            // No GitHub connection, use local labels or defaults
            labels = localLabels.length > 0 ? localLabels : defaultLabels;
        }

        // Build options HTML
        optionsContainer.innerHTML = '';
        labels.forEach(label => {
            // Ensure color doesn't have # prefix for CSS
            const color = (label.color || '').replace('#', '');
            const option = document.createElement('div');
            option.className = 'label-option';
            option.dataset.value = label.name;
            option.dataset.color = color;
            option.setAttribute('role', 'option');
            option.setAttribute('tabindex', '-1');
            option.innerHTML = `
                <span class="label-color-dot" style="background-color: #${color}"></span>
                <span class="label-name">${this.escapeHtml(label.name)}</span>
                <span class="label-check"><i class="fas fa-check"></i></span>
            `;
            optionsContainer.appendChild(option);
        });

        // Set up event listeners for the label picker
        this.setupLabelPicker(trigger, dropdown, optionsContainer, label => this.onLabelToggle(label));
    }

    onLabelToggle(labelName) {
        // This is a callback hook if needed for external sync
        // Currently handled directly in setupLabelPicker
    }

    // Setup label picker interactions (dropdown toggle, selection)
    setupLabelPicker(trigger, dropdown, optionsContainer, onToggle) {
        let isOpen = false;
        let focusedIndex = -1;

        const toggleDropdown = (open) => {
            isOpen = open !== undefined ? open : !isOpen;
            if (isOpen) {
                dropdown.style.display = 'block';
                trigger.classList.add('active');
                trigger.setAttribute('aria-expanded', 'true');
                // Focus first option
                const firstOption = optionsContainer.querySelector('.label-option');
                firstOption?.focus();
            } else {
                dropdown.style.display = 'none';
                trigger.classList.remove('active');
                trigger.setAttribute('aria-expanded', 'false');
                focusedIndex = -1;
            }
        };

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
        });

        // Keyboard support for trigger
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                toggleDropdown(true);
            }
            if (e.key === 'Escape' && isOpen) {
                e.preventDefault();
                toggleDropdown(false);
                trigger.focus();
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (isOpen && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
                toggleDropdown(false);
            }
        });

        // Close on Escape inside dropdown
        dropdown.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                toggleDropdown(false);
                trigger.focus();
            }
        });

        // Option selection (mouse)
        optionsContainer.addEventListener('click', (e) => {
            const option = e.target.closest('.label-option');
            if (!option) return;
            const labelName = option.dataset.value;
            const isSelected = option.classList.contains('selected');
            if (isSelected) {
                option.classList.remove('selected');
                option.setAttribute('aria-selected', 'false');
                this.removeLabelFromSelection(labelName);
            } else {
                option.classList.add('selected');
                option.setAttribute('aria-selected', 'true');
                this.addLabelToSelection(labelName, option.dataset.color);
            }
            onToggle(labelName);
            option.focus();
        });

        // Keyboard navigation within dropdown
        optionsContainer.addEventListener('keydown', (e) => {
            const options = Array.from(optionsContainer.querySelectorAll('.label-option:not([style*="display: none"])'));
            if (options.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusedIndex = Math.min(focusedIndex + 1, options.length - 1);
                options[focusedIndex]?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusedIndex = Math.max(focusedIndex - 1, 0);
                options[focusedIndex]?.focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const activeOption = options[focusedIndex];
                if (activeOption) {
                    const labelName = activeOption.dataset.value;
                    const isSelected = activeOption.classList.contains('selected');
                    if (isSelected) {
                        activeOption.classList.remove('selected');
                        activeOption.setAttribute('aria-selected', 'false');
                        this.removeLabelFromSelection(labelName);
                    } else {
                        activeOption.classList.add('selected');
                        activeOption.setAttribute('aria-selected', 'true');
                        this.addLabelToSelection(labelName, activeOption.dataset.color);
                    }
                    onToggle(labelName);
                }
            }
        });
    }

    // Add label to current selection (used by label picker)
    addLabelToSelection(labelName, color) {
        const selectedContainer = document.getElementById('selected-labels');
        const trigger = document.getElementById('label-select-trigger');
        const placeholder = trigger?.querySelector('.label-select-placeholder');
        if (!selectedContainer) return;

        // Check if already exists
        if (selectedContainer.querySelector(`[data-label="${labelName}"]`)) return;

        const badge = document.createElement('span');
        badge.className = 'selected-label-badge';
        badge.dataset.label = labelName;
        badge.style.backgroundColor = `#${color}`;
        badge.style.color = this.getLabelTextColor(`#${color}`);
        badge.innerHTML = `
            ${this.escapeHtml(labelName)}
            <span class="selected-label-remove" data-label="${this.escapeHtml(labelName)}">&times;</span>
        `;
        selectedContainer.appendChild(badge);

        // Dim placeholder when labels are selected (keep it visible)
        if (placeholder) placeholder.style.opacity = '0.3';

        // Remove on click of X
        badge.querySelector('.selected-label-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            badge.remove();
            // If no more selected labels, restore placeholder opacity
            if (selectedContainer.children.length === 0 && placeholder) {
                placeholder.style.opacity = '1';
            }
            // Also uncheck in dropdown if open
            const dropdown = document.getElementById('label-select-dropdown');
            if (dropdown && dropdown.style.display === 'block') {
                const option = dropdown.querySelector(`.label-option[data-value="${labelName}"]`);
                if (option) {
                    option.classList.remove('selected');
                    option.setAttribute('aria-selected', 'false');
                }
            }
        });
    }

    // Remove label from current selection
    removeLabelFromSelection(labelName) {
        const selectedContainer = document.getElementById('selected-labels');
        if (!selectedContainer) return;
        const badge = selectedContainer.querySelector(`[data-label="${labelName}"]`);
        if (badge) badge.remove();
    }

    // Get currently selected label names (used by saveTask)
    getSelectedLabels() {
        const selectedContainer = document.getElementById('selected-labels');
        if (!selectedContainer) return [];
        return Array.from(selectedContainer.children).map(badge => badge.dataset.label);
    }

    // Set selected labels when editing a task
    setSelectedLabels(labelArray) {
        const selectedContainer = document.getElementById('selected-labels');
        const trigger = document.getElementById('label-select-trigger');
        const placeholder = trigger?.querySelector('.label-select-placeholder');
        if (!selectedContainer) return;
        selectedContainer.innerHTML = '';
        if (!labelArray || !Array.isArray(labelArray)) return;

        labelArray.forEach(label => {
            const labelName = typeof label === 'object' ? label.name : label;
            const colorRaw = typeof label === 'object' && label.color ? label.color : this.getLabelColor(labelName);
            const color = (colorRaw || '').replace('#', '');
            const badge = document.createElement('span');
            badge.className = 'selected-label-badge';
            badge.dataset.label = labelName;
            badge.style.backgroundColor = `#${color}`;
            badge.style.color = this.getLabelTextColor(`#${color}`);
            badge.innerHTML = `
                ${this.escapeHtml(labelName)}
                <span class="selected-label-remove" data-label="${this.escapeHtml(labelName)}">&times;</span>
            `;
            selectedContainer.appendChild(badge);
            badge.querySelector('.selected-label-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                badge.remove();
                // Restore placeholder opacity when no labels remain
                if (selectedContainer.children.length === 0 && placeholder) {
                    placeholder.style.opacity = '1';
                }
                // Also uncheck in dropdown if open
                const dropdown = document.getElementById('label-select-dropdown');
                if (dropdown && dropdown.style.display === 'block') {
                    const option = dropdown.querySelector(`.label-option[data-value="${labelName}"]`);
                    if (option) {
                        option.classList.remove('selected');
                        option.setAttribute('aria-selected', 'false');
                    }
                }
            });
        });

        // Dim placeholder if any labels selected
        if (placeholder && labelArray.length > 0) {
            placeholder.style.opacity = '0.3';
        }

        // Also update dropdown options selected state if dropdown is rendered
        const optionsContainer = document.getElementById('label-options');
        if (optionsContainer) {
            labelArray.forEach(label => {
                const labelName = typeof label === 'object' ? label.name : label;
                const option = optionsContainer.querySelector(`.label-option[data-value="${labelName}"]`);
                if (option) {
                    option.classList.add('selected');
                    option.setAttribute('aria-selected', 'true');
                }
            });
        }
    }

    getUserName(userId) {
        if (!userId) return 'Unassigned';

        // Handle both string and number IDs - localStorage stores as strings
        const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;

        if (window.userManager && window.userManager.users) {
            // Use loose equality to handle string/number mismatch
            const user = window.userManager.users.find(u => u.id == userIdNum);
            if (user) {
                return user.name || user.email || 'Unnamed User';
            }
        }
        // If userId is a number but no user found, return the ID as string
        if (userId && !isNaN(userIdNum)) {
            return `User ${userIdNum}`;
        }
        return 'Unassigned';
    }

    // Event Listeners
    setupEventListeners() {
        // Add task buttons - now use inline creation
        document.querySelectorAll('.add-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const status = e.target.dataset.status;
                this.openInlineTaskCreator(status);
            });
        });

        // Task modal
        document.getElementById('task-modal-close').addEventListener('click', () => this.closeTaskModal());
        document.getElementById('task-cancel-btn').addEventListener('click', () => this.closeTaskModal());
        document.getElementById('task-save-btn').addEventListener('click', () => this.saveTask());

        // Close modal on overlay click
        document.getElementById('task-modal').addEventListener('click', (e) => {
            if (e.target.id === 'task-modal') {
                this.closeTaskModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeTaskModal();
                this.closeEmailModal();
            }
        });
    }

    // Email Modal Event Listeners
    setupEmailModalListeners() {
        const emailModal = document.getElementById('email-modal');
        if (emailModal) {
            emailModal.addEventListener('click', (e) => {
                if (e.target.id === 'email-modal') {
                    this.closeEmailModal();
                }
            });
        }

        const emailClose = document.getElementById('email-modal-close');
        if (emailClose) {
            emailClose.addEventListener('click', () => this.closeEmailModal());
        }

        const emailCancel = document.getElementById('email-cancel-btn');
        if (emailCancel) {
            emailCancel.addEventListener('click', () => this.closeEmailModal());
        }

        // Gallery modal listeners
        const galleryModal = document.getElementById('gallery-modal');
        if (galleryModal) {
            galleryModal.addEventListener('click', (e) => {
                if (e.target.id === 'gallery-modal') {
                    this.closeGalleryModal();
                }
            });
        }

        const galleryClose = document.getElementById('gallery-modal-close');
        if (galleryClose) {
            galleryClose.addEventListener('click', () => this.closeGalleryModal());
        }

        // Gallery keyboard navigation
        document.addEventListener('keydown', (e) => {
            const galleryModal = document.getElementById('gallery-modal');
            if (!galleryModal || !galleryModal.classList.contains('active')) return;

            if (e.key === 'ArrowLeft') {
                this.galleryPrev();
            } else if (e.key === 'ArrowRight') {
                this.galleryNext();
            }
        });
    }

    // Data Persistence
    saveTasks() {
        localStorage.setItem('kanban-tasks', JSON.stringify(this.tasks));
        localStorage.setItem('kanban-next-id', this.nextTaskId.toString());
    }

    loadTasks() {
        const savedTasks = localStorage.getItem('kanban-tasks');
        const savedNextId = localStorage.getItem('kanban-next-id');

        if (savedTasks) {
            this.tasks = JSON.parse(savedTasks);
        }

        if (savedNextId) {
            this.nextTaskId = parseInt(savedNextId);
        }
    }

    // Import from Google Sheets
    importFromSheets(tasks) {
        tasks.forEach(taskData => {
            this.createTask(taskData);
        });
        this.renderBoard();
        this.showNotification(`Imported ${tasks.length} tasks from Google Sheets`, 'success');
    }

    // Inline Task Creation
    openInlineTaskCreator(status) {
        // Close any existing inline creator
        this.closeInlineCreator();

        const column = document.getElementById(`${status}-tasks`);
        if (!column) return;

        // Create inline creator element
        const creator = document.createElement('div');
        creator.className = 'inline-task-creator';
        creator.innerHTML = `
            <div class="inline-creator-content">
                <input type="text" class="inline-title-input" placeholder="Enter task title..." maxlength="100">
                <textarea class="inline-description-input" placeholder="Add description (optional)..." rows="2"></textarea>
                <div class="inline-creator-actions">
                    <button class="btn btn-sm secondary inline-cancel-btn">Cancel</button>
                    <button class="btn btn-sm primary inline-add-btn" disabled>Add Task</button>
                </div>
            </div>
        `;

        // Insert at the top of the column
        column.insertBefore(creator, column.firstChild);

        // Focus on title input
        const titleInput = creator.querySelector('.inline-title-input');
        titleInput.focus();

        // Setup event listeners
        this.setupInlineCreatorEvents(creator, status);
    }

    setupInlineCreatorEvents(creator, status) {
        const titleInput = creator.querySelector('.inline-title-input');
        const descriptionInput = creator.querySelector('.inline-description-input');
        const addBtn = creator.querySelector('.inline-add-btn');
        const cancelBtn = creator.querySelector('.inline-cancel-btn');

        // Enable/disable add button based on title input
        titleInput.addEventListener('input', () => {
            addBtn.disabled = !titleInput.value.trim();
        });

        // Handle add button click
        addBtn.addEventListener('click', () => {
            const title = titleInput.value.trim();
            const description = descriptionInput.value.trim();

            if (title) {
                this.createTask({
                    title: title,
                    description: description,
                    status: status
                });
                this.closeInlineCreator();
                this.renderBoard();
            }
        });

        // Handle cancel button
        cancelBtn.addEventListener('click', () => {
            this.closeInlineCreator();
        });

        // Handle Enter key in title input
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (titleInput.value.trim()) {
                    addBtn.click();
                }
            } else if (e.key === 'Escape') {
                this.closeInlineCreator();
            }
        });

        // Handle Enter key in description (Shift+Enter for new line)
        descriptionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (titleInput.value.trim()) {
                    addBtn.click();
                }
            } else if (e.key === 'Escape') {
                this.closeInlineCreator();
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!creator.contains(e.target) && !e.target.classList.contains('add-task-btn')) {
                this.closeInlineCreator();
            }
        }, { once: true });
    }

    closeInlineCreator() {
        const creator = document.querySelector('.inline-task-creator');
        if (creator) {
            creator.remove();
        }
    }

    // Notifications
    showNotification(message, type = 'info') {
        if (window.notifications) {
            window.notifications.show(message, type);
        }
    }
}

// Initialize the board when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.kanbanBoard = new KanbanBoard();
});