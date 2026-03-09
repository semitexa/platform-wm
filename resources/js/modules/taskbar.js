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
     * @param {Map<string, string>} activeGroupTabs - Group id to active tab window id
     */
    render(windows, activeWindowId, apps, activeGroupTabs = new Map()) {
        this._container.innerHTML = '';
        const appsById = new Map((apps || []).map((app) => [app.id, app]));

        const grouped = new Map();
        for (const w of windows) {
            const key = w.appId || '__unknown__';
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(w);
        }

        const orderedAppIds = [...grouped.keys()];

        for (const appId of orderedAppIds) {
            const appWindows = grouped.get(appId) || [];
            const runningCount = appWindows.length;
            const app = appsById.get(appId) || null;
            const cycleWindows = this._getCycleWindows(appWindows, activeGroupTabs);
            const representative = cycleWindows[0] || appWindows[0] || null;
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
                if (cycleWindows.length === 1) {
                    this._onActivate(cycleWindows[0].id);
                    return;
                }
                const next = this._nextWindowId(cycleWindows, activeWindowId);
                this._onActivate(next);
            });

            this._container.appendChild(btn);
        }
    }

    _getCycleWindows(appWindows, activeGroupTabs) {
        const cycleWindows = [];
        const seenGroups = new Set();

        for (const window of appWindows) {
            if (!window.groupId) {
                cycleWindows.push(window);
                continue;
            }

            if (seenGroups.has(window.groupId)) continue;
            seenGroups.add(window.groupId);

            const activeTabId = activeGroupTabs.get(window.groupId);
            const representative = appWindows.find((candidate) => candidate.groupId === window.groupId && candidate.id === activeTabId)
                || appWindows.find((candidate) => candidate.groupId === window.groupId)
                || window;

            cycleWindows.push(representative);
        }

        return cycleWindows;
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
