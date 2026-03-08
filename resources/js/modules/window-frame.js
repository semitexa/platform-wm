/**
 * <wm-window-frame> Web Component — Shadow DOM window widget.
 */

function escapeHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

export function defineWindowFrame(apps, buildAppUrl) {
    if (customElements.get('wm-window-frame')) return;

    customElements.define('wm-window-frame', class extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
            this._windowId = '';
            this._app = null;
            this._context = {};
            this._title = '';
        }

        setWindow(data) {
            this._windowId = data.id;
            this._app = apps.find(a => a.id === data.appId) || { entryUrl: '/', title: data.title };
            this._context = data.context || {};
            this._title = data.title || (this._app && this._app.title) || this._windowId;
            this._render();
        }

        _render() {
            const title = this._title;
            const src = buildAppUrl(this._app, this._context, this._windowId);
            this.shadowRoot.innerHTML =
                '<link rel="stylesheet" href="/assets/platform-wm/css/window-frame.css">' +
                '<div class="titlebar">' +
                '<span class="title">' + escapeHtml(title) + '</span>' +
                '<button class="btn minimize" data-action="minimize" title="Minimize">\u2212</button>' +
                '<button class="btn maximize" data-action="maximize" title="Maximize">\u25a1</button>' +
                '<button class="btn close" data-action="close" title="Close">\u00d7</button>' +
                '</div>' +
                '<div class="content"><iframe src="' + escapeHtml(src) + '" data-window-id="' + escapeHtml(this._windowId) + '"></iframe></div>' +
                '<slot></slot>';

            const self = this;
            this.shadowRoot.querySelectorAll('.btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const a = btn.getAttribute('data-action');
                    if (a === 'close') self.dispatchEvent(new CustomEvent('wm-close', { detail: { windowId: self._windowId }, bubbles: true }));
                    if (a === 'minimize') self.dispatchEvent(new CustomEvent('wm-minimize', { detail: { windowId: self._windowId }, bubbles: true }));
                    if (a === 'maximize') self.dispatchEvent(new CustomEvent('wm-maximize', { detail: { windowId: self._windowId }, bubbles: true }));
                });
            });
        }

        /** Get the titlebar element for DragManager attachment */
        get titlebarEl() {
            return this.shadowRoot.querySelector('.titlebar');
        }

        /** Get the iframe element */
        get iframeEl() {
            return this.shadowRoot.querySelector('iframe');
        }

        /** Hide the built-in titlebar (used when grouped — shared control bar is shown instead) */
        hideTitlebar() {
            const tb = this.shadowRoot.querySelector('.titlebar');
            if (tb) tb.style.display = 'none';
            const content = this.shadowRoot.querySelector('.content');
            if (content) content.style.borderRadius = '0 0 8px 8px';
        }

        /** Update the displayed title */
        setTitle(title) {
            this._title = title;
            const el = this.shadowRoot.querySelector('.title');
            if (el) el.textContent = title;
        }

        get windowId() { return this._windowId; }
    });
}
