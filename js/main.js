// main.js - Application initialization and global state management

class KanbanApp {
    constructor() {

   
        this.notifications = null;
        this.fileManager = null;
        this.collectionManager = null;
        this.tutorialConfig = null;
        this.tutorialSystem = null;

        this.currentSettings = this.getDefaultSettings();

        // Undo/Redo stacks
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;

        // Copy/paste layer clipboard
        this.copiedLayer = null;
    }

    async init() {
        // Initialize all modules

        this.fileManager = new FileManager(this);
        this.collectionManager = new CollectionManager(this);
        this.collectionUI = new CollectionUI(this);
        this.databaseManager = new DatabaseManager(this);

        // Initialize tutorial system if available
        if (typeof TutorialConfig !== 'undefined') {
            this.tutorialConfig = new TutorialConfig();
        }
        if (typeof TutorialSystem !== 'undefined') {
            this.tutorialSystem = new TutorialSystem(this);
        }


        this.notifications = new Notifications();

        // Initialize settings manager
        if (typeof SettingsManager !== 'undefined') {
            SettingsManager.init(this);
        }


        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize UI first, then layers
        this.ui.init();

        // Initialize tutorial system if available (after UI is ready)
        if (this.tutorialSystem) {
            this.tutorialSystem.init();
        }

        this.collectionManager.init(); // Initialize collection manager
        this.collectionUI.init(); // Initialize collection UI

        // Initialize database manager and UI
        if (this.databaseManager) {
            // Database UI will be added automatically when settings are opened
        }

        // Auto-start tutorial if enabled (default: enabled)
        if (this.tutorialSystem && this.tutorialConfig) {
            // Wait for UI to be fully ready before checking tutorial settings
            setTimeout(() => {
                const enableTutorialsCheckbox = document.getElementById('enableTutorialsSettings');
                const tutorialsEnabled = enableTutorialsCheckbox ? enableTutorialsCheckbox.checked : true;

                if (tutorialsEnabled) {
                    this.tutorialSystem.startTutorial('main');
                }
            }, 1000); // Increased delay to ensure settings panel is fully initialized
        }




        // ✅ Add automatic loading of saved data
        // Try to load auto-save data first
        if (this.fileManager) {
            const autoSaveLoaded = this.fileManager.loadFromLocalStorage();
            if (!autoSaveLoaded) {
                // If no auto-save, try to load complete project
                if (this.settingsManager && this.settingsManager.loadCompleteProject) {
                    this.settingsManager.loadCompleteProject();
                }
            }
        }

        // Mark as initialized
        this.initialized = true;
    }

    setupEventListeners() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Space bar to play
            if (e.code === 'Space' && !this.isTyping()) {
                e.preventDefault();
                this.playCurrentSound();
            }
            // Ctrl/Cmd + S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.fileManager.exportProject();
            }
            // Ctrl/Cmd + O to open
            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                this.fileManager.importProject();
            }
            // Ctrl/Cmd + Z to undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
            // Ctrl/Cmd + Shift + Z to redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                this.redo();
            }
            // Ctrl/Cmd + Y to redo (alternative)
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }
            // Ctrl/Cmd + C to copy layer
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !this.isTyping()) {
                e.preventDefault();
                this.copyLayer();
            }
            // Ctrl/Cmd + V to paste layer
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !this.isTyping()) {
                e.preventDefault();
                this.pasteLayer();
            }
            // Ctrl/Cmd + D to duplicate layer
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !this.isTyping()) {
                e.preventDefault();
                this.duplicateLayer();
            }
        });


        // Undo/Redo buttons
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undo());
        }

        const redoBtn = document.getElementById('redoBtn');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.redo());
        }

        // Export buttons (now in sidebar)
        const exportLayerBtn = document.getElementById('exportLayerBtn');
        if (exportLayerBtn) {
            exportLayerBtn.addEventListener('click', () => {
                console.log('Export Layer clicked');
                const selectedLayer = this.layerManager.getSelectedLayer();
                if (selectedLayer) {
                    this.fileManager.exportLayer(selectedLayer.id);
                } else {
                    this.notifications.showNotification('No layer selected', 'error');
                }
            });
        }

        const exportMixBtn = document.getElementById('exportMixBtn');
        if (exportMixBtn) {
            exportMixBtn.addEventListener('click', () => {
                console.log('Export Mix clicked');
                this.fileManager.exportMixedOutput();
            });
        }

        // Save/Load Project buttons
        const saveProjectBtn = document.getElementById('saveProject');
        if (saveProjectBtn) {
            saveProjectBtn.addEventListener('click', () => {
                this.fileManager.exportProject();
            });
        }

        // Save to Browser button
        const saveToBrowserBtn = document.getElementById('saveToBrowserBtn');
        if (saveToBrowserBtn) {
            saveToBrowserBtn.addEventListener('click', () => {
                this.saveAllToBrowser();
            });
        }

        const loadProjectBtn = document.getElementById('loadProject');
        if (loadProjectBtn) {
            loadProjectBtn.addEventListener('click', () => {
                this.fileManager.importProject();
            });
        }

  
    }



    isTyping() {
        const activeElement = document.activeElement;
        return activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';
    }



    updateSettings(newSettings) {
        this.currentSettings = { ...this.currentSettings, ...newSettings };
        this.ui.updateDisplay(this.currentSettings);
    }



    saveUndoState() {
        const state = this.getState();
        this.undoStack.push(JSON.parse(JSON.stringify(state)));
        
        // Limit undo stack size
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        
        // Clear redo stack when new action is performed
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length === 0) {
            this.notifications.showNotification('Nothing to undo', 'info');
            return;
        }
        
        // Save current state to redo stack
        const currentState = this.getState();
        this.redoStack.push(JSON.parse(JSON.stringify(currentState)));
        
        // Restore previous state
        const previousState = this.undoStack.pop();
        this.setState(previousState);
        
        this.notifications.showNotification('Undo', 'info');
    }

    redo() {
        if (this.redoStack.length === 0) {
            this.notifications.showNotification('Nothing to redo', 'info');
            return;
        }
        
        // Save current state to undo stack
        const currentState = this.getState();
        this.undoStack.push(JSON.parse(JSON.stringify(currentState)));
        
        // Restore next state
        const nextState = this.redoStack.pop();
        this.setState(nextState);
        
        this.notifications.showNotification('Redo', 'info');
    }

    getState() {
        return {
            version: '1.1', // Updated version for collections support
            currentSettings: this.currentSettings,
     
            collections: this.collectionManager.getState()
        };
    }

    setState(state) {
        if (state.currentSettings) {
            this.updateSettings(state.currentSettings);
        }

        if (state.collections) {
            this.collectionManager.setState(state.collections);
        }
    }


}

// Initialize app when DOM is ready
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new SFXGeneratorApp();
    app.init();
    
    // Mark as initialized after everything is set up
    app.initialized = true;
});


