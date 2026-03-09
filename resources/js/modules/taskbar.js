/**
 * Taskbar rendering — shows open windows in the bottom bar.
 */

export class Taskbar {
    /**
     * @param {HTMLElement} container - The #wm-taskbar element
     * @param {object} opts
     * @param {function(string):void} opts.onActivate - Called when taskbar item clicked
     * @param {function(string):void} opts.onLaunch - Called when app item without windows clicked
     */
    constructor(container, opts = {}) {
        this._container = container;
        this._onActivate = opts.onActivate || (() => {});
        this._onLaunch = opts.onLaunch || (() => {});
    }

    /**
     * Render taskbar items for current windows.
     * @param {Array} windows - Current window state
     * @param {string|null} activeWindowId - Currently focused window
     * @param {Array} apps - App descriptors for icon lookup
     */
    render(windows, activeWindowId, apps) {
        this._container.innerHTML = '';

        const grouped = new Map();
        for (const w of windows) {
            const key = w.appId || '__unknown__';
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(w);
        }

        const orderedAppIds = [];
        for (const appId of grouped.keys()) {
            if (!orderedAppIds.includes(appId)) orderedAppIds.push(appId);
        }

        for (const appId of orderedAppIds) {
            const appWindows = grouped.get(appId) || [];
            const runningCount = appWindows.length;
            const app = apps.find(a => a.id === appId) || null;
            const representative = appWindows[0] || null;
            if (runningCount === 0) continue;

            const btn = document.createElement('button');
            btn.className = 'wm-taskbar-item wm-taskbar-app';
            if (runningCount > 0) btn.classList.add('running');
            if (runningCount > 0 && appWindows.some(w => w.id === activeWindowId)) btn.classList.add('active');
            if (runningCount > 0 && appWindows.every(w => w.state === 'minimized')) btn.classList.add('minimized');
            btn.title = app && app.title ? app.title : (representative?.title || appId);

            const state = document.createElement('span');
            state.className = 'wm-taskbar-item__state';
            btn.appendChild(state);

            const icon = document.createElement('span');
            icon.className = 'wm-taskbar-item__icon';
            if (app && app.icon) {
                icon.textContent = app.icon;
            } else if (representative && representative.title) {
                icon.textContent = representative.title.charAt(0).toUpperCase();
            } else {
                icon.textContent = appId.charAt(0).toUpperCase();
            }
            btn.appendChild(icon);

            const label = document.createElement('span');
            label.className = 'wm-taskbar-item__label';
            label.textContent = app && app.title ? app.title : (representative?.title || appId);
            btn.appendChild(label);

            if (runningCount > 1) {
                const badge = document.createElement('span');
                badge.className = 'wm-taskbar-item__count';
                badge.textContent = String(runningCount);
                btn.appendChild(badge);
            }

            btn.addEventListener('click', () => {
                if (runningCount === 1) {
                    this._onActivate(appWindows[0].id);
                    return;
                }
                const next = this._nextWindowId(appWindows, activeWindowId);
                this._onActivate(next);
            });

            this._container.appendChild(btn);
        }
    }

    _nextWindowId(appWindows, activeWindowId) {
        const idx = appWindows.findIndex(w => w.id === activeWindowId);
        if (idx === -1) {
            const firstNormal = appWindows.find(w => w.state !== 'minimized');
            return firstNormal ? firstNormal.id : appWindows[0].id;
        }
        const nextIdx = (idx + 1) % appWindows.length;
        return appWindows[nextIdx].id;
    }
}
