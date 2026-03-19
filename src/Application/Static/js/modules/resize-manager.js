/**
 * 8-handle resize with pointer capture.
 * Injects resize handles around window border.
 */

const MIN_WIDTH = 200;
const MIN_HEIGHT = 120;

const HANDLES = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];

export class ResizeManager {
    constructor() {
        this._active = null;
        this._overlay = null;
        this._onMove = this._handleMove.bind(this);
        this._onUp = this._handleUp.bind(this);
    }

    /**
     * Inject resize handles into a window frame element.
     * @param {HTMLElement} target - The window frame host element
     * @param {object} opts
     * @param {function({x,y,w,h}):void} opts.onEnd - Called with final bounds
     */
    attach(target, opts = {}) {
        for (const dir of HANDLES) {
            const handle = document.createElement('div');
            handle.className = 'wm-resize-handle ' + dir;
            handle.dataset.direction = dir;
            target.appendChild(handle);

            handle.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                this._startResize(target, dir, e.clientX, e.clientY, opts);
            });
        }
    }

    _startResize(target, direction, clientX, clientY, opts) {
        const rect = target.getBoundingClientRect();
        this._active = {
            target,
            direction,
            startX: clientX,
            startY: clientY,
            origX: rect.left,
            origY: rect.top,
            origW: rect.width,
            origH: rect.height,
            onEnd: opts.onEnd || (() => {}),
        };

        this._overlay = document.createElement('div');
        this._overlay.className = 'wm-interaction-overlay';
        const cursors = { n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize', nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize' };
        this._overlay.style.cursor = cursors[direction] || 'se-resize';
        document.body.appendChild(this._overlay);

        document.addEventListener('pointermove', this._onMove);
        document.addEventListener('pointerup', this._onUp);
    }

    _handleMove(e) {
        if (!this._active) return;
        const a = this._active;
        const dx = e.clientX - a.startX;
        const dy = e.clientY - a.startY;
        const dir = a.direction;

        let x = a.origX, y = a.origY, w = a.origW, h = a.origH;

        if (dir.includes('e')) w = Math.max(MIN_WIDTH, a.origW + dx);
        if (dir.includes('w')) { w = Math.max(MIN_WIDTH, a.origW - dx); x = a.origX + a.origW - w; }
        if (dir.includes('s')) h = Math.max(MIN_HEIGHT, a.origH + dy);
        if (dir.includes('n')) { h = Math.max(MIN_HEIGHT, a.origH - dy); y = a.origY + a.origH - h; }

        a.target.style.left = x + 'px';
        a.target.style.top = y + 'px';
        a.target.style.width = w + 'px';
        a.target.style.height = h + 'px';
    }

    _handleUp() {
        if (!this._active) return;
        document.removeEventListener('pointermove', this._onMove);
        document.removeEventListener('pointerup', this._onUp);

        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }

        const t = this._active.target;
        const bounds = {
            x: parseInt(t.style.left) || 0,
            y: parseInt(t.style.top) || 0,
            w: parseInt(t.style.width) || MIN_WIDTH,
            h: parseInt(t.style.height) || MIN_HEIGHT,
        };
        this._active.onEnd(bounds);
        this._active = null;
    }

    get isResizing() {
        return this._active !== null;
    }
}
