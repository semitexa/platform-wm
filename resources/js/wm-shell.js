(function () {
    'use strict';

    var bootstrap = window.__WM_BOOTSTRAP__;
    if (!bootstrap) {
        console.error('[WM] Missing __WM_BOOTSTRAP__');
        return;
    }

    var apiBase = bootstrap.apiBase || '/api/platform/wm';
    var sseUrl = (bootstrap.sseUrl || '/sse') + '?session_id=' + encodeURIComponent(bootstrap.sessionId || '');
    var apps = bootstrap.apps || [];
    var windows = bootstrap.windows || [];

    var user = bootstrap.user || null;

    function api(method, path, body) {
        var url = apiBase + path;
        var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
        if (body && method !== 'GET') opts.body = JSON.stringify(body);
        return fetch(url, opts).then(function (r) {
            if (r.status === 401) {
                window.location.href = '/platform/login';
                return Promise.reject(new Error('Unauthorized'));
            }
            return r.json();
        });
    }

    function logout() {
        fetch('/api/platform/user/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }).then(function () {
            window.location.href = '/platform/login';
        }).catch(function () {
            window.location.href = '/platform/login';
        });
    }

    var state = { windows: windows.slice() };

    function buildAppUrl(app, context) {
        var url = app.entryUrl || '/';
        if (context && Object.keys(context).length) {
            var q = Object.keys(context).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(context[k]); }).join('&');
            url += (url.indexOf('?') !== -1 ? '&' : '?') + q;
        }
        return url;
    }

    customElements.define('wm-window-frame', class extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this._windowId = '';
            this._app = null;
            this._context = {};
        }

        setWindow(data) {
            this._windowId = data.id;
            this._app = apps.find(function (a) { return a.id === data.appId; }) || { entryUrl: '/', title: data.title };
            this._context = data.context || {};
            this._render();
        }

        _render() {
            var title = (this._app && this._app.title) || this._windowId;
            var src = buildAppUrl(this._app, this._context);
            this.shadowRoot.innerHTML =
                '<style>:host{display:block;position:absolute;background:#313244;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.3);overflow:hidden;flex-direction:column;min-width:200px;min-height:120px;}.titlebar{display:flex;align-items:center;padding:6px 10px;background:#45475a;cursor:move;user-select:none;}.title{flex:1;font-size:13px;}.btn{width:28px;height:24px;margin-left:4px;border:none;border-radius:4px;background:transparent;color:#cdd6f4;cursor:pointer;font-size:14px;}.btn:hover{background:#585b70;}.btn.close:hover{background:#f38ba8;}.content{flex:1;min-height:0;}.content iframe{width:100%;height:100%;border:none;display:block;}</style>' +
                '<div class="titlebar">' +
                '<span class="title">' + escapeHtml(title) + '</span>' +
                '<button class="btn minimize" data-action="minimize">−</button>' +
                '<button class="btn close" data-action="close">×</button>' +
                '</div>' +
                '<div class="content"><iframe src="' + escapeHtml(src) + '" data-window-id="' + escapeHtml(this._windowId) + '"></iframe></div>';
            var self = this;
            this.shadowRoot.querySelectorAll('.btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var a = btn.getAttribute('data-action');
                    if (a === 'close') self.dispatchEvent(new CustomEvent('wm-close', { detail: { windowId: self._windowId }, bubbles: true }));
                    if (a === 'minimize') self.dispatchEvent(new CustomEvent('wm-minimize', { detail: { windowId: self._windowId }, bubbles: true }));
                });
            });
        }

        get windowId() { return this._windowId; }
    });

    function escapeHtml(s) {
        if (!s) return '';
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    var container = document.getElementById('wm-windows');
    if (!container) return;

    function renderWindows() {
        container.innerHTML = '';
        state.windows.forEach(function (w, i) {
            var app = apps.find(function (a) { return a.id === w.appId; }) || { entryUrl: '/', title: w.title };
            var frame = document.createElement('wm-window-frame');
            frame.setWindow(w);
            frame.style.left = (20 + (i % 4) * 30) + 'px';
            frame.style.top = (20 + (i % 3) * 25) + 'px';
            frame.style.width = '400px';
            frame.style.height = '300px';
            frame.style.zIndex = String(10 + i);
            frame.addEventListener('wm-close', function (e) {
                api('DELETE', '/windows/' + encodeURIComponent(e.detail.windowId)).then(function () { fetchState(); });
            });
            frame.addEventListener('wm-minimize', function () { /* MVP: no minimize UI */ });
            container.appendChild(frame);
        });
    }

    function fetchState() {
        return api('GET', '/state').then(function (data) {
            state.windows = data.windows || [];
            renderWindows();
        });
    }

    function openWindow(appId, context) {
        return api('POST', '/windows', { appId: appId, context: context || {} }).then(function (data) {
            if (data.window) state.windows.push(data.window);
            renderWindows();
        });
    }

    if (typeof EventSource !== 'undefined') {
        var es = new EventSource(sseUrl);
        es.onmessage = function (ev) {
            try {
                var data = JSON.parse(ev.data);
                if (data.channel !== 'wm') return;
                if (data.event === 'window.open' && data.payload) {
                    var exists = state.windows.some(function (w) { return w.id === data.payload.id; });
                    if (!exists) state.windows.push(data.payload);
                    renderWindows();
                }
                if (data.event === 'window.close' && data.payload) {
                    state.windows = state.windows.filter(function (w) { return w.id !== data.payload.id; });
                    renderWindows();
                }
            } catch (e) { console.warn('[WM] SSE parse error', e); }
        };
        es.onerror = function () { es.close(); };
    }

    window.addEventListener('message', function (ev) {
        if (!ev.data || typeof ev.data !== 'object') return;
        var a = ev.data.action;
        if (a === 'wm.open' && ev.data.appId) openWindow(ev.data.appId, ev.data.context || {});
        if (a === 'wm.closeSelf') {
            var iframe = ev.source && ev.source.frameElement;
            var windowId = iframe && (iframe.getAttribute('data-window-id') || (iframe.dataset && iframe.dataset.windowId));
            if (windowId) api('DELETE', '/windows/' + encodeURIComponent(windowId)).then(fetchState);
        }
    });

    function renderAppBar() {
        var bar = document.getElementById('wm-app-bar');
        if (!bar) return;
        bar.innerHTML = '';
        var label = document.createElement('span');
        label.style.cssText = 'font-size:12px;color:#a6adc8;align-self:center;margin-right:8px;';
        label.textContent = 'Apps:';
        bar.appendChild(label);
        apps.forEach(function (app) {
            var btn = document.createElement('button');
            btn.textContent = app.title;
            btn.style.cssText = 'padding:6px 12px;border-radius:6px;border:none;background:#45475a;color:#cdd6f4;cursor:pointer;font-size:13px;';
            btn.onclick = function () { openWindow(app.id, {}); };
            bar.appendChild(btn);
        });

        // Spacer pushes user/logout to the right
        var spacer = document.createElement('span');
        spacer.style.cssText = 'flex:1;';
        bar.appendChild(spacer);

        if (user && user.id) {
            var userLabel = document.createElement('span');
            userLabel.style.cssText = 'font-size:12px;color:#a6adc8;align-self:center;margin-right:8px;';
            userLabel.textContent = user.id;
            bar.appendChild(userLabel);
        }

        var logoutBtn = document.createElement('button');
        logoutBtn.textContent = 'Logout';
        logoutBtn.style.cssText = 'padding:6px 12px;border-radius:6px;border:none;background:#f38ba8;color:#1e1e2e;cursor:pointer;font-size:13px;font-weight:600;';
        logoutBtn.onclick = logout;
        bar.appendChild(logoutBtn);
    }

    renderWindows();
    renderAppBar();
    window.__WM_OPEN__ = openWindow;
    window.__WM_APPS__ = apps;
})();
