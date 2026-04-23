/**
 * Notifications Module
 * Standalone notification system for pixelKanban.
 * Supports stacking, manual dismiss, and a convenience `show()` alias.
 */

class Notifications {
    constructor() {
        this._stack = [];
        this._maxVisible = 4;
    }

    /**
     * Core method — show a notification.
     * @param {string} message
     * @param {'info'|'success'|'error'|'warning'} type
     */
    showNotification(message, type = 'info') {
        // Prune oldest if at cap
        if (this._stack.length >= this._maxVisible) {
            const oldest = this._stack.shift();
            if (oldest && oldest.parentNode) oldest.remove();
        }

        const colors = {
            success: '#00ff41',
            error:   '#ff006e',
            warning: '#ffaa00',
            info:    '#00d9ff',
        };
        const icons = {
            success: '✓',
            error:   '✕',
            warning: '⚠',
            info:    'ℹ',
        };

        const el = document.createElement('div');
        el.className = `pkb-notification pkb-notif-${type}`;
        el.setAttribute('role', 'alert');
        el.innerHTML = `
            <span class="pkb-notif-icon">${icons[type] || icons.info}</span>
            <span class="pkb-notif-msg">${message}</span>
            <button class="pkb-notif-close" aria-label="Dismiss">×</button>
        `;

        // Inline styles so the module is self-contained (no extra CSS file needed)
        Object.assign(el.style, {
            position:        'fixed',
            right:           '20px',
            bottom:          `${20 + this._stack.length * 60}px`,
            display:         'flex',
            alignItems:      'center',
            gap:             '10px',
            minWidth:        '260px',
            maxWidth:        '380px',
            padding:         '11px 14px',
            borderRadius:    '8px',
            background:      '#111827',
            borderLeft:      `4px solid ${colors[type] || colors.info}`,
            color:           '#e5e7eb',
            fontSize:        '13px',
            fontFamily:      "'Segoe UI', system-ui, sans-serif",
            boxShadow:       '0 6px 24px rgba(0,0,0,0.45)',
            zIndex:          '99999',
            opacity:         '0',
            transform:       'translateX(20px)',
            transition:      'opacity 0.22s ease, transform 0.22s ease',
            cursor:          'default',
            userSelect:      'none',
        });

        const iconSpan = el.querySelector('.pkb-notif-icon');
        Object.assign(iconSpan.style, {
            color:      colors[type] || colors.info,
            fontWeight: 'bold',
            fontSize:   '15px',
            flexShrink: '0',
        });

        const msgSpan = el.querySelector('.pkb-notif-msg');
        Object.assign(msgSpan.style, { flex: '1', lineHeight: '1.4' });

        const closeBtn = el.querySelector('.pkb-notif-close');
        Object.assign(closeBtn.style, {
            background:  'none',
            border:      'none',
            color:       '#6b7280',
            cursor:      'pointer',
            fontSize:    '18px',
            lineHeight:  '1',
            padding:     '0 2px',
            flexShrink:  '0',
        });
        closeBtn.addEventListener('click', () => this._dismiss(el));

        document.body.appendChild(el);
        this._stack.push(el);

        // Animate in
        requestAnimationFrame(() => {
            el.style.opacity   = '1';
            el.style.transform = 'translateX(0)';
        });

        // Auto-dismiss after 3.5 s
        const timer = setTimeout(() => this._dismiss(el), 3500);
        el._dismissTimer = timer;
    }

    _dismiss(el) {
        clearTimeout(el._dismissTimer);
        el.style.opacity   = '0';
        el.style.transform = 'translateX(20px)';
        setTimeout(() => {
            if (el.parentNode) el.remove();
            this._stack = this._stack.filter(n => n !== el);
            this._restack();
        }, 250);
    }

    _restack() {
        this._stack.forEach((el, i) => {
            el.style.bottom = `${20 + i * 60}px`;
        });
    }

    // ── Convenience aliases ─────────────────────────────────────────────────

    /** Alias used by boardManager, databaseManager etc. */
    show(message, type = 'info') {
        return this.showNotification(message, type);
    }

    success(message) { return this.showNotification(message, 'success'); }
    error(message)   { return this.showNotification(message, 'error');   }
    warning(message) { return this.showNotification(message, 'warning'); }
    info(message)    { return this.showNotification(message, 'info');    }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
window.Notifications = Notifications;

// Single shared instance available as window.notifications
if (!window.notifications) {
    window.notifications = new Notifications();
}

// CommonJS / ES-module compat
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Notifications;
}
