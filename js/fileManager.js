// fileManager.js - Project import/export and file management

class FileManager {
    constructor(app) {
        this.app = app;
        this.autoSaveKey = 'sfx_generator_autosave';
        this.autoSaveInterval = null;
    }

    // Export entire project as JSON
    exportProject(filename = null) {
        try {
            const projectData = {
                version: '2.0', // Updated version for collections support
                timestamp: Date.now(),
                name: filename || 'SFX Project',
                layers: this.app.layerManager.getState(),
                settings: this.app.currentSettings,
                audioEngine: {
                    sampleRate: this.app.audioEngine.sampleRate
                },
                timeline: this.app.timeline.getState(),
                collections: this.app.collectionManager.getState() // ✅ Added collections data
            };

            console.log('Exporting project with', projectData.layers.layers.length, 'layers',
                       'and', projectData.collections.collections.length, 'collections');

            const json = JSON.stringify(projectData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = (filename || 'sfx_project') + '.json';

            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            this.app.notifications.showNotification('Project exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting project:', error);
            this.app.notifications.showNotification('Error exporting project: ' + error.message, 'error');
        }
    }

    // Import project from JSON file
    importProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const projectData = JSON.parse(event.target.result);

                    console.log('Loading project data:', projectData);

                    // Validate project data - handle both old and new formats
                    if (projectData.version && (projectData.layers || projectData.state)) {
                        if (projectData.layers) {
                            // New format with explicit layers
                            if (projectData.layers.layers) {
                                this.app.layerManager.setState(projectData.layers);
                            }
                            if (projectData.settings) {
                                this.app.updateSettings(projectData.settings);
                            }
                            if (projectData.audioEngine && projectData.audioEngine.sampleRate) {
                                this.app.audioEngine.setSampleRate(projectData.audioEngine.sampleRate);
                            }
                            if (projectData.timeline) {
                                this.app.timeline.setState(projectData.timeline);
                            }
                            // ✅ Handle collections data for new format
                            if (projectData.collections) {
                                this.app.collectionManager.setState(projectData.collections);
                            }
                        } else if (projectData.state) {
                            // Old format with state object
                            this.app.setState(projectData.state);
                        }

                        this.app.notifications.showNotification('Project loaded successfully!', 'success');
                    } else {
                        throw new Error('Invalid project file format');
                    }
                } catch (error) {
                    console.error('Error loading project:', error);
                    this.app.notifications.showNotification('Error loading project: ' + error.message, 'error');
                }
            };

            reader.readAsText(file);
        };

        input.click();
    }

    // Export single layer as WAV
    exportLayer(layerId, filename = null) {
        const layer = this.app.layerManager.getLayer(layerId);
        if (!layer) {
            console.error('Layer not found:', layerId);
            this.app.notifications.showNotification('Layer not found!', 'error');
            return;
        }

        try {
            console.log('Exporting layer:', layer.name);
            const buffer = this.app.soundGenerator.generate(
                layer.settings,
                this.app.audioEngine.sampleRate
            );

            const name = filename || `${layer.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.wav`;
            this.app.audioEngine.downloadWAV(buffer, name);
            
            this.app.notifications.showNotification(`Layer "${layer.name}" exported!`, 'success');
        } catch (error) {
            console.error('Error exporting layer:', error);
            this.app.notifications.showNotification('Error exporting layer: ' + error.message, 'error');
        }
    }

    // Export all layers individually
    exportAllLayers() {
        const layers = this.app.layerManager.layers;
        
        if (layers.length === 0) {
            this.app.notifications.showNotification('No layers to export', 'error');
            return;
        }

        layers.forEach((layer, index) => {
            setTimeout(() => {
                this.exportLayer(layer.id);
            }, index * 100); // Stagger downloads to avoid browser blocking
        });
        
        this.app.notifications.showNotification(`Exporting ${layers.length} layer(s)...`, 'info');
    }

    // Export mixed output
    exportMixedOutput(filename = null) {
        try {
            console.log('Exporting mixed output');
            const name = filename || `mixed_output_${Date.now()}.wav`;
            this.app.layerManager.exportMixedAudio(name);
            this.app.notifications.showNotification('Mixed output exported!', 'success');
        } catch (error) {
            console.error('Error exporting mixed output:', error);
            this.app.notifications.showNotification('Error exporting mixed output: ' + error.message, 'error');
        }
    }

    // Auto-save functionality
    enableAutoSave(intervalMinutes = 2) {
        this.disableAutoSave(); // Clear any existing interval
        
        this.autoSaveInterval = setInterval(() => {
            this.saveToLocalStorage();
        }, intervalMinutes * 60 * 1000);
        
        // Also save on page unload
        window.addEventListener('beforeunload', () => {
            this.saveToLocalStorage();
        });
    }

    disableAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    saveToLocalStorage() {
        try {
            const state = this.app.getState();
            const data = {
                version: '2.0', // Updated to include collections support
                timestamp: Date.now(),
                state: state
            };
            localStorage.setItem(this.autoSaveKey, JSON.stringify(data));
            console.log('Auto-saved to local storage with', state.collections.collections.length, 'collections');
        } catch (error) {
            console.error('Error auto-saving:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const data = localStorage.getItem(this.autoSaveKey);
            if (data) {
                const parsed = JSON.parse(data);

                // Handle both old and new formats
                if (parsed.state) {
                    // New format with version 2.0
                    this.app.setState(parsed.state);
                } else if (parsed.collections) {
                    // Handle direct collections data (fallback)
                    this.app.collectionManager.setState(parsed.collections);
                } else {
                    // Very old format - try to handle gracefully
                    this.app.setState(parsed);
                }

                const date = new Date(parsed.timestamp);
                this.app.notifications.showNotification(
                    `Restored from auto-save (${date.toLocaleString()})`,
                    'info'
                );
                return true;
            }
        } catch (error) {
            console.error('Error loading auto-save:', error);
            this.app.notifications.showNotification('Error loading auto-save: ' + error.message, 'error');
        }
        return false;
    }

    clearAutoSave() {
        try {
            localStorage.removeItem(this.autoSaveKey);
            this.app.notifications.showNotification('Auto-save cleared', 'info');
        } catch (error) {
            console.error('Error clearing auto-save:', error);
        }
    }

    // Import settings from JSON
    importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const settings = JSON.parse(event.target.result);
                    
                    // Validate settings
                    if (typeof settings !== 'object') {
                        throw new Error('Invalid settings format');
                    }
                    
                    this.app.updateSettings(settings);
                    this.app.notifications.showNotification('Settings imported!', 'success');
                } catch (error) {
                    console.error('Error importing settings:', error);
                    this.app.notifications.showNotification('Error importing settings: ' + error.message, 'error');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }

    // Export current settings as JSON
    exportSettings(filename = null) {
        const settings = this.app.currentSettings;
        const json = JSON.stringify(settings, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = (filename || 'sfx_settings') + '.json';
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.app.notifications.showNotification('Settings exported!', 'success');
    }

    // Create preset from current settings
    saveAsPreset(name) {
        if (!name || name.trim() === '') {
            this.app.notifications.showNotification('Please provide a preset name', 'error');
            return;
        }

        this.app.presets.add(name, this.app.currentSettings);
        
        // Save custom presets to localStorage
        this.saveCustomPresets();
        
        this.app.notifications.showNotification(`Preset "${name}" saved!`, 'success');
    }

    saveCustomPresets() {
        try {
            const customPresets = {};
            const allPresets = this.app.presets.presets;
            
            // Filter out default presets (simple check - you may want to track this differently)
            const defaultPresets = ['pickup', 'laser', 'explosion', 'powerup', 'hit', 'jump', 
                                   'click', 'blip', 'hover', 'synth', 'tone'];
            
            for (let key in allPresets) {
                if (!defaultPresets.includes(key)) {
                    customPresets[key] = allPresets[key];
                }
            }
            
            localStorage.setItem('sfx_custom_presets', JSON.stringify(customPresets));
        } catch (error) {
            console.error('Error saving custom presets:', error);
        }
    }

    loadCustomPresets() {
        try {
            const data = localStorage.getItem('sfx_custom_presets');
            if (data) {
                const customPresets = JSON.parse(data);
                
                for (let key in customPresets) {
                    this.app.presets.add(key, customPresets[key]);
                }
                
                console.log('Loaded custom presets:', Object.keys(customPresets));
            }
        } catch (error) {
            console.error('Error loading custom presets:', error);
        }
    }
}
