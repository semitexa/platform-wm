/**
 * Tab group rendering — groups windows with same groupId into tabbed interface.
 */

export class TabGroup {
    /**
     * @param {object} opts
     * @param {function(string):void} opts.onTabSelect - Called when a tab is clicked
     * @param {function(string):void} opts.onTabClose - Called when tab close clicked
     * @param {function(string):void} opts.onTabDetach - Called when tab dragged out
     */
    constructor(opts = {}) {
        this._onTabSelect = opts.onTabSelect || (() => {});
        this._onTabClose = opts.onTabClose || (() => {});
        this._onTabDetach = opts.onTabDetach || (() => {});
    }

    /**
     * Group windows by groupId.
     * @param {Array} windows
     * @returns {Map<string, Array>} groupId → grouped windows
     */
    getGroups(windows) {
        const groups = new Map();
        for (const w of windows) {
            if (w.groupId) {
                if (!groups.has(w.groupId)) groups.set(w.groupId, []);
                groups.get(w.groupId).push(w);
            }
        }
        // Sort by groupOrder within each group
        for (const [, members] of groups) {
            members.sort((a, b) => (a.groupOrder || 0) - (b.groupOrder || 0));
        }
        return groups;
    }

    /**
     * Check if a window is part of a group.
     */
    isGrouped(window) {
        return !!window.groupId;
    }

    /**
     * Create a tab bar element for a group of windows.
     * @param {Array} groupWindows - Windows in this group
     * @param {string} activeTabId - Currently visible tab
     * @returns {HTMLElement}
     */
    createTabBar(groupWindows, activeTabId) {
        const bar = document.createElement('div');
        bar.className = 'wm-tab-bar';

        for (const w of groupWindows) {
            const tab = document.createElement('button');
            tab.className = 'wm-tab';
            if (w.id === activeTabId) tab.classList.add('active');
            tab.dataset.windowId = w.id;

            const label = document.createTextNode(w.title || w.appId);
            tab.appendChild(label);

            const close = document.createElement('span');
            close.className = 'tab-close';
            close.textContent = '\u00d7';
            close.addEventListener('click', (e) => {
                e.stopPropagation();
                this._onTabClose(w.id);
            });
            tab.appendChild(close);

            tab.addEventListener('click', () => this._onTabSelect(w.id));

            // Drag out to detach
            let dragStartY = 0;
            tab.addEventListener('pointerdown', (e) => {
                dragStartY = e.clientY;
            });
            tab.addEventListener('pointermove', (e) => {
                if (e.buttons === 1 && Math.abs(e.clientY - dragStartY) > 30) {
                    this._onTabDetach(w.id);
                    dragStartY = Infinity; // prevent repeat
                }
            });

            bar.appendChild(tab);
        }

        return bar;
    }
}
