/**
 * CollectionUI.js - UI components for managing collections and groups
 */

class CollectionUI {
    constructor(app) {
        this.app = app;
        this.collectionManager = app.collectionManager;
        this.layerManager = app.layerManager;

        // Create collections panel
        this.createCollectionsPanel();

        // Add event listeners
        this.setupEventListeners();
    }

    createCollectionsPanel() {
        // Create collections panel container
        const collectionsPanel = document.createElement('div');
        collectionsPanel.id = 'panel-collections';
        collectionsPanel.className = 'panel-content';

        collectionsPanel.innerHTML = `
            <div class="panel-title-row">
                <h3>Collections</h3>
                <div class="collection-controls">
                    <button id="add-collection-btn" class="small-btn" title="Add Collection">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button id="import-collection-btn" class="small-btn" title="Import Collection">
                        <i class="fas fa-upload"></i>
                    </button>
                    <button id="export-collection-btn" class="small-btn" title="Export Collection">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
            <div id="collections-list" class="scroll-list"></div>
        `;

        // Add to side panel
        const sidePanel = document.getElementById('side-panel');
        if (sidePanel) {
            sidePanel.appendChild(collectionsPanel);
        }

        // Create collections sidebar button
        this.addCollectionsSidebarButton();
    }

    addCollectionsSidebarButton() {
        const iconSidebar = document.getElementById('icon-sidebar');
        if (iconSidebar) {
            // Find the position to insert (after presets, before settings)
            const settingsBtn = iconSidebar.querySelector('button[data-panel="settings"]');
            if (settingsBtn) {
                const collectionsBtn = document.createElement('button');
                collectionsBtn.className = 'icon-tab-btn';
                collectionsBtn.setAttribute('data-panel', 'collections');
                collectionsBtn.setAttribute('data-tooltip-right', 'Collections');
                collectionsBtn.innerHTML = '<i class="fas fa-archive"></i>';

                settingsBtn.parentNode.insertBefore(collectionsBtn, settingsBtn);
            }
        }
    }

    setupEventListeners() {
        // Add collection button
        document.getElementById('add-collection-btn')?.addEventListener('click', () => {
            const name = prompt('Enter collection name:', 'New Collection');
            if (name) {
                this.collectionManager.clearTimelineForNewCollection();
                this.collectionManager.addCollection(name);
                this.renderCollections();
            }
        });

        // Import collection button
        document.getElementById('import-collection-btn')?.addEventListener('click', () => {
            this.importCollection();
        });

        // Export collection button
        document.getElementById('export-collection-btn')?.addEventListener('click', () => {
            this.exportCurrentCollection();
        });

        // Listen for collection changes
        document.addEventListener('collectionChanged', () => {
            this.renderCollections();
        });

        // Listen for panel switching
        document.addEventListener('panelChanged', (e) => {
            if (e.detail.panel === 'collections') {
                this.renderCollections();
            }
        });
    }

    renderCollections() {
        const collectionsList = document.getElementById('collections-list');
        if (!collectionsList) return;

        collectionsList.innerHTML = '';

        const currentCollectionId = this.collectionManager.currentCollectionId;

        this.collectionManager.collections.forEach(collection => {
            const collectionEl = document.createElement('div');
            collectionEl.className = `collection-item ${collection.id === currentCollectionId ? 'active' : ''}`;
            collectionEl.dataset.collectionId = collection.id;

            collectionEl.innerHTML = `
                <div class="collection-header">
                    <i class="fas fa-archive collection-icon"></i>
                    <input type="text" class="collection-name-input" value="${collection.name}">
                    <div class="collection-actions">
                        <i class="fas fa-trash delete-collection" title="Delete"></i>
                    </div>
                </div>
            `;

            // Add event listeners for inline collection name editing
            const nameInput = collectionEl.querySelector('.collection-name-input');
            nameInput.addEventListener('click', (e) => e.stopPropagation());
            nameInput.addEventListener('blur', () => {
                const newName = nameInput.value.trim();
                if (newName && newName !== collection.name) {
                    this.collectionManager.renameCollection(collection.id, newName);
                }
            });
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    nameInput.blur();
                }
            });

            collectionEl.querySelector('.delete-collection')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteCollection(collection.id);
            });


            collectionEl.querySelector('.collection-header')?.addEventListener('click', () => {
                this.collectionManager.setCurrentCollection(collection.id);
                this.collectionManager.loadCollectionIntoTimeline(collection.id);
                this.renderCollections();
            });



            collectionsList.appendChild(collectionEl);
        });
    }


    // Collection Management Methods

    deleteCollection(collectionId) {
        if (confirm('Delete this collection? All layer organization will be lost.')) {
            this.collectionManager.deleteCollection(collectionId);
        }
    }




    // Export/Import Methods
    exportCurrentCollection() {
        const currentCollection = this.collectionManager.getCurrentCollection();
        if (!currentCollection) {
            this.app.notifications.showNotification('No collection selected', 'error');
            return;
        }

        const exportData = this.collectionManager.exportCollection(currentCollection.id);

        // Create downloadable JSON file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

        const exportLink = document.createElement('a');
        exportLink.setAttribute('href', dataUri);
        exportLink.setAttribute('download', `${currentCollection.name.replace(/\s+/g, '_')}_collection.json`);
        document.body.appendChild(exportLink);
        exportLink.click();
        document.body.removeChild(exportLink);

        this.app.notifications.showNotification(`Collection "${currentCollection.name}" exported`, 'success');
    }

    importCollection() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const collectionData = JSON.parse(event.target.result);
                    this.collectionManager.importCollection(collectionData);
                    this.app.notifications.showNotification('Collection imported successfully', 'success');
                } catch (error) {
                    console.error('Error importing collection:', error);
                    this.app.notifications.showNotification('Error importing collection: ' + error.message, 'error');
                }
            };
            reader.readAsText(file);
        });

        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    }

    // Collection Export Methods
    exportCollection(collectionId) {
        const collection = this.collectionManager.getCollection(collectionId);
        if (!collection) {
            this.app.notifications.showNotification('Collection not found', 'error');
            return;
        }

        const exportData = this.collectionManager.exportCollection(collectionId);

        // Create downloadable JSON file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

        const exportLink = document.createElement('a');
        exportLink.setAttribute('href', dataUri);
        exportLink.setAttribute('download', `${collection.name.replace(/\s+/g, '_')}_collection.json`);
        document.body.appendChild(exportLink);
        exportLink.click();
        document.body.removeChild(exportLink);

        this.app.notifications.showNotification(`Collection "${collection.name}" downloaded`, 'success');
    }

    // Initialize the UI
    init() {
        this.renderCollections();
    }
}

// Add CSS for collections UI
const collectionsCSS = `
/* Collections Panel Styles */
#panel-collections {
    display: none;
}

#panel-collections.active {
    display: flex;
    flex-direction: column;
}

.collection-controls {
    display: flex;
    gap: 6px;
}

.collection-item {
    background: var(--bg-dark);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    margin-bottom: 8px;
    overflow: hidden;
    transition: all 0.2s ease;
}

.collection-item.active {
    border-color: var(--accent-primary);
    background: rgba(0, 255, 65, 0.08);
    box-shadow: 0 0 8px rgba(0, 255, 65, 0.2);
}

.collection-header {
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.03);
    transition: background-color 0.2s ease;
}

.collection-header:hover {
    background: rgba(255, 255, 255, 0.05);
}

.collection-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
    margin-left: 8px;
}

.collection-icon {
    color: var(--accent-tertiary);
    font-size: 14px;
    margin-right: 8px;
}

.collection-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-left: auto;
}

.collection-actions i {
    font-size: 12px;
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    transition: all 0.2s ease;
    color: var(--text-secondary);
}

.collection-actions i:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
}

.collection-actions .fa-edit:hover {
    color: var(--accent-tertiary);
}

.collection-actions .fa-trash:hover {
    color: #ff6b6b;
}

.collection-actions .fa-eye:hover {
    color: var(--accent-primary);
}


.layer-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-left: auto;
}

.layer-actions i {
    font-size: 12px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
    color: var(--text-secondary);
}

.layer-actions i:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
}

.layer-actions .fa-eye:hover {
    color: var(--accent-primary);
}

.layer-actions .fa-trash:hover {
    color: #ff6b6b;
}

.layer-selection-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--bg-dark);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 20px;
    z-index: 1000;
    width: 400px;
    max-width: 80%;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-color);
}

.dialog-header h4 {
    font-size: 16px;
    font-weight: 600;
    color: var(--accent-primary);
}

.dialog-content {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 15px;
    padding-right: 8px;
}

.dialog-content p {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 12px;
}

.layer-checkbox {
    padding: 8px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--border-color);
}

.layer-checkbox:last-child {
    border-bottom: none;
}

.layer-checkbox input[type="checkbox"] {
    margin-right: 8px;
    width: 16px;
    height: 16px;
    cursor: pointer;
}

.layer-checkbox label {
    font-size: 12px;
    color: var(--text-primary);
    cursor: pointer;
}

.dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.dialog-actions .btn {
    padding: 8px 16px;
    font-size: 12px;
}

.dialog-actions .btn.primary {
    background: var(--accent-primary);
    color: #000;
    border: none;
}

.add-layer-to-group-btn {
    width: 100%;
    background: var(--bg-light);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    margin-top: 8px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

.add-layer-to-group-btn:hover {
    background: var(--bg-medium);
    border-color: var(--accent-tertiary);
    color: var(--accent-tertiary);
}

.add-layer-to-group-btn i {
    font-size: 11px;
}
`;

// Add CSS to document
const styleElement = document.createElement('style');
styleElement.textContent = collectionsCSS;
document.head.appendChild(styleElement);