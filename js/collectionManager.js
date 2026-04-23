/**
 * CollectionManager.js - Manage collections and groups for organizing audio layers
 *
 * Architecture:
 * - Collections: Top-level containers (e.g., "Game SFX", "UI Sounds")
 * - Groups: Sub-containers within collections (e.g., "Explosions", "Footsteps")
 * - Layers: Individual audio layers that belong to groups
 *
 * Only one collection can be viewed at a time, but collections can be saved/loaded
 * Switching collections clears and loads the timeline with the groups and layers from that collection
 */

class CollectionManager {
    constructor(app) {
        this.app = app;
        this.collections = []; // Array of collection objects
        this.currentCollectionId = null; // Currently active collection
        this.nextCollectionId = 1;
        this.nextGroupId = 1;
        this.init();
        this.setupLayerSyncListeners();
    }

    init() {
        // Create a default collection (starts empty - no groups, no layers)
        this.addCollection('Default Collection');

        // Add event listeners for collection changes
        document.addEventListener('collectionChanged', (e) => {
            this.handleCollectionChange(e.detail);
            this.updateCurrentCollectionDisplay();
        });

        // Update the current collection display
        this.updateCurrentCollectionDisplay();
    }

    // Collection Management
    addCollection(name = 'New Collection') {
        const collection = {
            id: `collection-${this.nextCollectionId++}`,
            name: name,
            layers: [], // All layers in this collection (both grouped and ungrouped)
            groups: [], // Optional organizational groups
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.collections.push(collection);

        // If this is the first collection, make it current
        if (this.collections.length === 1) {
            this.currentCollectionId = collection.id;
        }

        this.notifyCollectionChange();
        return collection;
    }

    setCurrentCollection(collectionId) {
        const collection = this.collections.find(c => c.id === collectionId);
        if (collection) {
            this.currentCollectionId = collectionId;
            this.notifyCollectionChange();
            return true;
        }
        return false;
    }

    getCurrentCollection() {
        return this.collections.find(c => c.id === this.currentCollectionId);
    }

    renameCollection(collectionId, newName) {
        const collection = this.collections.find(c => c.id === collectionId);
        if (collection) {
            collection.name = newName;
            collection.updatedAt = new Date().toISOString();
            this.notifyCollectionChange();
            return true;
        }
        return false;
    }

    deleteCollection(collectionId) {
        if (this.collections.length <= 1) {
            this.app.notifications.showNotification('Cannot delete the last collection', 'error');
            return false;
        }

        if (!confirm(`Delete collection "${this.getCollection(collectionId)?.name}"? This cannot be undone.`)) {
            return false;
        }

        const collection = this.getCollection(collectionId);
        if (!collection) return false;

        // Note: We don't delete layers from layer manager anymore
        // since layers are now collection-specific and stored within collections
        // The layer data will be cleaned up when the collection is removed

        const index = this.collections.findIndex(c => c.id === collectionId);
        if (index === -1) return false;

        this.collections.splice(index, 1);

        // If we deleted the current collection, select another one
        if (this.currentCollectionId === collectionId) {
            this.currentCollectionId = this.collections[0].id;
            this.loadCollectionIntoTimeline(this.currentCollectionId);
        }

        this.notifyCollectionChange();
        return true;
    }

    getCollection(collectionId) {
        return this.collections.find(c => c.id === collectionId);
    }

    // Group Management within Collections
    addGroup(collectionId, name = 'New Group') {
        const collection = this.getCollection(collectionId);
        if (!collection) return null;

        const group = {
            id: `group-${this.nextGroupId++}`,
            name: name,
            layerIds: [], // IDs of layers that belong to this group (references to collection.layers)
            expanded: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        collection.groups.push(group);
        collection.updatedAt = new Date().toISOString();
        this.notifyCollectionChange();
        return group;
    }

    renameGroup(collectionId, groupId, newName) {
        const collection = this.getCollection(collectionId);
        if (!collection) return false;

        const group = collection.groups.find(g => g.id === groupId);
        if (group) {
            group.name = newName;
            group.updatedAt = new Date().toISOString();
            collection.updatedAt = new Date().toISOString();
            this.notifyCollectionChange();
            return true;
        }
        return false;
    }

    deleteGroup(collectionId, groupId) {
        const collection = this.getCollection(collectionId);
        if (!collection) return false;

        const groupIndex = collection.groups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return false;

        // Move layers from this group back to the main collection
        const group = collection.groups[groupIndex];
        group.layers.forEach(layerId => {
            // Remove from group but keep in the app's layer manager
            // The layers themselves remain in the app, just not organized in this group
        });

        collection.groups.splice(groupIndex, 1);
        collection.updatedAt = new Date().toISOString();
        this.notifyCollectionChange();
        return true;
    }

    // Expand/Collapse all groups in a collection
    expandCollapseAllGroups(collectionId, expand) {
        const collection = this.getCollection(collectionId);
        if (!collection) return false;

        collection.groups.forEach(group => {
            group.expanded = expand;
        });

        collection.updatedAt = new Date().toISOString();
        this.notifyCollectionChange();
        return true;
    }

    // Add a new group to the current collection
    addGroupToCurrentCollection(name = 'New Group') {
        const currentCollection = this.getCurrentCollection();
        if (!currentCollection) return null;

        return this.addGroup(currentCollection.id, name);
    }

    // Layer Management within Groups
    addLayerToGroup(collectionId, groupId, layerId) {
        const collection = this.getCollection(collectionId);
        if (!collection) return false;

        const group = collection.groups.find(g => g.id === groupId);
        if (!group) return false;

        // Check if layer already exists in this group
        if (group.layerIds.includes(layerId)) return false;

        // Check if the layer exists in the collection
        if (!collection.layers.some(layer => layer.id === layerId)) {
            console.warn(`Layer ${layerId} not found in collection ${collectionId}`);
            return false;
        }

        group.layerIds.push(layerId);
        group.updatedAt = new Date().toISOString();
        collection.updatedAt = new Date().toISOString();
        this.notifyCollectionChange();
        return true;
    }

    // Add a layer directly to a collection
    addLayerToCollection(collectionId, layerData) {
        const collection = this.getCollection(collectionId);
        if (!collection) return false;

        // Check if layer already exists in collection
        if (collection.layers.some(layer => layer.id === layerData.id)) {
            return false;
        }

        // Add the layer to collection
        collection.layers.push({
            id: layerData.id,
            name: layerData.name,
            settings: { ...layerData.settings },
            muted: layerData.muted,
            solo: layerData.solo,
            volume: layerData.volume,
            startTime: layerData.startTime,
            fadeIn: layerData.fadeIn,
            fadeOut: layerData.fadeOut,
            color: layerData.color,
            // Include any additional properties
            ...(layerData.audioClip && { audioClip: { ...layerData.audioClip } }),
            ...(layerData.timelineData && { timelineData: { ...layerData.timelineData } })
        });

        collection.updatedAt = new Date().toISOString();
        this.notifyCollectionChange();
        return true;
    }

    // Sync a layer's current state to collection storage
    syncLayerToCollection(collectionId, layerId) {
        const collection = this.getCollection(collectionId);
        if (!collection) return false;

        // Find the layer in the collection
        const layerIndex = collection.layers.findIndex(layer => layer.id === layerId);
        if (layerIndex === -1) return false;

        // Get the current layer from layer manager
        const currentLayer = this.app.layerManager.getLayer(layerId);
        if (!currentLayer) return false;

        // Update the stored layer with current values
        collection.layers[layerIndex] = {
            id: currentLayer.id,
            name: currentLayer.name,
            settings: { ...currentLayer.settings },
            muted: currentLayer.muted,
            solo: currentLayer.solo,
            volume: currentLayer.volume,
            startTime: currentLayer.startTime,
            fadeIn: currentLayer.fadeIn,
            fadeOut: currentLayer.fadeOut,
            color: currentLayer.color,
            // Include any additional properties
            ...(currentLayer.audioClip && { audioClip: { ...currentLayer.audioClip } }),
            ...(currentLayer.timelineData && { timelineData: { ...currentLayer.timelineData } })
        };

        collection.updatedAt = new Date().toISOString();
        this.notifyCollectionChange();
        return true;
    }

    // Remove a layer from a collection (and all groups)
    removeLayerFromCollection(collectionId, layerId) {
        const collection = this.getCollection(collectionId);
        if (!collection) return false;

        // Remove from collection layers
        const layerIndex = collection.layers.findIndex(layer => layer.id === layerId);
        if (layerIndex !== -1) {
            collection.layers.splice(layerIndex, 1);
        }

        // Remove from all groups
        collection.groups.forEach(group => {
            const groupIndex = group.layerIds.indexOf(layerId);
            if (groupIndex !== -1) {
                group.layerIds.splice(groupIndex, 1);
            }
        });

        collection.updatedAt = new Date().toISOString();
        this.notifyCollectionChange();
        return true;
    }

    removeLayerFromGroup(collectionId, groupId, layerId) {
        const collection = this.getCollection(collectionId);
        if (!collection) return false;

        const group = collection.groups.find(g => g.id === groupId);
        if (!group) return false;

        const index = group.layerIds.indexOf(layerId);
        if (index === -1) return false;

        group.layerIds.splice(index, 1);
        group.updatedAt = new Date().toISOString();
        collection.updatedAt = new Date().toISOString();
        this.notifyCollectionChange();
        return true;
    }

    // Get all layers in current collection (across all groups)
    getAllLayersInCurrentCollection() {
        const collection = this.getCurrentCollection();
        if (!collection) return [];

        const allLayers = [];
        collection.groups.forEach(group => {
            group.layers.forEach(layerId => {
                const layer = this.app.layerManager.getLayer(layerId);
                if (layer) {
                    allLayers.push(layer);
                }
            });
        });

        return allLayers;
    }

    // Export/Import Collections
    exportCollection(collectionId) {
        const collection = this.getCollection(collectionId);
        if (!collection) return null;

        // Create a complete export with the simple architecture
        const exportData = {
            collection: {
                ...collection,
                // Include all layers and groups in their simple form
                layers: [...collection.layers],
                groups: [...collection.groups]
            }
        };

        return exportData;
    }

    importCollection(collectionData) {
        // Create new collection
        const newCollection = this.addCollection(collectionData.collection.name || 'Imported Collection');
        newCollection.createdAt = collectionData.collection.createdAt || new Date().toISOString();
        newCollection.updatedAt = new Date().toISOString();

        // Import layers first (they're the foundation)
        if (collectionData.collection.layers) {
            collectionData.collection.layers.forEach(layerData => {
                this.addLayerToCollection(newCollection.id, layerData);
            });
        }

        // Import groups second (they reference layers)
        if (collectionData.collection.groups) {
            collectionData.collection.groups.forEach(groupData => {
                const newGroup = this.addGroup(newCollection.id, groupData.name);
                newGroup.expanded = groupData.expanded || true;

                // Add layer references to the group
                if (groupData.layerIds) {
                    groupData.layerIds.forEach(layerId => {
                        // Check if layer exists in collection before adding to group
                        if (newCollection.layers.some(layer => layer.id === layerId)) {
                            this.addLayerToGroup(newCollection.id, newGroup.id, layerId);
                        }
                    });
                } else if (groupData.layers) {
                    // Fallback for older format
                    groupData.layers.forEach(layerId => {
                        if (newCollection.layers.some(layer => layer.id === layerId)) {
                            this.addLayerToGroup(newCollection.id, newGroup.id, layerId);
                        }
                    });
                }
            });
        }

        this.notifyCollectionChange();
        return newCollection;
    }

    // Database Integration (to be implemented)
    async saveCollectionToDatabase(collectionId) {
        // This will be implemented when we set up the database
        console.log('Save collection to database:', collectionId);
        return Promise.resolve(false);
    }

    async loadCollectionsFromDatabase() {
        // This will be implemented when we set up the database
        console.log('Load collections from database');
        return Promise.resolve([]);
    }

    // State Management
    getState() {
        return {
            collections: this.collections.map(c => ({ ...c })),
            currentCollectionId: this.currentCollectionId,
            nextCollectionId: this.nextCollectionId,
            nextGroupId: this.nextGroupId
        };
    }

    setState(state) {
        this.collections = state.collections.map(c => ({ ...c }));
        this.currentCollectionId = state.currentCollectionId;
        this.nextCollectionId = state.nextCollectionId;
        this.nextGroupId = state.nextGroupId;

        this.notifyCollectionChange();
    }

    // Collection Timeline Management
    loadCollectionIntoTimeline(collectionId) {
        const collection = this.getCollection(collectionId);
        if (!collection) return false;

        // Clear current layers from layer manager
        this.app.layerManager.clearAllLayers();

        // Load all layers from the collection (both grouped and ungrouped)
        collection.layers.forEach(layerData => {
            // Add to layer manager with the same ID to maintain references
            const newLayer = this.app.layerManager.addLayerWithId(layerData.name, layerData.id);
            // Copy all properties from the stored layer data
            Object.assign(newLayer, { ...layerData });
            if (layerData.settings) {
                newLayer.settings = { ...layerData.settings };
            }
        });

        // If no layers in this collection, it stays empty (as per new requirements)
        // New collections start with zero groups and zero layers

        // Select the first layer if any exist
        if (this.app.layerManager.layers.length > 0) {
            this.app.layerManager.selectLayer(this.app.layerManager.layers[0].id);
        }

        this.notifyCollectionChange();
        return true;
    }

    // Helper method to get layer from collection's stored layers
    getLayerFromCollection(collectionId, layerId) {
        const collection = this.getCollection(collectionId);
        if (!collection) return null;

        // Find the layer in the collection's groups
        for (const group of collection.groups) {
            // Check if this group has layer data stored
            if (group.layerData) {
                const layer = group.layerData.find(l => l.id === layerId);
                if (layer) return layer;
            }
        }

        return null;
    }

    // Clear timeline for new collection
    clearTimelineForNewCollection() {
        this.app.layerManager.clearAllLayers();
        // Reset timeline state
        if (this.app.timeline) {
            this.app.timeline.playheadPosition = 0;
            this.app.timeline.isPlaying = false;
            this.app.timeline.render();
        }
        this.notifyCollectionChange();
    }

    // Synchronize layer data from layer manager back to collection storage
    syncLayerDataToCollection(layerId) {
        const currentCollection = this.getCurrentCollection();
        if (!currentCollection) return;

        // Find which group contains this layer
        for (const group of currentCollection.groups) {
            if (group.layers.includes(layerId)) {
                // Get the layer from layer manager
                const layer = this.app.layerManager.getLayer(layerId);
                if (layer) {
                    // Find the layer in group's layerData
                    if (group.layerData) {
                        const layerDataIndex = group.layerData.findIndex(l => l.id === layerId);
                        if (layerDataIndex !== -1) {
                            // Update the stored layer data with current values
                            group.layerData[layerDataIndex] = {
                                id: layer.id,
                                name: layer.name,
                                settings: { ...layer.settings },
                                muted: layer.muted,
                                solo: layer.solo,
                                volume: layer.volume,
                                startTime: layer.startTime,
                                fadeIn: layer.fadeIn,
                                fadeOut: layer.fadeOut,
                                color: layer.color,
                                // Include any additional properties that might exist
                                ...(layer.audioClip && { audioClip: { ...layer.audioClip } }),
                                ...(layer.timelineData && { timelineData: { ...layer.timelineData } })
                            };
                            group.updatedAt = new Date().toISOString();
                            currentCollection.updatedAt = new Date().toISOString();
                        }
                    }
                }
                break;
            }
        }
    }

    // Sync a specific layer property to collection storage
    syncLayerPropertyToCollection(layerId, propertyName) {
        const currentCollection = this.getCurrentCollection();
        if (!currentCollection) return;

        // Find which group contains this layer
        for (const group of currentCollection.groups) {
            if (group.layers.includes(layerId)) {
                // Get the layer from layer manager
                const layer = this.app.layerManager.getLayer(layerId);
                if (layer && group.layerData) {
                    const layerDataIndex = group.layerData.findIndex(l => l.id === layerId);
                    if (layerDataIndex !== -1) {
                        // Update only the specific property
                        group.layerData[layerDataIndex][propertyName] = layer[propertyName];
                        group.updatedAt = new Date().toISOString();
                        currentCollection.updatedAt = new Date().toISOString();
                    }
                }
                break;
            }
        }
    }

    // Add event listeners for layer changes to sync back to collections
    setupLayerSyncListeners() {
        // Listen for layer changes to sync back to collection storage
        document.addEventListener('layersChanged', (e) => {
            // Sync all layers in current collection
            const currentCollection = this.getCurrentCollection();
            if (currentCollection) {
                currentCollection.layers.forEach(layer => {
                    this.syncLayerToCollection(currentCollection.id, layer.id);
                });
            }
        });
    }

    // Manually sync all layers in current collection (for debugging/testing)
    syncAllLayersToCollection() {
        const currentCollection = this.getCurrentCollection();
        if (!currentCollection) return;

        currentCollection.groups.forEach(group => {
            group.layers.forEach(layerId => {
                this.syncLayerDataToCollection(layerId);
            });
        });

        console.log('Synced all layers to collection storage');
        return true;
    }

    // Event Notification
    notifyCollectionChange() {
        const event = new CustomEvent('collectionChanged', {
            detail: {
                collections: this.collections,
                currentCollectionId: this.currentCollectionId
            }
        });
        document.dispatchEvent(event);
    }

    handleCollectionChange(data) {
        // Handle collection changes from other parts of the app
        console.log('Collection changed:', data);
    }

    // Method to update the current collection display
    updateCurrentCollectionDisplay() {
        const currentCollection = this.collections.find(c => c.id === this.currentCollectionId);
        if (currentCollection) {
            const displayElement = document.getElementById('current-collection-display');
            if (displayElement) {
                displayElement.textContent = `Current Collection: ${currentCollection.name}`;
            }
        }
        this.updateCollectionDropdown();
    }

    // Method to populate the collection dropdown
    updateCollectionDropdown() {
        const dropdown = document.getElementById('collection-dropdown');
        if (!dropdown) return;

        dropdown.innerHTML = '';

        this.collections.forEach(collection => {
            const option = document.createElement('option');
            option.value = collection.id;
            option.textContent = collection.name;
            if (collection.id === this.currentCollectionId) {
                option.selected = true;
            }
            dropdown.appendChild(option);
        });

        // Add event listener for collection selection (only add if not already added)
        if (!dropdown.hasAttribute('data-event-listener-added')) {
            dropdown.addEventListener('change', (e) => {
                const selectedCollectionId = e.target.value;
                this.setCurrentCollection(selectedCollectionId);
                this.loadCollectionIntoTimeline(selectedCollectionId);
            });
            dropdown.setAttribute('data-event-listener-added', 'true');
        }
    }
}