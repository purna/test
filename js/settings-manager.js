/**
 * Pixel Audio Settings Manager
 * Modal-based settings management system
 */

const SettingsManager = {
    isOpen: false,
    modalListenersSetup: false,
    settings: {
        masterVolume: 100,
        defaultLength: 1.0,
        showTooltips: true,
        theme: 'dark',
        autoSave: true,
        exportQuality: 1.0,
        exportFormat: 'wav', // Default to WAV, but supports: wav, mp3, ogg, midi
        enableTutorials: true,
        showHints: true,
        autoPlay: true
    },

    init(app) {
        console.log('Initializing Pixel Audio Settings Manager...');
        this.app = app;

        // Ensure DOM is ready before setting up event listeners
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEventListeners();
                this.loadSettings();
                console.log('Settings Manager initialized (DOM ready)');
            });
        } else {
            this.setupEventListeners();
            this.loadSettings();
            console.log('Settings Manager initialized');
        }
    },

    setupEventListeners() {
        // Settings button click - use the existing settings icon button
        const settingsBtn = document.querySelector('.icon-tab-btn[data-panel="settings"]');
        if (settingsBtn) {
            console.log('Settings button found, attaching event listener');

            // Remove any existing click handlers first
            const clone = settingsBtn.cloneNode(true);
            settingsBtn.parentNode.replaceChild(clone, settingsBtn);

            clone.addEventListener('click', (e) => {
                console.log('Settings button clicked');
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                // Prevent the right panel from opening
                this.toggleSettings();
                return false;
            });
        } else {
            console.error('Settings button not found!');
        }

        // Set up modal event listeners immediately since HTML is in the page
        this.setupModalEventListeners();
        this.modalListenersSetup = true;
    },

    toggleSettings() {
        if (this.isOpen) {
            this.closeSettings();
        } else {
            this.openSettings();
        }
    },

    openSettings() {
        // Get the modal that's already in the HTML
        const modal = document.getElementById('settings-modal');
        if (!modal) {
            console.error('Settings modal not found in HTML');
            return;
        }

        this.isOpen = true;
        modal.classList.add('open');

        // Update form values from current settings
        this.updateFormFromSettings();

        // Close on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeSettings();
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeSettings();
            }
        });
    },

    updateFormFromSettings() {
        // Update HTML form values from current settings
        const masterVolumeSlider = document.getElementById('settings-master-volume');
        const masterVolumeDisplay = document.getElementById('master-volume-value');
        const defaultLengthInput = document.getElementById('settings-default-length');
        const showTooltipsCheckbox = document.getElementById('settings-show-tooltips');
        const themeSelect = document.getElementById('settings-theme');
        const autoSaveCheckbox = document.getElementById('settings-auto-save');
        const exportQualitySlider = document.getElementById('settings-export-quality');
        const exportQualityDisplay = document.getElementById('export-quality-value');
        const exportFormatSelect = document.getElementById('settings-export-format');
        const enableTutorialsCheckbox = document.getElementById('settings-enable-tutorials');
        const showHintsCheckbox = document.getElementById('settings-show-hints');
        const autoPlayCheckbox = document.getElementById('settings-auto-play');

        if (masterVolumeSlider) {
            masterVolumeSlider.value = this.settings.masterVolume || 100;
            if (masterVolumeDisplay) masterVolumeDisplay.textContent = (this.settings.masterVolume || 100) + '%';
        }

        if (defaultLengthInput) {
            defaultLengthInput.value = this.settings.defaultLength || 1.0;
        }

        if (showTooltipsCheckbox) {
            showTooltipsCheckbox.checked = this.settings.showTooltips !== false;
        }

        if (themeSelect) {
            themeSelect.value = this.settings.theme || 'dark';
        }

        if (autoSaveCheckbox) {
            autoSaveCheckbox.checked = this.settings.autoSave !== false;
        }

        if (exportQualitySlider) {
            exportQualitySlider.value = this.settings.exportQuality || 1.0;
            if (exportQualityDisplay) exportQualityDisplay.textContent = Math.round((this.settings.exportQuality || 1.0) * 100) + '%';
        }

        if (exportFormatSelect) {
            exportFormatSelect.value = this.settings.exportFormat || 'wav';
        }

        if (enableTutorialsCheckbox) {
            enableTutorialsCheckbox.checked = this.settings.enableTutorials !== false;
        }

        if (showHintsCheckbox) {
            showHintsCheckbox.checked = this.settings.showHints !== false;
        }

        if (autoPlayCheckbox) {
            autoPlayCheckbox.checked = this.settings.autoPlay !== false;
        }
    },

    closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('open');
        }
        this.isOpen = false;
    },

    setupModalEventListeners() {
        const modal = document.getElementById('settings-modal');
        if (!modal) return;

        // Close button
        const closeBtn = document.getElementById('btn-settings-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeSettings();
            });
        }

        // Save button
        const saveBtn = document.getElementById('btn-settings-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
                this.closeSettings();
            });
        }

        // Reset button
        const resetBtn = document.getElementById('btn-settings-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetSettings();
            });
        }

        // Master volume slider
        const masterVolumeSlider = document.getElementById('settings-master-volume');
        const masterVolumeDisplay = document.getElementById('master-volume-value');
        if (masterVolumeSlider && masterVolumeDisplay) {
            masterVolumeSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                masterVolumeDisplay.textContent = value + '%';
            });
        }

        // Export quality slider
        const exportQualitySlider = document.getElementById('settings-export-quality');
        const exportQualityDisplay = document.getElementById('export-quality-value');
        if (exportQualitySlider && exportQualityDisplay) {
            exportQualitySlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                exportQualityDisplay.textContent = Math.round(value * 100) + '%';
            });
        }

        // Save to Browser button
        const saveToBrowserBtn = document.getElementById('saveToBrowserBtn');
        if (saveToBrowserBtn) {
            saveToBrowserBtn.addEventListener('click', () => {
                this.saveSettingsToStorage();
                if (this.app && this.app.notifications) {
                    this.app.notifications.showNotification('Settings saved to browser storage', 'success');
                }
            });
        }

        // Load from Browser button
        const loadFromBrowserBtn = document.getElementById('loadFromBrowserBtn');
        if (loadFromBrowserBtn) {
            loadFromBrowserBtn.addEventListener('click', () => {
                this.loadCompleteProject();
                if (this.app && this.app.notifications) {
                    this.app.notifications.showNotification('Project loaded from browser storage', 'success');
                }
            });
        }

        // Clear All Content button
        const clearAllContentBtn = document.getElementById('clearAllContentBtn');
        if (clearAllContentBtn) {
            clearAllContentBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear ALL content? This will remove all collections, groups, and layers. This cannot be undone!')) {
                    this.clearAllContent();
                }
            });
        }

        // Start Tutorial button
        const startTutorialBtn = document.getElementById('startTutorialBtn');
        if (startTutorialBtn) {
            startTutorialBtn.addEventListener('click', () => {
                if (this.app && this.app.tutorialSystem) {
                    this.app.tutorialSystem.startTutorial('main');
                }
                this.closeSettings();
            });
        }

        // Reset Tutorial Progress button
        const resetTutorialProgressBtn = document.getElementById('resetTutorialProgressBtn');
        if (resetTutorialProgressBtn) {
            resetTutorialProgressBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to reset your tutorial progress? This cannot be undone.')) {
                    if (this.app && this.app.tutorialSystem && this.app.tutorialSystem.resetProgress) {
                        this.app.tutorialSystem.resetProgress();
                        if (this.app.notifications) {
                            this.app.notifications.showNotification('Tutorial progress has been reset', 'info');
                        }
                    } else {
                        if (this.app && this.app.notifications) {
                            this.app.notifications.showNotification('Tutorial system not available', 'error');
                        }
                    }
                }
            });
        }

        // Export Defaults button
        const exportDefaultsBtn = document.getElementById('exportDefaultsBtn');
        if (exportDefaultsBtn) {
            exportDefaultsBtn.addEventListener('click', () => {
                // Export current settings as defaults
                const settingsData = JSON.stringify(this.settings, null, 2);
                const blob = new Blob([settingsData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = 'pixel-audio-settings-defaults.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                if (this.app && this.app.notifications) {
                    this.app.notifications.showNotification('Settings exported as defaults', 'success');
                }
            });
        }

        // Tab system
        const tabButtons = document.querySelectorAll('.settings-tab');
        const tabContents = document.querySelectorAll('.settings-tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');

                // Remove active class from all tabs and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Add active class to clicked tab and corresponding content
                button.classList.add('active');
                const targetContent = document.querySelector(`.settings-tab-content[data-tab-content="${tabName}"]`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    },

    saveSettings() {
        // Read settings from HTML form
        const masterVolumeSlider = document.getElementById('settings-master-volume');
        const defaultLengthInput = document.getElementById('settings-default-length');
        const showTooltipsCheckbox = document.getElementById('settings-show-tooltips');
        const themeSelect = document.getElementById('settings-theme');
        const autoSaveCheckbox = document.getElementById('settings-auto-save');
        const exportQualitySlider = document.getElementById('settings-export-quality');
        const exportFormatSelect = document.getElementById('settings-export-format');
        const enableTutorialsCheckbox = document.getElementById('settings-enable-tutorials');
        const showHintsCheckbox = document.getElementById('settings-show-hints');
        const autoPlayCheckbox = document.getElementById('settings-auto-play');

        this.settings.masterVolume = masterVolumeSlider ? parseInt(masterVolumeSlider.value) : 100;
        this.settings.defaultLength = defaultLengthInput ? parseFloat(defaultLengthInput.value) : 1.0;
        this.settings.showTooltips = showTooltipsCheckbox ? showTooltipsCheckbox.checked : true;
        this.settings.theme = themeSelect ? themeSelect.value : 'dark';
        this.settings.autoSave = autoSaveCheckbox ? autoSaveCheckbox.checked : true;
        this.settings.exportQuality = exportQualitySlider ? parseFloat(exportQualitySlider.value) : 1.0;
        this.settings.exportFormat = exportFormatSelect ? exportFormatSelect.value : 'wav';
        this.settings.enableTutorials = enableTutorialsCheckbox ? enableTutorialsCheckbox.checked : true;
        this.settings.showHints = showHintsCheckbox ? showHintsCheckbox.checked : true;
        this.settings.autoPlay = autoPlayCheckbox ? autoPlayCheckbox.checked : true;

        // Apply settings
        this.applySettings();

        // Save to localStorage
        this.saveSettingsToStorage();

        if (this.app && this.app.notifications) {
            this.app.notifications.showNotification('Settings saved successfully', 'success');
        }
    },

    applySettings() {
        // Apply master volume
        if (this.app && this.app.audioEngine && this.app.audioEngine.setMasterVolume) {
            this.app.audioEngine.setMasterVolume(this.settings.masterVolume / 100);
        }

        // Apply default length to app if available
        if (this.app && this.app.settings) {
            this.app.settings.defaultDuration = this.settings.defaultLength;
        }

        // Apply tooltips setting
        if (this.settings.showTooltips) {
            document.body.classList.remove('tooltips-hidden');
        } else {
            document.body.classList.add('tooltips-hidden');
        }

        // Apply theme
        if (this.settings.theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }

        // Apply auto-save setting
        if (this.settings.autoSave && this.app && this.app.fileManager) {
            // Start auto-save if enabled
            if (this.app.fileManager.startAutoSave) {
                this.app.fileManager.startAutoSave();
            }
        } else if (this.app && this.app.fileManager && this.app.fileManager.stopAutoSave) {
            this.app.fileManager.stopAutoSave();
        }

        // Apply auto-play setting
        if (this.app) {
            this.app.autoPlayEnabled = this.settings.autoPlay;
        }
    },

    resetSettings() {
        if (confirm('Reset all settings to default values?')) {
            // Reset to defaults
            this.settings = {
                masterVolume: 100,
                defaultLength: 1.0,
                showTooltips: true,
                theme: 'dark',
                autoSave: true,
                exportQuality: 1.0,
                exportFormat: 'wav', // Default to WAV, but MIDI is available as option
                enableTutorials: true,
                showHints: true,
                autoPlay: true
            };

            // Update HTML form
            this.updateFormFromSettings();

            // Apply settings
            this.applySettings();

            // Save to localStorage
            this.saveSettingsToStorage();

            if (this.app && this.app.notifications) {
                this.app.notifications.showNotification('Settings reset to defaults', 'info');
            }
        }
    },

    loadSettings() {
        try {
            const saved = localStorage.getItem('pixelAudio-settings');
            if (saved) {
                const loadedSettings = JSON.parse(saved);
                this.settings = { ...this.settings, ...loadedSettings };

                // Update the UI form
                this.updateFormFromSettings();

                // Apply the loaded settings
                this.applySettings();

                if (this.app && this.app.notifications) {
                    this.app.notifications.showNotification('Settings loaded successfully', 'success');
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            if (this.app && this.app.notifications) {
                this.app.notifications.showNotification('Failed to load settings', 'error');
            }
        }
    },

    saveSettingsToStorage() {
        try {
            localStorage.setItem('pixelAudio-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Error saving settings:', error);
            if (this.app && this.app.notifications) {
                this.app.notifications.showNotification('Failed to save settings', 'error');
            }
        }
    },

    // Load complete project from browser storage
    loadCompleteProject() {
        try {
            const projectData = localStorage.getItem('pixelAudioCompleteProject');
            if (projectData) {
                const parsed = JSON.parse(projectData);

                // Handle both old and new formats
                if (parsed.state) {
                    // New format with version 2.0
                    this.app.setState(parsed.state);
                } else if (parsed.collections) {
                    // Handle direct collections data
                    this.app.collectionManager.setState(parsed.collections);
                } else {
                    // Very old format - try to handle gracefully
                    this.app.setState(parsed);
                }

                if (this.app && this.app.notifications) {
                    this.app.notifications.showNotification('Complete project loaded from browser!', 'success');
                }
                return true;
            } else {
                if (this.app && this.app.notifications) {
                    this.app.notifications.showNotification('No complete project found in browser storage', 'info');
                }
                return false;
            }
        } catch (error) {
            console.error('Error loading complete project:', error);
            if (this.app && this.app.notifications) {
                this.app.notifications.showNotification('Error loading project: ' + error.message, 'error');
            }
            return false;
        }
    },

    getSettings() {
        return { ...this.settings };
    }
};

// Initialize the settings manager when the app is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if app is available globally
    if (typeof app !== 'undefined') {
        SettingsManager.init(app);
    } else {
        // If app is not available yet, try to initialize later
        setTimeout(() => {
            if (typeof app !== 'undefined') {
                SettingsManager.init(app);
            }
        }, 1000);
    }
});

// Add database UI when settings manager is initialized
if (typeof app !== 'undefined' && app.databaseManager) {
    // Database UI will be added by the DatabaseManager itself
}