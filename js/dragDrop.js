/**
 * Enhanced Drag and Drop functionality for Kanban Board
 * Fixed version with better cross-browser support
 */
class DragDropManager {
    constructor(kanbanBoard) {
        this.kanbanBoard = kanbanBoard;
        this.draggedElement = null;
        this.placeholder = null;
        this.init();
    }

    init() {
        this.setupGlobalListeners();
        this.setupDragAndDrop();
    }

    setupGlobalListeners() {
        // Global drag and drop event listeners
        document.addEventListener('dragstart', this.handleGlobalDragStart.bind(this), false);
        document.addEventListener('dragend', this.handleGlobalDragEnd.bind(this), false);
        document.addEventListener('dragover', this.handleGlobalDragOver.bind(this), false);
        document.addEventListener('dragleave', this.handleGlobalDragLeave.bind(this), false);
        document.addEventListener('drop', this.handleGlobalDrop.bind(this), false);
    }

    handleGlobalDragStart(e) {
        // Only handle task card drags
        if (!e.target.classList.contains('task-card')) return;
        
        this.draggedElement = e.target;
        this.draggedElement.classList.add('dragging');
        
        // Create placeholder
        this.createPlaceholder(this.draggedElement);
        
        // Set drag data
        e.dataTransfer.setData('text/plain', this.draggedElement.dataset.taskId);
        e.dataTransfer.effectAllowed = 'move';
        
        // Hide the dragged element after a short delay (but keep it visible during drag)
        setTimeout(() => {
            if (this.draggedElement) {
                this.draggedElement.style.opacity = '0.5';
            }
        }, 0);
    }

    handleGlobalDragEnd(e) {
        // Handle null target gracefully
        if (!e.target || !e.target.classList) return;
        if (!e.target.classList.contains('task-card')) return;
        
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
            this.draggedElement.style.opacity = '1';
        }

        // Remove placeholder
        this.removePlaceholder();

        // Remove all drag-over classes
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });

        this.draggedElement = null;
        this.placeholder = null;
    }

    handleGlobalDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const target = e.target;
        
        // Handle column hover
        const column = target.closest('.column-content');
        if (column) {
            document.querySelectorAll('.column-content').forEach(col => {
                if (col !== column) {
                    col.classList.remove('drag-over');
                }
            });
            column.classList.add('drag-over');
        }
    }

    handleGlobalDragLeave(e) {
        const target = e.target;
        
        // Only remove if we're actually leaving the column
        const column = target.closest('.column-content');
        if (column && !column.contains(e.relatedTarget)) {
            column.classList.remove('drag-over');
        }
    }

    handleGlobalDrop(e) {
        e.preventDefault();

        const target = e.target;
        const column = target.closest('.column-content');
        
        // Remove drag-over states
        if (column) {
            column.classList.remove('drag-over');
        }
        document.querySelectorAll('.column-content').forEach(col => {
            col.classList.remove('drag-over');
        });

        // Get task ID from drag data
        const taskId = parseInt(e.dataTransfer.getData('text/plain'));
        if (!taskId) return;

        // Determine new status from column
        let newStatus = null;
        if (column) {
            newStatus = column.id.replace('-tasks', '');
        }

        // Move task if we have valid data
        if (taskId && newStatus && this.kanbanBoard) {
            this.kanbanBoard.moveTask(taskId, newStatus);
        }

        // Clean up - safely call handleGlobalDragEnd if draggedElement is not null
        if (this.draggedElement) {
            this.handleGlobalDragEnd({ target: this.draggedElement });
        } else {
            // Just remove any drag-over classes
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        }
    }

    createPlaceholder(element) {
        if (!element) return;
        
        this.removePlaceholder();
        
        this.placeholder = document.createElement('div');
        this.placeholder.className = 'task-placeholder';
        this.placeholder.style.height = `${element.offsetHeight}px`;
        
        // Insert placeholder after the dragged element
        if (element.parentNode) {
            element.parentNode.insertBefore(this.placeholder, element.nextSibling);
        }
    }

    removePlaceholder() {
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
        }
        this.placeholder = null;
    }

    setupDragAndDrop() {
        // Initial setup
        this.updateDragListeners();
        this.updateDropZones();
    }

    updateDragListeners() {
        const taskCards = document.querySelectorAll('.task-card');
        taskCards.forEach(card => {
            card.addEventListener('dragstart', this.handleDragStart.bind(this));
            card.addEventListener('dragend', this.handleDragEnd.bind(this));
        });
    }

    updateDropZones() {
        const columns = document.querySelectorAll('.column-content');
        columns.forEach(column => {
            column.addEventListener('dragover', this.handleDragOver.bind(this));
            column.addEventListener('dragleave', this.handleDragLeave.bind(this));
            column.addEventListener('drop', this.handleDrop.bind(this));
        });
    }

    handleDragStart(e) {
        this.draggedElement = e.target;
        this.draggedElement.classList.add('dragging');
        
        // Create placeholder
        this.placeholder = document.createElement('div');
        this.placeholder.className = 'task-placeholder';
        this.placeholder.style.height = `${this.draggedElement.offsetHeight}px`;
        
        e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
        e.dataTransfer.effectAllowed = 'move';
        
        setTimeout(() => {
            if (this.draggedElement.parentNode) {
                this.draggedElement.parentNode.insertBefore(this.placeholder, this.draggedElement.nextSibling);
            }
        }, 0);
    }

    handleDragEnd(e) {
        this.draggedElement.classList.remove('dragging');
        
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
        }

        this.draggedElement = null;
        this.placeholder = null;

        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const target = e.currentTarget;
        if (target.classList.contains('column-content')) {
            target.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
        const target = e.currentTarget;
        if (target.classList.contains('column-content')) {
            if (!target.contains(e.relatedTarget)) {
                target.classList.remove('drag-over');
            }
        }
    }

    handleDrop(e) {
        e.preventDefault();

        const target = e.currentTarget;
        const taskId = parseInt(e.dataTransfer.getData('text/plain'));

        if (!taskId || !this.draggedElement) return;

        // Determine new status
        let newStatus;
        if (target.classList.contains('column-content')) {
            newStatus = target.id.replace('-tasks', '');
        } else {
            const closestColumn = target.closest('.column-content');
            if (closestColumn) {
                newStatus = closestColumn.id.replace('-tasks', '');
            }
        }

        // Move task to new status
        if (newStatus && this.kanbanBoard) {
            this.kanbanBoard.moveTask(taskId, newStatus);
        }

        this.handleDragEnd(e);
    }

    // Reinitialize drag and drop after DOM changes
    refresh() {
        this.setupDragAndDrop();
    }
}

// Initialize drag and drop manager when board is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for kanban board to be initialized
    const checkForBoard = setInterval(() => {
        if (window.kanbanBoard) {
            window.dragDropManager = new DragDropManager(window.kanbanBoard);
            clearInterval(checkForBoard);
        }
    }, 100);
});
