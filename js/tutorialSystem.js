/**
 * TutorialSystem — pixelKanban
 *
 * Self-contained onboarding tutorial system.
 * Depends on: TutorialConfig (tutorialConfig.js), window.notifications (notifications.js)
 *
 * Usage:
 *   const tutorialSystem = new TutorialSystem();
 *   tutorialSystem.init();
 *   tutorialSystem.startTutorial('main');
 */

class TutorialSystem {
    constructor() {
        this.config     = new TutorialConfig();
        this._box       = null;   // floating tooltip element
        this._overlay   = null;   // dim overlay
        this._styleTag  = null;   // injected <style>
        this._resizeRAF = null;
    }

    // ── Public ──────────────────────────────────────────────────────────────

    init() {
        this._injectStyles();
        this._buildDOM();
        this._bindEvents();
        this._addSettingsTrigger();
        window.addEventListener('resize', () => {
            cancelAnimationFrame(this._resizeRAF);
            this._resizeRAF = requestAnimationFrame(() => this._reposition());
        });
    }

    startTutorial(tutorialId = 'main') {
        // Respect the "Show Tutorials" checkbox if present
        const cb = document.getElementById('enableTutorialsSettings');
        if (cb && !cb.checked) {
            this._notify('Tutorials are disabled in settings.', 'info');
            return;
        }
        this.config.startTutorial(tutorialId);
        this._showStep();
    }

    hideTutorial() {
        this.config.stopTutorial();
        this._hide();
    }

    // ── DOM construction ────────────────────────────────────────────────────

    _buildDOM() {
        // Dim overlay (click to close)
        this._overlay = document.createElement('div');
        this._overlay.id = 'pkb-tutorial-overlay';
        this._overlay.addEventListener('click', () => this.hideTutorial());
        document.body.appendChild(this._overlay);

        // Floating tooltip box
        this._box = document.createElement('div');
        this._box.id = 'pkb-tutorial-box';
        this._box.innerHTML = `
            <div class="pkb-tut-header">
                <span class="pkb-tut-step-badge"></span>
                <h3 class="pkb-tut-heading"></h3>
                <button class="pkb-tut-close" aria-label="Close tutorial">×</button>
            </div>
            <p class="pkb-tut-content"></p>
            <div class="pkb-tut-footer">
                <div class="pkb-tut-dots"></div>
                <div class="pkb-tut-actions">
                    <button class="pkb-tut-btn pkb-tut-prev">← Back</button>
                    <button class="pkb-tut-btn pkb-tut-next primary">Next →</button>
                </div>
            </div>
            <div class="pkb-tut-arrow"></div>
        `;
        document.body.appendChild(this._box);
    }

    // ── Event wiring ────────────────────────────────────────────────────────

    _bindEvents() {
        this._box.querySelector('.pkb-tut-close').addEventListener('click', () => this.hideTutorial());
        this._box.querySelector('.pkb-tut-next').addEventListener('click', () => this._next());
        this._box.querySelector('.pkb-tut-prev').addEventListener('click', () => this._prev());

        document.addEventListener('keydown', (e) => {
            if (!this.config.isTutorialActive()) return;
            if (e.key === 'Escape')      this.hideTutorial();
            if (e.key === 'ArrowRight')  this._next();
            if (e.key === 'ArrowLeft')   this._prev();
        });
    }

    _addSettingsTrigger() {
        // Inject a "Start Tutorial" button into the settings panel if it exists.
        // Waits briefly to let settingsManager render the panel first.
        const tryInject = (attempts = 0) => {
            const panel = document.getElementById('panel-settings')
                       || document.querySelector('.settings-panel');
            if (!panel) {
                if (attempts < 20) setTimeout(() => tryInject(attempts + 1), 300);
                return;
            }
            if (panel.querySelector('#pkb-start-tutorial-btn')) return; // already added

            const wrap = document.createElement('div');
            wrap.className = 'control-section';
            wrap.innerHTML = `
                <label class="section-label">Tutorial</label>
                <div class="control-group checkbox-group" style="margin-bottom:10px">
                    <input type="checkbox" id="enableTutorialsSettings" checked>
                    <label for="enableTutorialsSettings">Show tutorials on startup</label>
                </div>
                <button id="pkb-start-tutorial-btn" class="full-btn">
                    <i class="fas fa-graduation-cap"></i> Restart Tutorial
                </button>
            `;
            panel.appendChild(wrap);

            document.getElementById('pkb-start-tutorial-btn')
                .addEventListener('click', () => this.startTutorial('main'));

            document.getElementById('enableTutorialsSettings')
                .addEventListener('change', (e) => {
                    this.config.tutorials.main.enabled = e.target.checked;
                    if (!e.target.checked) this.hideTutorial();
                });
        };
        setTimeout(() => tryInject(), 400);
    }

    // ── Step rendering ──────────────────────────────────────────────────────

    _showStep() {
        const step = this.config.getCurrentStep();
        if (!step) { this.hideTutorial(); return; }

        const total   = this.config.totalSteps;
        const current = this.config.currentStep + 1;
        const isLast  = current === total;

        // Content
        this._box.querySelector('.pkb-tut-step-badge').textContent = `${current} / ${total}`;
        this._box.querySelector('.pkb-tut-heading').textContent    = step.heading;
        this._box.querySelector('.pkb-tut-content').textContent    = step.content;

        // Prev button
        const prevBtn = this._box.querySelector('.pkb-tut-prev');
        prevBtn.style.visibility = current > 1 ? 'visible' : 'hidden';

        // Next / Finish button
        const nextBtn = this._box.querySelector('.pkb-tut-next');
        nextBtn.textContent = isLast ? '🎉 Finish' : 'Next →';

        // Progress dots
        this._renderDots(current - 1, total);

        // Highlight + position
        this._clearHighlight();
        const target = this._resolveTarget(step);
        if (target) target.classList.add('pkb-tut-highlight');

        // Show elements
        this._overlay.classList.add('active');
        this._box.classList.add('active');

        // Position after paint so dimensions are known
        requestAnimationFrame(() => this._positionBox(step, target));
    }

    _next() {
        const n = this.config.nextStep();
        if (n) {
            this._showStep();
        } else {
            this.hideTutorial();
            this._notify('Tutorial complete! 🎉', 'success');
        }
    }

    _prev() {
        if (this.config.prevStep()) this._showStep();
    }

    _hide() {
        this._box.classList.remove('active');
        this._overlay.classList.remove('active');
        this._clearHighlight();
        this._box.querySelector('.pkb-tut-arrow').className = 'pkb-tut-arrow';
    }

    _reposition() {
        if (!this.config.isTutorialActive()) return;
        const step = this.config.getCurrentStep();
        if (step) this._positionBox(step, this._resolveTarget(step));
    }

    // ── Positioning ─────────────────────────────────────────────────────────

    _resolveTarget(step) {
        if (step.elementId) return document.getElementById(step.elementId);
        if (step.selector)  return document.querySelector(step.selector);
        return null;
    }

    _positionBox(step, target) {
        const box  = this._box;
        const arrow = box.querySelector('.pkb-tut-arrow');
        arrow.className = 'pkb-tut-arrow'; // reset

        if (!target || step.position === 'center') {
            // Centre the box
            box.style.top       = '50%';
            box.style.left      = '50%';
            box.style.transform = 'translate(-50%, -50%)';
            return;
        }

        box.style.transform = 'none';
        const tr  = target.getBoundingClientRect();
        const bw  = box.offsetWidth;
        const bh  = box.offsetHeight;
        const gap = (step.marginOverride ?? 12) + 10; // +10 for arrow
        const vw  = window.innerWidth;
        const vh  = window.innerHeight;
        const pad = 12;

        let top, left;

        switch (step.position) {
            case 'top':
                top  = tr.top  - bh - gap;
                left = tr.left + tr.width / 2 - bw / 2;
                arrow.classList.add('arrow-bottom');
                break;
            case 'bottom':
                top  = tr.bottom + gap;
                left = tr.left + tr.width / 2 - bw / 2;
                arrow.classList.add('arrow-top');
                break;
            case 'left':
                top  = tr.top + tr.height / 2 - bh / 2;
                left = tr.left - bw - gap;
                arrow.classList.add('arrow-right');
                break;
            case 'right':
            default:
                top  = tr.top + tr.height / 2 - bh / 2;
                left = tr.right + gap;
                arrow.classList.add('arrow-left');
        }

        // Clamp to viewport
        left = Math.max(pad, Math.min(left, vw - bw - pad));
        top  = Math.max(pad, Math.min(top,  vh - bh - pad));

        box.style.top  = top  + 'px';
        box.style.left = left + 'px';

        // Offset the arrow along its axis to point at the target centre
        this._offsetArrow(arrow, step.position, target, top, left, bw, bh);
    }

    _offsetArrow(arrow, position, target, boxTop, boxLeft, boxW, boxH) {
        const tr = target.getBoundingClientRect();

        if (position === 'top' || position === 'bottom') {
            const targetCX = tr.left + tr.width / 2;
            const arrowX   = targetCX - boxLeft;
            const clamped  = Math.max(20, Math.min(arrowX, boxW - 20));
            arrow.style.left   = clamped + 'px';
            arrow.style.top    = '';
            arrow.style.right  = '';
            arrow.style.bottom = '';
        } else {
            const targetCY = tr.top + tr.height / 2;
            const arrowY   = targetCY - boxTop;
            const clamped  = Math.max(20, Math.min(arrowY, boxH - 20));
            arrow.style.top    = clamped + 'px';
            arrow.style.left   = '';
            arrow.style.right  = '';
            arrow.style.bottom = '';
        }
    }

    // ── Progress dots ────────────────────────────────────────────────────────

    _renderDots(activeIndex, total) {
        const container = this._box.querySelector('.pkb-tut-dots');
        container.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const dot = document.createElement('span');
            dot.className = 'pkb-tut-dot' + (i === activeIndex ? ' active' : '');
            dot.addEventListener('click', () => {
                this.config.currentStep = i;
                this._showStep();
            });
            container.appendChild(dot);
        }
    }

    // ── Highlight helpers ────────────────────────────────────────────────────

    _clearHighlight() {
        document.querySelectorAll('.pkb-tut-highlight')
            .forEach(el => el.classList.remove('pkb-tut-highlight'));
    }

    // ── Notification helper ──────────────────────────────────────────────────

    _notify(msg, type = 'info') {
        if (window.notifications) {
            window.notifications.showNotification(msg, type);
        }
    }

    // ── CSS ──────────────────────────────────────────────────────────────────

    _injectStyles() {
        if (document.getElementById('pkb-tutorial-styles')) return;
        const style = document.createElement('style');
        style.id = 'pkb-tutorial-styles';
        style.textContent = `
/* ── Overlay ───────────────────────────────────────────────────── */
#pkb-tutorial-overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 9980;
    backdrop-filter: blur(2px);
    animation: pkbFadeIn 0.2s ease;
}
#pkb-tutorial-overlay.active { display: block; }

/* ── Box ───────────────────────────────────────────────────────── */
#pkb-tutorial-box {
    display: none;
    position: fixed;
    z-index: 9990;
    width: 340px;
    background: #0d1117;
    border: 1px solid rgba(0,210,255,0.3);
    border-radius: 12px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,210,255,0.08);
    font-family: 'Segoe UI', system-ui, sans-serif;
    overflow: visible;
    animation: pkbSlideIn 0.22s ease;
}
#pkb-tutorial-box.active { display: block; }

/* ── Header ────────────────────────────────────────────────────── */
.pkb-tut-header {
    display: flex; align-items: center; gap: 8px;
    padding: 14px 16px 0;
}
.pkb-tut-step-badge {
    font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
    color: #00d9ff; background: rgba(0,217,255,0.1);
    padding: 2px 7px; border-radius: 20px; white-space: nowrap;
    border: 1px solid rgba(0,217,255,0.25);
}
.pkb-tut-heading {
    flex: 1; margin: 0;
    font-size: 14px; font-weight: 700; color: #f0f6ff;
    line-height: 1.3;
}
.pkb-tut-close {
    background: none; border: none; color: #4b5563;
    font-size: 20px; cursor: pointer; line-height: 1;
    padding: 0 2px; flex-shrink: 0;
    transition: color 0.15s;
}
.pkb-tut-close:hover { color: #e5e7eb; }

/* ── Content ───────────────────────────────────────────────────── */
.pkb-tut-content {
    margin: 10px 16px 0;
    font-size: 13px; line-height: 1.6; color: #9ca3af;
}

/* ── Footer ────────────────────────────────────────────────────── */
.pkb-tut-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px 14px;
}
.pkb-tut-dots { display: flex; gap: 5px; align-items: center; }
.pkb-tut-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: #374151; cursor: pointer;
    transition: background 0.2s, transform 0.2s;
}
.pkb-tut-dot.active  { background: #00d9ff; transform: scale(1.3); }
.pkb-tut-dot:hover:not(.active) { background: #6b7280; }

.pkb-tut-actions { display: flex; gap: 8px; }
.pkb-tut-btn {
    background: #1f2937; border: 1px solid #374151;
    color: #d1d5db; padding: 6px 14px; border-radius: 6px;
    font-size: 12px; cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}
.pkb-tut-btn:hover          { background: #374151; border-color: #4b5563; }
.pkb-tut-btn.primary        { background: #00d9ff1a; border-color: rgba(0,217,255,0.45); color: #00d9ff; }
.pkb-tut-btn.primary:hover  { background: #00d9ff30; }

/* ── Arrow ─────────────────────────────────────────────────────── */
.pkb-tut-arrow {
    position: absolute; width: 0; height: 0; pointer-events: none;
}
.pkb-tut-arrow.arrow-top {
    border-left: 8px solid transparent; border-right: 8px solid transparent;
    border-bottom: 9px solid rgba(0,210,255,0.3);
    top: -9px; transform: translateX(-50%);
}
.pkb-tut-arrow.arrow-top::after {
    content: ''; position: absolute;
    border-left: 7px solid transparent; border-right: 7px solid transparent;
    border-bottom: 8px solid #0d1117;
    top: 1px; left: -7px;
}
.pkb-tut-arrow.arrow-bottom {
    border-left: 8px solid transparent; border-right: 8px solid transparent;
    border-top: 9px solid rgba(0,210,255,0.3);
    bottom: -9px; transform: translateX(-50%);
}
.pkb-tut-arrow.arrow-bottom::after {
    content: ''; position: absolute;
    border-left: 7px solid transparent; border-right: 7px solid transparent;
    border-top: 8px solid #0d1117;
    bottom: 1px; left: -7px;
}
.pkb-tut-arrow.arrow-left {
    border-top: 8px solid transparent; border-bottom: 8px solid transparent;
    border-right: 9px solid rgba(0,210,255,0.3);
    left: -9px; transform: translateY(-50%);
}
.pkb-tut-arrow.arrow-left::after {
    content: ''; position: absolute;
    border-top: 7px solid transparent; border-bottom: 7px solid transparent;
    border-right: 8px solid #0d1117;
    left: 1px; top: -7px;
}
.pkb-tut-arrow.arrow-right {
    border-top: 8px solid transparent; border-bottom: 8px solid transparent;
    border-left: 9px solid rgba(0,210,255,0.3);
    right: -9px; transform: translateY(-50%);
}
.pkb-tut-arrow.arrow-right::after {
    content: ''; position: absolute;
    border-top: 7px solid transparent; border-bottom: 7px solid transparent;
    border-left: 8px solid #0d1117;
    right: 1px; top: -7px;
}

/* ── Target highlight ──────────────────────────────────────────── */
.pkb-tut-highlight {
    position: relative; z-index: 9985;
    box-shadow: 0 0 0 3px rgba(0,217,255,0.5), 0 0 20px rgba(0,217,255,0.15) !important;
    border-radius: 6px;
    animation: pkbPulse 2s infinite;
}

/* ── Animations ────────────────────────────────────────────────── */
@keyframes pkbFadeIn  { from { opacity: 0; } to { opacity: 1; } }
@keyframes pkbSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pkbPulse {
    0%, 100% { box-shadow: 0 0 0 3px rgba(0,217,255,0.5),  0 0 20px rgba(0,217,255,0.15) !important; }
    50%       { box-shadow: 0 0 0 5px rgba(0,217,255,0.25), 0 0 30px rgba(0,217,255,0.25) !important; }
}
        `;
        document.head.appendChild(style);
        this._styleTag = style;
    }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────
window.TutorialSystem = TutorialSystem;

document.addEventListener('DOMContentLoaded', () => {
    window.tutorialSystem = new TutorialSystem();
    window.tutorialSystem.init();

    // Auto-start on first visit (skip if user has dismissed before)
    const seen = localStorage.getItem('pkb-tutorial-seen');
    if (!seen) {
        setTimeout(() => {
            window.tutorialSystem.startTutorial('main');
            localStorage.setItem('pkb-tutorial-seen', '1');
        }, 800); // brief delay so the board finishes rendering
    }
});
