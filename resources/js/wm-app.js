/**
 * WM Shell — Main ES module entry point.
 * Orchestrates all window management modules.
 */

import { configure, updateWindow, createWindow, deleteWindow, getState, groupWindows, ungroupWindow, logout } from './modules/api-client.js';
import { SseClient } from './modules/sse-client.js';
import { StackManager } from './modules/stack-manager.js';
import { DragManager } from './modules/drag-manager.js';
import { ResizeManager } from './modules/resize-manager.js';
import { Taskbar } from './modules/taskbar.js';
import { TabGroup } from './modules/tab-group.js';
import { defineWindowFrame } from './modules/window-frame.js';
import { DesktopIcons } from './modules/desktop-icons.js';
import { MessageBus } from './modules/message-bus.js';

export function init(bootstrap) {
    if (!bootstrap) {
        console.error('[WM] Missing bootstrap data');
        return;
    }

    const apiBase = bootstrap.apiBase || '/api/platform/wm';
    const sseUrl = (bootstrap.sseUrl || '/sse') + '?session_id=' + encodeURIComponent(bootstrap.sessionId || '');
    const apps = bootstrap.apps || [];
    const user = bootstrap.user || null;

    configure(apiBase);

    // --- State ---
    const state = { windows: (bootstrap.windows || []).slice() };
    /** @type {Map<string, string>} windowId → pre-maximize bounds JSON */
    const preMaxBounds = new Map();
    /** @type {Map<string, string>} groupId → active tab windowId */
    const activeGroupTabs = new Map();

    // --- Managers ---
    const stackManager = new StackManager();
    const dragManager = new DragManager();
    const resizeManager = new ResizeManager();

    // --- Build app URL with _wmWindowId injected ---
    function buildAppUrl(app, context, windowId) {
        let url = app.entryUrl || '/';
        const params = [];
        if (context && typeof context === 'object') {
            for (const k of Object.keys(context)) {
                params.push(encodeURIComponent(k) + '=' + encodeURIComponent(context[k]));
            }
        }
        if (windowId) {
            params.push('_wmWindowId=' + encodeURIComponent(windowId));
        }
        if (params.length) {
            url += (url.indexOf('?') !== -1 ? '&' : '?') + params.join('&');
        }
        return url;
    }

    // --- Define custom element ---
    defineWindowFrame(apps, buildAppUrl);

    // --- DOM references ---
    const container = document.getElementById('wm-windows');
    const desktopIconsEl = document.getElementById('wm-desktop-icons');
    const taskbarEl = document.getElementById('wm-taskbar');
    const launcherEl = document.getElementById('wm-app-launcher');
    const rightBarEl = document.getElementById('wm-app-bar-right');

    if (!container) return;

    // --- Tab Group ---
    const tabGroup = new TabGroup({
        onTabSelect(windowId) {
            const w = state.windows.find(w => w.id === windowId);
            if (w && w.groupId) {
                activeGroupTabs.set(w.groupId, windowId);
                renderWindows();
            }
        },
        onTabClose(windowId) {
            closeWindow(windowId);
        },
        onTabDetach(windowId) {
            ungroupWindow(windowId).then(() => fetchState());
        },
    });

    // --- Taskbar ---
    const taskbar = taskbarEl ? new Taskbar(taskbarEl, {
        onActivate(windowId) {
            const w = state.windows.find(w => w.id === windowId);
            if (!w) return;

            if (w.state === 'minimized') {
                // Restore
                w.state = 'normal';
                updateWindow(windowId, { state: 'normal' });
                stackManager.focus(windowId);
                renderWindows();
            } else if (stackManager.getTopWindowId() === windowId) {
                // Already focused → minimize
                w.state = 'minimized';
                updateWindow(windowId, { state: 'minimized' });
                renderWindows();
            } else {
                // Focus
                stackManager.focus(windowId);
                renderWindows();
            }
        }
    }) : null;

    // --- Desktop Icons ---
    const desktopIcons = desktopIconsEl ? new DesktopIcons(desktopIconsEl, openWindow) : null;

    // --- Window frame map (for iframe lookups) ---
    /** @type {Map<string, HTMLElement>} */
    const frameElements = new Map();
    // Persistent map: iframe contentWindow → windowId (survives re-renders)
    /** @type {Map<Window, string>} */
    const iframeSourceMap = new Map();

    function cleanIframeSourceMap(windowId) {
        for (const [source, id] of iframeSourceMap) {
            if (id === windowId) iframeSourceMap.delete(source);
        }
    }

    function trackIframeSource(windowId, frame) {
        const iframe = frame.iframeEl || frame.querySelector('iframe');
        // Remove stale entries for this windowId before setting new ones
        cleanIframeSourceMap(windowId);
        if (iframe && iframe.contentWindow) {
            iframeSourceMap.set(iframe.contentWindow, windowId);
        }
        // Also track when iframe loads (cross-origin may reset contentWindow)
        if (iframe) {
            iframe.addEventListener('load', () => {
                if (iframe.contentWindow) {
                    cleanIframeSourceMap(windowId);
                    iframeSourceMap.set(iframe.contentWindow, windowId);
                }
            }, { once: true });
        }
    }

    // --- Render ---
    function renderWindows() {
        container.innerHTML = '';
        frameElements.clear();
        stackManager.init(state.windows);

        // Group windows by groupId
        const groups = tabGroup.getGroups(state.windows);
        const groupedIds = new Set();
        for (const [, members] of groups) {
            for (const m of members) groupedIds.add(m.id);
        }

        // Render ungrouped windows
        for (const w of state.windows) {
            if (groupedIds.has(w.id)) continue;
            if (w.state === 'minimized') continue;
            renderSingleWindow(w);
        }

        // Render grouped windows (one frame per group)
        for (const [groupId, members] of groups) {
            // All minimized? skip
            if (members.every(m => m.state === 'minimized')) continue;
            renderGroupedWindow(groupId, members);
        }

        // Update taskbar
        if (taskbar) {
            taskbar.render(state.windows, stackManager.getTopWindowId(), apps);
        }
    }

    function renderSingleWindow(w) {
        const frame = document.createElement('wm-window-frame');
        frame.setWindow(w);
        applyBounds(frame, w);
        frame.style.zIndex = String(stackManager.getZIndex(w.id));

        // Drag
        const titlebar = frame.titlebarEl;
        if (titlebar) {
            dragManager.attach(titlebar, frame, {
                onStart() {
                    stackManager.focus(w.id);
                    frame.style.zIndex = String(stackManager.getZIndex(w.id));
                },
                onEnd(pos) {
                    const bounds = { ...w.bounds, x: pos.x, y: pos.y };
                    w.bounds = bounds;
                    updateWindow(w.id, { bounds });
                },
            });
        }

        // Resize
        resizeManager.attach(frame, {
            onEnd(bounds) {
                w.bounds = bounds;
                updateWindow(w.id, { bounds });
            },
        });

        // Focus on pointerdown
        frame.addEventListener('pointerdown', () => {
            if (stackManager.getTopWindowId() !== w.id) {
                stackManager.focus(w.id);
                applyZIndexes();
            }
        });

        // Window events
        frame.addEventListener('wm-close', (e) => closeWindow(e.detail.windowId));
        frame.addEventListener('wm-minimize', (e) => minimizeWindow(e.detail.windowId));
        frame.addEventListener('wm-maximize', (e) => toggleMaximize(e.detail.windowId));

        container.appendChild(frame);
        frameElements.set(w.id, frame);
        trackIframeSource(w.id, frame);
    }

    function renderGroupedWindow(groupId, members) {
        // Determine active tab
        let activeTabId = activeGroupTabs.get(groupId);
        if (!activeTabId || !members.find(m => m.id === activeTabId)) {
            activeTabId = members[0].id;
            activeGroupTabs.set(groupId, activeTabId);
        }

        const activeWindow = members.find(m => m.id === activeTabId) || members[0];

        // Wrapper div
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        applyBounds(wrapper, activeWindow);
        wrapper.style.zIndex = String(stackManager.getZIndex(activeTabId));

        // Shared control bar (title + close/min/max) — above tabs
        const controlBar = document.createElement('div');
        controlBar.className = 'wm-group-controlbar';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'wm-group-controlbar__title';
        titleSpan.textContent = activeWindow.title || activeWindow.appId;
        controlBar.appendChild(titleSpan);

        const btnArea = document.createElement('div');
        btnArea.className = 'wm-group-controlbar__buttons';
        for (const [action, label] of [['minimize', '\u2212'], ['maximize', '\u25a1'], ['close', '\u00d7']]) {
            const btn = document.createElement('button');
            btn.className = 'wm-group-controlbar__btn' + (action === 'close' ? ' close' : '');
            btn.textContent = label;
            btn.title = action.charAt(0).toUpperCase() + action.slice(1);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (action === 'close') {
                    closeWindow(activeTabId);
                } else if (action === 'minimize') {
                    for (const m of members) minimizeWindow(m.id);
                } else if (action === 'maximize') {
                    // Toggle maximize for all group members based on active tab's state
                    const activeW = members.find(m => m.id === activeTabId) || members[0];
                    const shouldMaximize = activeW.state !== 'maximized';
                    for (const m of members) {
                        if (shouldMaximize && m.state !== 'maximized') toggleMaximize(m.id);
                        else if (!shouldMaximize && m.state === 'maximized') toggleMaximize(m.id);
                    }
                }
            });
            btnArea.appendChild(btn);
        }
        controlBar.appendChild(btnArea);
        wrapper.appendChild(controlBar);

        // Tab bar — below control bar
        const tabBar = tabGroup.createTabBar(members, activeTabId);
        wrapper.appendChild(tabBar);

        // Render each member's frame (only active visible)
        for (const m of members) {
            const frame = document.createElement('wm-window-frame');
            frame.setWindow(m);
            frame.hideTitlebar();
            frame.style.position = 'relative';
            frame.style.width = '100%';
            frame.style.flex = '1';
            frame.style.display = m.id === activeTabId ? 'flex' : 'none';
            frame.style.borderRadius = '0 0 8px 8px';

            frame.addEventListener('wm-close', (e) => closeWindow(e.detail.windowId));
            frame.addEventListener('wm-minimize', (e) => minimizeWindow(e.detail.windowId));
            frame.addEventListener('wm-maximize', (e) => toggleMaximize(e.detail.windowId));

            wrapper.appendChild(frame);
            frameElements.set(m.id, frame);
            trackIframeSource(m.id, frame);
        }

        // Drag via control bar AND tab bar
        const dragOpts = {
            onStart() {
                stackManager.focus(activeTabId);
                wrapper.style.zIndex = String(stackManager.getZIndex(activeTabId));
            },
            onEnd(pos) {
                const bounds = { ...activeWindow.bounds, x: pos.x, y: pos.y };
                // Update all members' bounds
                for (const m of members) {
                    m.bounds = bounds;
                    updateWindow(m.id, { bounds });
                }
            },
        };
        dragManager.attach(controlBar, wrapper, dragOpts);
        dragManager.attach(tabBar, wrapper, dragOpts);

        // Resize
        resizeManager.attach(wrapper, {
            onEnd(bounds) {
                for (const m of members) {
                    m.bounds = bounds;
                    updateWindow(m.id, { bounds });
                }
            },
        });

        wrapper.addEventListener('pointerdown', () => {
            if (stackManager.getTopWindowId() !== activeTabId) {
                stackManager.focus(activeTabId);
                applyZIndexes();
            }
        });

        container.appendChild(wrapper);
    }

    function applyBounds(el, w) {
        const b = w.bounds || { x: 50, y: 50, w: 800, h: 600 };
        if (w.state === 'maximized') {
            el.style.left = '0';
            el.style.top = '0';
            el.style.width = '100vw';
            el.style.height = 'calc(100vh - 48px)';
        } else {
            const vw = container.clientWidth;
            const vh = container.clientHeight;
            const x = Math.max(0, Math.min(b.x, vw - 200));
            const y = Math.max(0, Math.min(b.y, vh - 120));
            const bw = Math.min(b.w, Math.max(200, vw - x));
            const bh = Math.min(b.h, Math.max(120, vh - y));
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            el.style.width = bw + 'px';
            el.style.height = bh + 'px';
        }
    }

    function applyZIndexes() {
        for (const [id, frame] of frameElements) {
            const parent = frame.closest('[style*="z-index"]') || frame;
            parent.style.zIndex = String(stackManager.getZIndex(id));
        }
    }

    // --- Window actions ---
    function openWindow(appId, context, parentWindowId) {
        return createWindow(appId, context, parentWindowId).then(data => {
            if (data.window) {
                locallyCreatedIds.add(data.window.id);
                // If the backend auto-grouped, update existing windows' groupId too
                if (data.window.groupId) {
                    for (const w of state.windows) {
                        if (w.id === parentWindowId && !w.groupId) {
                            w.groupId = data.window.groupId;
                            w.groupOrder = 0;
                        }
                    }
                }
                state.windows.push(data.window);
                stackManager.add(data.window.id);
                stackManager.focus(data.window.id);
                renderWindows();
            }
            return data;
        });
    }

    function closeWindow(windowId) {
        return deleteWindow(windowId).then(() => {
            state.windows = state.windows.filter(w => w.id !== windowId);
            stackManager.remove(windowId);
            // Clean up iframe source tracking
            cleanIframeSourceMap(windowId);
            frameElements.delete(windowId);
            preMaxBounds.delete(windowId);
            renderWindows();
            return { ok: true };
        });
    }

    function minimizeWindow(windowId) {
        const w = state.windows.find(w => w.id === windowId);
        if (!w) return;
        w.state = 'minimized';
        updateWindow(windowId, { state: 'minimized' });
        renderWindows();
    }

    function toggleMaximize(windowId) {
        const w = state.windows.find(w => w.id === windowId);
        if (!w) return;

        if (w.state === 'maximized') {
            // Restore
            const saved = preMaxBounds.get(windowId);
            if (saved) {
                w.bounds = JSON.parse(saved);
                preMaxBounds.delete(windowId);
            }
            w.state = 'normal';
            updateWindow(windowId, { state: 'normal', bounds: w.bounds });
        } else {
            // Maximize — save current bounds
            preMaxBounds.set(windowId, JSON.stringify(w.bounds));
            w.state = 'maximized';
            updateWindow(windowId, { state: 'maximized' });
        }
        renderWindows();
    }

    function fetchState() {
        return getState().then(data => {
            state.windows = data.windows || [];
            renderWindows();
        });
    }

    // --- SSE ---
    // Track window IDs that this tab created locally (to avoid SSE double-add)
    const locallyCreatedIds = new Set();

    new SseClient(sseUrl, (event, payload) => {
        switch (event) {
            case 'window.open':
                if (payload && !state.windows.some(w => w.id === payload.id)) {
                    if (locallyCreatedIds.has(payload.id)) {
                        // Already added by openWindow() — skip to avoid duplicate
                        locallyCreatedIds.delete(payload.id);
                        break;
                    }
                    state.windows.push(payload);
                    stackManager.add(payload.id);
                    renderWindows();
                }
                break;
            case 'window.close':
                if (payload) {
                    state.windows = state.windows.filter(w => w.id !== payload.id);
                    stackManager.remove(payload.id);
                    frameElements.delete(payload.id);
                    renderWindows();
                }
                break;
            case 'window.update':
                if (payload && payload.id) {
                    const idx = state.windows.findIndex(w => w.id === payload.id);
                    if (idx !== -1) {
                        state.windows[idx] = { ...state.windows[idx], ...payload };
                        renderWindows();
                    }
                }
                break;
            case 'window.group':
                fetchState();
                break;
            case 'window.ungroup':
                fetchState();
                break;
        }

        // Broadcast to iframes — but don't send window.open to the window
        // that was just opened (it hasn't loaded yet and can't use the event)
        if (event === 'window.open' && payload) {
            messageBus.broadcastToIframes(event, payload, () =>
                getIframeInfos().filter(info => info.windowId !== payload.id)
            );
        } else {
            messageBus.broadcastToIframes(event, payload, getIframeInfos);
        }
    });

    // --- Message Bus ---
    const messageBus = new MessageBus({
        onOpen: openWindow,
        onClose: closeWindow,
        onUpdate(windowId, updates) {
            const w = state.windows.find(w => w.id === windowId);
            if (w) Object.assign(w, updates);
            return updateWindow(windowId, updates);
        },
        getWindowIdForSource(source) {
            // Fast path: persistent source map (survives re-renders)
            const fromMap = iframeSourceMap.get(source);
            if (fromMap) return fromMap;
            // Fallback: scan current frame elements
            for (const [id, frame] of frameElements) {
                const iframe = frame.iframeEl || frame.querySelector('iframe');
                if (iframe && iframe.contentWindow === source) return id;
            }
            return null;
        },
        getIframeWindow(windowId) {
            const frame = frameElements.get(windowId);
            if (!frame) return null;
            const iframe = frame.iframeEl || frame.querySelector('iframe');
            return iframe ? iframe.contentWindow : null;
        },
    });

    function getIframeInfos() {
        const result = [];
        for (const [windowId, frame] of frameElements) {
            const iframe = frame.iframeEl || frame.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                result.push({ windowId, contentWindow: iframe.contentWindow });
            }
        }
        return result;
    }

    // --- Render app launcher ---
    function renderAppLauncher() {
        if (!launcherEl) return;
        launcherEl.innerHTML = '';
        for (const app of apps) {
            const btn = document.createElement('button');
            btn.textContent = app.title;
            btn.className = 'wm-app-launcher__btn';
            btn.addEventListener('click', () => openWindow(app.id, {}));
            launcherEl.appendChild(btn);
        }
    }

    function renderAppBarRight() {
        if (!rightBarEl) return;
        rightBarEl.innerHTML = '';

        if (user && user.id) {
            const userLabel = document.createElement('span');
            userLabel.className = 'wm-app-bar__user';
            userLabel.textContent = user.id;
            rightBarEl.appendChild(userLabel);
        }

        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = 'Logout';
        logoutBtn.className = 'wm-app-bar__logout';
        logoutBtn.addEventListener('click', logout);
        rightBarEl.appendChild(logoutBtn);
    }

    // --- Init ---
    if (desktopIcons) desktopIcons.render(apps);
    renderWindows();
    renderAppLauncher();
    renderAppBarRight();

    // --- Global exports for backward compat ---
    window.__WM_OPEN__ = openWindow;
    window.__WM_APPS__ = apps;
}
