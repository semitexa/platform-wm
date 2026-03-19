/**
 * Pointer-based window drag on titlebar.
 * Disables pointer events on all iframes during drag.
 */

export class DragManager {
    constructor() {
        this._active = null; // { target, startX, startY, origX, origY, onEnd }
        this._overlay = null;
        this._onMove = this._handleMove.bind(this);
        this._onUp = this._handleUp.bind(this);
    }

    /**
     * Attach drag behavior to a handle element that moves a target element.
     * @param {HTMLElement} handle - The element to listen on (titlebar)
     * @param {HTMLElement} target - The element to move (window frame host)
     * @param {object} opts
     * @param {function({x,y}):void} opts.onEnd - Called with final position
     * @param {function():void} [opts.onStart] - Called when drag starts
     */
    attach(handle, target, opts = {}) {
        handle.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            // Don't start drag if clicking a button
            if (e.target.closest('button')) return;

            e.preventDefault();
            this._startDrag(target, e.clientX, e.clientY, opts);
        });
    }

    _startDrag(target, clientX, clientY, opts) {
        const rect = target.getBoundingClientRect();
        this._active = {
            target,
            startX: clientX,
            startY: clientY,
            origX: rect.left,
            origY: rect.top,
            onEnd: opts.onEnd || (() => {}),
        };

        if (opts.onStart) opts.onStart();

        // Create overlay to prevent iframes from stealing pointer events
        this._overlay = document.createElement('div');
        this._overlay.className = 'wm-interaction-overlay';
        this._overlay.style.cursor = 'move';
        document.body.appendChild(this._overlay);

        document.addEventListener('pointermove', this._onMove);
        document.addEventListener('pointerup', this._onUp);
    }

    _handleMove(e) {
        if (!this._active) return;
        const dx = e.clientX - this._active.startX;
        const dy = e.clientY - this._active.startY;
        let x = this._active.origX + dx;
        let y = this._active.origY + dy;

        // Boundary clamping: keep at least 40px of titlebar visible
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const tw = this._active.target.offsetWidth;
        x = Math.max(-tw + 40, Math.min(x, vw - 40));
        y = Math.max(0, Math.min(y, vh - 40));

        this._active.target.style.left = x + 'px';
        this._active.target.style.top = y + 'px';
    }

    _handleUp(e) {
        if (!this._active) return;
        document.removeEventListener('pointermove', this._onMove);
        document.removeEventListener('pointerup', this._onUp);

        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }

        const x = parseInt(this._active.target.style.left) || 0;
        const y = parseInt(this._active.target.style.top) || 0;
        this._active.onEnd({ x, y });
        this._active = null;
    }

    /** Check if a drag is currently in progress */
    get isDragging() {
        return this._active !== null;
    }

    /** Get the current drag target element */
    get dragTarget() {
        return this._active ? this._active.target : null;
    }
}
