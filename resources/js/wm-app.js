/**
 * WM Shell — Main ES module entry point.
 * Orchestrates all window management modules.
 */

import { configure, updateWindow, createWindow, deleteWindow, getState, groupWindows, ungroupWindow, logout, unlock } from './modules/api-client.js';
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
    const desktopEl = document.getElementById('wm-desktop');
    const desktopIconsEl = document.getElementById('wm-desktop-icons');
    const taskbarEl = document.getElementById('wm-taskbar');
    const launcherEl = document.getElementById('wm-app-launcher');
    const rightBarEl = document.getElementById('wm-app-bar-right');
    const uiState = {
        launcherOpen: false,
        showDesktop: false,
        restoreStates: new Map(),
        locked: false,
        unlocking: false,
    };
    let appBarMetaInterval = null;
    const uiRefs = {
        launcherSearch: null,
        launcherList: null,
        launcherToggle: null,
        launcherPanel: null,
        showDesktopBtn: null,
        windowsStat: null,
        clockEl: null,
        lockOverlay: null,
        lockInput: null,
    };

    if (!container) return;

    function normalizeCssUrlValue(rawValue) {
        if (typeof rawValue !== 'string') return '';

        let decoded = rawValue.trim();
        if (decoded === '') return '';

        for (let i = 0; i < 2; i++) {
            try {
                const next = decodeURIComponent(decoded);
                if (next === decoded) break;
                decoded = next;
            } catch (_) {
                break;
            }
        }

        return decoded.trim();
    }

    function applyDesktopBackground(value) {
        if (!desktopEl) return;
        const v = typeof value === 'string' ? value.trim() : '';
        if (v === '') {
            desktopEl.style.removeProperty('background');
            return;
        }

        const lower = v.toLowerCase();
        if (lower.includes('expression(') || lower.includes('javascript:')) {
            console.warn('[WM] Blocked unsafe desktop background value');
            return;
        }

        if (/url\s*\(/i.test(v)) {
            const urls = v.match(/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi) || [];
            for (const u of urls) {
                const inner = normalizeCssUrlValue(u.replace(/url\s*\(\s*['"]?|['"]?\s*\)/gi, ''));
                const normalizedInner = inner.toLowerCase();

                if (normalizedInner.startsWith('//')) {
                    console.warn('[WM] Blocked protocol-relative URL in desktop background:', inner);
                    return;
                }

                if (/^[a-z][a-z0-9+.-]*:/i.test(normalizedInner)) {
                    if (!normalizedInner.startsWith('data:image/')) {
                        console.warn('[WM] Blocked external URL in desktop background:', inner);
                        return;
                    }
                    continue;
                }

                if (!normalizedInner.startsWith('/')) {
                    console.warn('[WM] Blocked non-local URL in desktop background:', inner);
                    return;
                }
            }
        }
        desktopEl.style.background = v;
    }

    function loadDesktopBackgroundSetting() {
        return fetch('/api/platform/settings?scope=user&module_key=platform-wm', { credentials: 'include' })
            .then((r) => {
                if (r.status === 401) {
                    logout();
                    return null;
                }
                if (r.status === 403) {
                    return null;
                }
                if (!r.ok) throw new Error('Failed to load settings');
                return r.json();
            })
            .then((data) => {
                if (!data) return;
                const list = Array.isArray(data.settings) ? data.settings : [];
                const row = list.find((s) => s && s.key === 'desktop_background');
                if (!row) return;
                applyDesktopBackground(row.value);
            })
            .catch((err) => {
                console.debug('[WM] Could not load desktop background setting:', err.message);
            });
    }

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
        },
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
        syncShowDesktopState();
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
            taskbar.render(state.windows, stackManager.getTopWindowId(), apps, activeGroupTabs);
        }
        if (uiRefs.launcherList) {
            renderLauncherList(uiRefs.launcherSearch ? uiRefs.launcherSearch.value : '');
        }
        updateAppBarMeta();
    }

    function syncShowDesktopState() {
        if (!uiState.showDesktop) return;
        if (state.windows.some((w) => w.state !== 'minimized')) {
            uiState.showDesktop = false;
            uiState.restoreStates.clear();
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
            el.style.height = 'calc(100vh - var(--wm-appbar-height, 56px))';
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
            case 'window.minimize':
            case 'window.focus':
                if (payload && payload.id) {
                    const idx = state.windows.findIndex(w => w.id === payload.id);
                    if (idx !== -1) {
                        state.windows[idx] = { ...state.windows[idx], ...payload };
                        if (event === 'window.focus') {
                            stackManager.focus(payload.id);
                        }
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
    function setLauncherOpen(open) {
        uiState.launcherOpen = open;
        if (uiRefs.launcherPanel) {
            uiRefs.launcherPanel.hidden = !open;
        }
        if (uiRefs.launcherToggle) {
            uiRefs.launcherToggle.classList.toggle('active', open);
            uiRefs.launcherToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        if (open && uiRefs.launcherSearch) {
            uiRefs.launcherSearch.focus();
            uiRefs.launcherSearch.select();
        }
    }

    function renderLauncherList(filterText = '') {
        if (!uiRefs.launcherList) return;
        uiRefs.launcherList.innerHTML = '';

        const q = (filterText || '').trim().toLowerCase();
        const filtered = apps.filter((app) => {
            if (q === '') return true;
            return app.title.toLowerCase().includes(q) || app.id.toLowerCase().includes(q);
        });

        // Precompute running counts to avoid O(apps*windows)
        const runningCounts = new Map();
        for (const w of state.windows) {
            runningCounts.set(w.appId, (runningCounts.get(w.appId) || 0) + 1);
        }

        for (const app of filtered) {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'wm-launcher__app';

            const icon = document.createElement('span');
            icon.className = 'wm-launcher__app-icon';
            icon.textContent = app.icon || app.title.charAt(0).toUpperCase();
            item.appendChild(icon);

            const meta = document.createElement('span');
            meta.className = 'wm-launcher__app-meta';

            const title = document.createElement('span');
            title.className = 'wm-launcher__app-title';
            title.textContent = app.title;
            meta.appendChild(title);

            const detail = document.createElement('span');
            detail.className = 'wm-launcher__app-detail';
            const running = runningCounts.get(app.id) || 0;
            detail.textContent = running > 0 ? `${running} running` : app.id;
            meta.appendChild(detail);

            item.appendChild(meta);

            item.addEventListener('click', () => {
                openWindow(app.id, {});
                setLauncherOpen(false);
            });

            uiRefs.launcherList.appendChild(item);
        }

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'wm-launcher__empty';
            empty.textContent = 'No apps found';
            uiRefs.launcherList.appendChild(empty);
        }
    }

    function renderAppLauncher() {
        if (!launcherEl) return;
        launcherEl.innerHTML = '';

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'wm-launcher__toggle';
        toggle.textContent = 'Semitexa';
        toggle.title = 'Open launcher (Ctrl+K)';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.addEventListener('click', () => setLauncherOpen(!uiState.launcherOpen));

        const panel = document.createElement('div');
        panel.className = 'wm-launcher__panel';
        panel.hidden = true;

        const search = document.createElement('input');
        search.className = 'wm-launcher__search';
        search.placeholder = 'Search apps...';
        search.addEventListener('input', () => renderLauncherList(search.value));
        panel.appendChild(search);

        const list = document.createElement('div');
        list.className = 'wm-launcher__list';
        panel.appendChild(list);

        const account = document.createElement('div');
        account.className = 'wm-launcher__account';

        const accountTitle = document.createElement('div');
        accountTitle.className = 'wm-launcher__account-title';
        accountTitle.textContent = user && user.id ? `Account: ${user.id}` : 'Account';
        account.appendChild(accountTitle);

        const accountActions = document.createElement('div');
        accountActions.className = 'wm-launcher__account-actions';

        const lockBtn = document.createElement('button');
        lockBtn.type = 'button';
        lockBtn.className = 'wm-launcher__account-btn';
        lockBtn.textContent = 'Lock Screen';
        lockBtn.addEventListener('click', () => {
            lockScreen();
            setLauncherOpen(false);
        });
        accountActions.appendChild(lockBtn);

        const switchBtn = document.createElement('button');
        switchBtn.type = 'button';
        switchBtn.className = 'wm-launcher__account-btn';
        switchBtn.textContent = 'Switch User';
        switchBtn.addEventListener('click', () => logout());
        accountActions.appendChild(switchBtn);

        const logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.className = 'wm-launcher__account-btn danger';
        logoutBtn.textContent = 'Logout';
        logoutBtn.addEventListener('click', () => logout());
        accountActions.appendChild(logoutBtn);

        account.appendChild(accountActions);
        panel.appendChild(account);

        launcherEl.appendChild(toggle);
        launcherEl.appendChild(panel);

        uiRefs.launcherToggle = toggle;
        uiRefs.launcherPanel = panel;
        uiRefs.launcherSearch = search;
        uiRefs.launcherList = list;

        renderLauncherList();
    }

    // Close launcher on outside click (single listener, not inside renderAppLauncher)
    document.addEventListener('pointerdown', (ev) => {
        if (!uiState.launcherOpen || !launcherEl) return;
        if (!launcherEl.contains(ev.target)) {
            setLauncherOpen(false);
        }
    }, true);

    function toggleShowDesktop() {
        if (!uiState.showDesktop) {
            // Minimize all visible windows, track which ones we minimized
            const visibleWindows = state.windows.filter(w => w.state !== 'minimized');
            if (visibleWindows.length === 0) return;

            uiState.restoreStates.clear();
            for (const w of visibleWindows) {
                uiState.restoreStates.set(w.id, w.state || 'normal');
                w.state = 'minimized';
                updateWindow(w.id, { state: 'minimized' });
            }
            uiState.showDesktop = true;
        } else {
            // Only restore windows that were minimized by Show Desktop
            for (const [id, prevState] of uiState.restoreStates) {
                const w = state.windows.find(w => w.id === id);
                if (w && w.state === 'minimized') {
                    w.state = prevState;
                    updateWindow(w.id, { state: w.state });
                }
            }
            uiState.restoreStates.clear();
            uiState.showDesktop = false;
        }
        renderWindows();
    }

    function getUserLabel() {
        if (!user) return '';
        if (user.name && String(user.name).trim() !== '') return String(user.name);
        if (user.email && String(user.email).trim() !== '') return String(user.email);
        return '';
    }

    function renderAppBarRight() {
        if (!rightBarEl) return;
        rightBarEl.innerHTML = '';

        const windowsStat = document.createElement('span');
        windowsStat.className = 'wm-app-bar__meta';
        rightBarEl.appendChild(windowsStat);
        uiRefs.windowsStat = windowsStat;

        const clock = document.createElement('span');
        clock.className = 'wm-app-bar__clock';
        rightBarEl.appendChild(clock);
        uiRefs.clockEl = clock;

        const showDesktopBtn = document.createElement('button');
        showDesktopBtn.type = 'button';
        showDesktopBtn.className = 'wm-app-bar__utility';
        showDesktopBtn.textContent = 'Show Desktop';
        showDesktopBtn.title = 'Minimize/restore all windows';
        showDesktopBtn.addEventListener('click', toggleShowDesktop);
        rightBarEl.appendChild(showDesktopBtn);
        uiRefs.showDesktopBtn = showDesktopBtn;

        const userLabelText = getUserLabel();
        if (userLabelText !== '') {
            const userLabel = document.createElement('span');
            userLabel.className = 'wm-app-bar__user';
            userLabel.textContent = userLabelText;
            rightBarEl.appendChild(userLabel);
        }

        if (appBarMetaInterval) clearInterval(appBarMetaInterval);
        appBarMetaInterval = setInterval(updateAppBarMeta, 1000);
        updateAppBarMeta();
    }

    function ensureLockOverlay() {
        if (uiRefs.lockOverlay) return;
        if (!desktopEl) return;

        const overlay = document.createElement('div');
        overlay.className = 'wm-lock-overlay';
        overlay.hidden = true;

        const card = document.createElement('div');
        card.className = 'wm-lock-card';

        const title = document.createElement('h2');
        title.className = 'wm-lock-title';
        title.textContent = 'Screen Locked';
        card.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.className = 'wm-lock-subtitle';
        subtitle.textContent = user && user.id ? `User: ${user.id}. Enter current account password.` : 'Enter current account password';
        card.appendChild(subtitle);

        const input = document.createElement('input');
        input.type = 'password';
        input.className = 'wm-lock-input';
        input.placeholder = 'Password';
        card.appendChild(input);

        const actions = document.createElement('div');
        actions.className = 'wm-lock-actions';

        const unlockBtn = document.createElement('button');
        unlockBtn.type = 'button';
        unlockBtn.className = 'wm-lock-btn';
        unlockBtn.textContent = 'Unlock';
        unlockBtn.addEventListener('click', () => tryUnlock());
        actions.appendChild(unlockBtn);

        const switchBtn = document.createElement('button');
        switchBtn.type = 'button';
        switchBtn.className = 'wm-lock-btn secondary';
        switchBtn.textContent = 'Switch User';
        switchBtn.addEventListener('click', () => logout());
        actions.appendChild(switchBtn);

        card.appendChild(actions);
        overlay.appendChild(card);
        desktopEl.appendChild(overlay);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                tryUnlock();
            }
        });

        overlay.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            const focusables = [
                ...overlay.querySelectorAll('input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])')
            ].filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
            if (focusables.length === 0) return;

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;

            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        });

        uiRefs.lockOverlay = overlay;
        uiRefs.lockInput = input;
    }

    function setDesktopInteractivityLocked(locked) {
        if (!desktopEl || !uiRefs.lockOverlay) return;
        for (const child of desktopEl.children) {
            if (child === uiRefs.lockOverlay) continue;
            if (locked) {
                child.setAttribute('inert', '');
                child.setAttribute('aria-hidden', 'true');
            } else {
                child.removeAttribute('inert');
                child.removeAttribute('aria-hidden');
            }
        }
    }

    function setLocked(locked) {
        ensureLockOverlay();
        uiState.locked = locked;
        if (!uiRefs.lockOverlay) return;
        uiRefs.lockOverlay.hidden = !locked;
        setDesktopInteractivityLocked(locked);
        if (uiRefs.lockInput && !locked) {
            uiRefs.lockInput.value = '';
            uiRefs.lockInput.placeholder = 'Password';
        }
        if (locked) {
            setLauncherOpen(false);
            if (uiRefs.lockInput) {
                uiRefs.lockInput.value = '';
                uiRefs.lockInput.placeholder = 'Password';
                uiRefs.lockInput.focus();
            }
        }
    }

    function lockScreen() {
        setLocked(true);
    }

    function tryUnlock() {
        if (!uiRefs.lockInput || uiState.unlocking) return;
        const password = uiRefs.lockInput.value || '';
        if (password.length === 0) {
            uiRefs.lockInput.placeholder = 'Enter password';
            uiRefs.lockInput.focus();
            return;
        }

        uiState.unlocking = true;
        unlock(password)
            .then((result) => {
                if (result && result.success) {
                    setLocked(false);
                    return;
                }
                if (result && result.unauthorized) {
                    logout();
                    return;
                }
                uiRefs.lockInput.value = '';
                if (result && result.networkError) {
                    uiRefs.lockInput.placeholder = 'Network error, try again';
                } else if (result && result.status && result.status >= 500) {
                    uiRefs.lockInput.placeholder = 'Server error, try again later';
                } else {
                    uiRefs.lockInput.placeholder = 'Wrong password';
                }
                uiRefs.lockInput.focus();
            })
            .catch((err) => {
                console.error('[WM] Unlock failed', err);
                uiRefs.lockInput.value = '';
                uiRefs.lockInput.placeholder = 'Unlock failed, try again';
                uiRefs.lockInput.focus();
            })
            .finally(() => {
                uiState.unlocking = false;
            });
    }

    function updateAppBarMeta() {
        if (uiRefs.windowsStat) {
            const openCount = countVisibleWindowWrappers();
            const total = state.windows.length;
            uiRefs.windowsStat.textContent = `${openCount}/${total} visible`;
        }
        if (uiRefs.showDesktopBtn) {
            uiRefs.showDesktopBtn.classList.toggle('active', uiState.showDesktop);
        }
        if (uiRefs.clockEl) {
            const now = new Date();
            uiRefs.clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    function countVisibleWindowWrappers() {
        const groups = tabGroup.getGroups(state.windows);
        const groupedIds = new Set();

        for (const [, members] of groups) {
            for (const member of members) {
                groupedIds.add(member.id);
            }
        }

        let visible = 0;

        for (const window of state.windows) {
            if (groupedIds.has(window.id)) continue;
            if (window.state === 'minimized') continue;
            visible += 1;
        }

        for (const [, members] of groups) {
            if (members.every((member) => member.state === 'minimized')) continue;
            visible += 1;
        }

        return visible;
    }

    // --- Init ---
    if (desktopIcons) desktopIcons.render(apps);
    renderWindows();
    renderAppLauncher();
    renderAppBarRight();
    ensureLockOverlay();
    loadDesktopBackgroundSetting();

    window.addEventListener('keydown', (e) => {
        if (uiState.locked) {
            const target = e.target instanceof Node ? e.target : null;
            if (!uiRefs.lockOverlay || !target || !uiRefs.lockOverlay.contains(target)) {
                e.preventDefault();
            }
            return;
        }
        const key = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && key === 'k') {
            e.preventDefault();
            setLauncherOpen(!uiState.launcherOpen);
            renderLauncherList(uiRefs.launcherSearch ? uiRefs.launcherSearch.value : '');
            return;
        }
        if (e.key === 'Escape' && uiState.launcherOpen) {
            e.preventDefault();
            setLauncherOpen(false);
        }
    });

    // --- Global exports for backward compat ---
    window.__WM_OPEN__ = openWindow;
    window.__WM_APPS__ = apps;
}
