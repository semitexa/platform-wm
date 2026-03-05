/**
 * Desktop icon grid — renders app shortcuts on the desktop.
 */

export class DesktopIcons {
    /**
     * @param {HTMLElement} container - The #wm-desktop-icons element
     * @param {function(string, object):void} onOpen - Called with (appId, context) when icon clicked
     */
    constructor(container, onOpen) {
        this._container = container;
        this._onOpen = onOpen;
    }

    render(apps) {
        this._container.innerHTML = '';

        for (const app of apps) {
            const btn = document.createElement('button');
            btn.className = 'wm-desktop-icon';
            btn.type = 'button';

            const symbol = document.createElement('span');
            symbol.className = 'wm-desktop-icon__symbol';
            if (app.icon && (app.icon.startsWith('http') || app.icon.startsWith('data:'))) {
                const img = document.createElement('img');
                img.src = app.icon;
                img.alt = app.title;
                img.style.cssText = 'width:40px;height:40px;object-fit:contain;';
                symbol.appendChild(img);
            } else if (app.icon) {
                symbol.textContent = app.icon;
            } else {
                symbol.textContent = (app.title || '?').charAt(0).toUpperCase();
            }

            const label = document.createElement('span');
            label.className = 'wm-desktop-icon__label';
            label.textContent = app.title || app.id;

            btn.appendChild(symbol);
            btn.appendChild(label);
            btn.addEventListener('click', () => this._onOpen(app.id, {}));
            this._container.appendChild(btn);
        }
    }
}
