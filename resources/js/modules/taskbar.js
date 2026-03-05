/**
 * Taskbar rendering — shows open windows in the bottom bar.
 */

export class Taskbar {
    /**
     * @param {HTMLElement} container - The #wm-taskbar element
     * @param {object} opts
     * @param {function(string):void} opts.onActivate - Called when taskbar item clicked
     */
    constructor(container, opts = {}) {
        this._container = container;
        this._onActivate = opts.onActivate || (() => {});
    }

    /**
     * Render taskbar items for current windows.
     * @param {Array} windows - Current window state
     * @param {string|null} activeWindowId - Currently focused window
     * @param {Array} apps - App descriptors for icon lookup
     */
    render(windows, activeWindowId, apps) {
        this._container.innerHTML = '';

        for (const w of windows) {
            const btn = document.createElement('button');
            btn.className = 'wm-taskbar-item';
            if (w.id === activeWindowId) btn.classList.add('active');
            if (w.state === 'minimized') btn.classList.add('minimized');

            const app = apps.find(a => a.id === w.appId);
            const icon = document.createElement('span');
            icon.className = 'wm-taskbar-item__icon';
            if (app && app.icon) {
                icon.textContent = app.icon;
            } else {
                icon.textContent = (w.title || '?').charAt(0).toUpperCase();
            }
            btn.appendChild(icon);

            const label = document.createElement('span');
            label.textContent = w.title || w.appId;
            btn.appendChild(label);

            btn.addEventListener('click', () => this._onActivate(w.id));
            this._container.appendChild(btn);
        }
    }
}
