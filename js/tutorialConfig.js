/**
 * TutorialConfig — pixelKanban
 *
 * Defines the step-by-step onboarding tutorial for the Kanban board.
 *
 * Each step supports:
 *   elementId        — ID of the element to highlight (or null for centre modal)
 *   selector         — CSS selector fallback when no ID is set
 *   position         — 'top' | 'bottom' | 'left' | 'right' | 'center'
 *   arrowPosition    — which side of the tooltip box the arrow appears on
 *   arrowOffset      — 'start' | 'center' | 'end' (default 'center')
 *   marginOverride   — extra px gap between tooltip and target
 *   heading          — tooltip heading text
 *   content          — tooltip body text
 */

class TutorialConfig {
    constructor() {
        this.tutorials = {
            main: {
                enabled: true,
                steps: [
                    {
                        id: 'welcome',
                        elementId: null,
                        position: 'center',
                        arrowPosition: 'none',
                        heading: 'Welcome to pixelKanban! 👋',
                        content: 'This quick tour will show you how to manage tasks, collaborate with your team, and connect to GitHub. Use the arrow keys or buttons below to navigate.',
                    },
                    {
                        id: 'board',
                        selector: '.kanban-board',
                        position: 'bottom',
                        arrowPosition: 'top',
                        arrowOffset: 'center',
                        marginOverride: 12,
                        heading: 'Your Kanban Board',
                        content: 'Tasks flow left-to-right through four columns: Backlog → To Do → In Progress → Done. Drag and drop any card to move it between stages.',
                    },
                    {
                        id: 'add-task',
                        selector: '.add-task-btn',
                        position: 'bottom',
                        arrowPosition: 'top',
                        arrowOffset: 'start',
                        marginOverride: 10,
                        heading: 'Adding a Task',
                        content: 'Click "+ Add a card" under any column to create a new task. You can set a title, description, priority, due date, labels, and attach files or links.',
                    },
                    {
                        id: 'github',
                        elementId: 'github-btn',
                        position: 'bottom',
                        arrowPosition: 'top',
                        arrowOffset: 'end',
                        marginOverride: 12,
                        heading: 'GitHub Integration',
                        content: 'Connect your GitHub account to sync tasks with Issues, load milestones, and push board changes directly to a repository.',
                    },
                    {
                        id: 'add-user',
                        elementId: 'add-user-btn',
                        position: 'bottom',
                        arrowPosition: 'top',
                        arrowOffset: 'end',
                        marginOverride: 12,
                        heading: 'Team Members',
                        content: 'Add your teammates here. Once added, you can assign tasks to specific people and filter the board by assignee.',
                    },
                    {
                        id: 'settings',
                        elementId: 'settings-btn',
                        position: 'bottom',
                        arrowPosition: 'top',
                        arrowOffset: 'end',
                        marginOverride: 12,
                        heading: 'Board Settings',
                        content: 'Customise column names, choose emoji or Font Awesome icons, manage labels, configure auto-save, and import or export your board data.',
                    },
                    {
                        id: 'done',
                        elementId: null,
                        position: 'center',
                        arrowPosition: 'none',
                        heading: "You're all set! 🎉",
                        content: "That's everything you need to get started. You can restart this tour at any time from the Settings panel. Happy organising!",
                    },
                ],
            },
        };

        // ── Runtime state ──────────────────────────────────────────────────
        this.currentTutorial = 'main';
        this.currentStep     = 0;
        this.isActive        = false;
    }

    // ── Tutorial management ────────────────────────────────────────────────

    addTutorial(id, config) { this.tutorials[id] = config; }

    getTutorial(id) { return this.tutorials[id] || null; }

    startTutorial(id) {
        if (!this.tutorials[id]) return;
        this.currentTutorial = id;
        this.currentStep     = 0;
        this.isActive        = true;
    }

    stopTutorial()      { this.isActive = false; }
    isTutorialActive()  { return this.isActive; }

    // ── Step navigation ────────────────────────────────────────────────────

    getCurrentStep() {
        const t = this.getTutorial(this.currentTutorial);
        if (!t || this.currentStep >= t.steps.length) return null;
        return t.steps[this.currentStep];
    }

    nextStep() {
        const t = this.getTutorial(this.currentTutorial);
        if (!t) return null;
        this.currentStep++;
        if (this.currentStep >= t.steps.length) return null;
        return this.getCurrentStep();
    }

    prevStep() {
        if (this.currentStep <= 0) return null;
        this.currentStep--;
        return this.getCurrentStep();
    }

    resetTutorial() { this.currentStep = 0; }

    get totalSteps() {
        const t = this.getTutorial(this.currentTutorial);
        return t ? t.steps.length : 0;
    }
}
