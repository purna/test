/**
 * Tooltip Module — pixelKanban
 *
 * Attaches rich tooltips to:
 *   1. Any element with a [data-tooltip] attribute
 *   2. The header action buttons (automatically, no HTML changes needed)
 *
 * Markdown-lite supported in tooltip text:
 *   **bold**  → green highlight
 *   --italic-- → cyan highlight
 *   \n        → line break
 */

class Tooltip {
    constructor() {
        this._el       = null;
        this._target   = null;
        this._hideTimer = null;
        this._build();
    }

    // ── Private: build the floating element ────────────────────────────────

    _build() {
        this._el = document.createElement('div');
        this._el.className = 'pkb-tooltip';
        Object.assign(this._el.style, {
            position:       'fixed',
            zIndex:         '99998',
            pointerEvents:  'none',
            opacity:        '0',
            transform:      'translateY(6px)',
            transition:     'opacity 0.18s ease, transform 0.18s ease',
            background:     'rgba(8, 8, 20, 0.95)',
            color:          '#e0e7ff',
            padding:        '9px 13px',
            borderRadius:   '8px',
            fontSize:       '12.5px',
            fontFamily:     "'Segoe UI', system-ui, sans-serif",
            lineHeight:     '1.55',
            maxWidth:       '280px',
            whiteSpace:     'pre-line',
            wordWrap:       'break-word',
            boxShadow:      '0 8px 32px rgba(0,0,0,0.5)',
            border:         '1px solid rgba(0,210,255,0.25)',
            backdropFilter: 'blur(10px)',
        });
        document.body.appendChild(this._el);

        // Keep tooltip alive when hovering it directly
        this._el.addEventListener('mouseenter', () => clearTimeout(this._hideTimer));
        this._el.addEventListener('mouseleave', () => this.hide());
    }

    // ── Public API ──────────────────────────────────────────────────────────

    show(text, target) {
        if (!text) return;
        clearTimeout(this._hideTimer);
        this._target = target;

        this._el.innerHTML = text
            .replace(/\n/g,          '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#00ff41">$1</strong>')
            .replace(/--(.*?)--/g,     '<em style="color:#00d9ff">$1</em>');

        // Force a reflow so getBoundingClientRect is accurate
        this._el.style.opacity   = '0';
        this._el.style.display   = 'block';
        this._el.style.pointerEvents = 'auto';

        this._position(target);

        requestAnimationFrame(() => {
            this._el.style.opacity   = '1';
            this._el.style.transform = 'translateY(0)';
        });
    }

    hide() {
        this._hideTimer = setTimeout(() => {
            this._el.style.opacity   = '0';
            this._el.style.transform = 'translateY(6px)';
            this._el.style.pointerEvents = 'none';
            this._target = null;
        }, 90);
    }

    // ── Private: positioning ────────────────────────────────────────────────

    _position(target) {
        const tr  = target.getBoundingClientRect();
        const tip = this._el.getBoundingClientRect();
        const vw  = window.innerWidth;
        const vh  = window.innerHeight;
        const gap = 8;

        // Prefer below; fall back to above
        let top  = tr.bottom + gap;
        let left = tr.left + tr.width / 2 - tip.width / 2;

        if (top + tip.height > vh - 10) {
            top = tr.top - tip.height - gap;
        }

        // Clamp horizontally
        left = Math.max(10, Math.min(left, vw - tip.width - 10));
        top  = Math.max(10, top);

        this._el.style.top  = top  + 'px';
        this._el.style.left = left + 'px';
    }

    // ── Attachment helpers ──────────────────────────────────────────────────

    /** Attach to a single element. Text is taken from `data-tooltip` or the `text` param. */
    attach(el, text) {
        const label = text || el.getAttribute('data-tooltip') || el.getAttribute('title') || '';
        if (!label) return;

        // Remove native title so the browser doesn't double-show
        if (el.hasAttribute('title')) {
            el.dataset.tooltipNativeTitle = el.getAttribute('title');
            el.removeAttribute('title');
        }

        el.addEventListener('mouseenter', () => this.show(label, el));
        el.addEventListener('mouseleave', () => {
            if (!this._el.matches(':hover')) this.hide();
        });
        el.addEventListener('focus',      () => this.show(label, el));
        el.addEventListener('blur',       () => this.hide());
    }

    /** Attach to all elements matching a CSS selector (within an optional root). */
    attachAll(selector, root = document) {
        root.querySelectorAll(selector).forEach(el => this.attach(el));
    }
}

// ── Singleton ───────────────────────────────────────────────────────────────
const tooltip = new Tooltip();
window.tooltip = tooltip;

// ── Header button tooltips (Kanban-specific) ────────────────────────────────
const HEADER_TOOLTIPS = {
    'github-btn':   '**GitHub Boards**\nSync tasks with GitHub Issues\nand manage repositories',
    'messages-btn': '**Messages**\nView team messages\nand task comments',
    'add-user-btn': '**Add User**\nCreate a new team member\nand assign them to tasks',
    'settings-btn': '**Settings**\nConfigure board layout,\nicon style, labels & more',
    'logout-btn':   '**Sign Out**\nLog out of your\ncurrent session',
};

// ── Initialise on DOM ready ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // 1. Built-in header buttons
    Object.entries(HEADER_TOOLTIPS).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) tooltip.attach(el, text);
    });

    // 2. Any element with [data-tooltip]
    tooltip.attachAll('[data-tooltip]');

    // 3. Attachment-type buttons inside the task modal
    const MODAL_TOOLTIPS = {
        'add-image-btn': '**Add Image**\nAttach an image URL',
        'add-video-btn': '**Add Video**\nAttach a video URL',
        'add-audio-btn': '**Add Audio**\nAttach an audio URL',
        'add-doc-btn':   '**Add Document**\nAttach a document URL',
        'add-link-btn':  '**Add Link**\nAttach an external link',
    };
    Object.entries(MODAL_TOOLTIPS).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) tooltip.attach(el, text);
    });

    // 4. Column "Add a card" buttons — attach lazily because columns may
    //    be re-rendered. Use event delegation instead.
    document.addEventListener('mouseover', (e) => {
        const btn = e.target.closest('.add-task-btn');
        if (btn && !btn._tooltipAttached) {
            btn._tooltipAttached = true;
            const col = btn.dataset.status || 'task';
            tooltip.attach(btn, `**Add card**\nCreate a new ${col} task`);
            // Trigger immediately since we're already hovering
            tooltip.show(`**Add card**\nCreate a new ${col} task`, btn);
        }
    });
});
