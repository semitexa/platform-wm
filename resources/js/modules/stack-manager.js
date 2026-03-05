/**
 * Z-index ordering for windows. Last in array = top.
 */

const BASE_Z = 10;

export class StackManager {
    constructor() {
        /** @type {string[]} */
        this._stack = [];
    }

    /** Initialize from window state (sorted by order) */
    init(windows) {
        this._stack = windows
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(w => w.id);
    }

    /** Bring window to front */
    focus(id) {
        const idx = this._stack.indexOf(id);
        if (idx !== -1) this._stack.splice(idx, 1);
        this._stack.push(id);
    }

    /** Add window to top */
    add(id) {
        if (this._stack.indexOf(id) === -1) {
            this._stack.push(id);
        }
    }

    /** Remove window from stack */
    remove(id) {
        const idx = this._stack.indexOf(id);
        if (idx !== -1) this._stack.splice(idx, 1);
    }

    /** Get z-index for a window */
    getZIndex(id) {
        const idx = this._stack.indexOf(id);
        return idx === -1 ? BASE_Z : BASE_Z + idx;
    }

    /** Get the topmost window ID */
    getTopWindowId() {
        return this._stack.length > 0 ? this._stack[this._stack.length - 1] : null;
    }

    /** Get the full ordered stack */
    getStack() {
        return this._stack.slice();
    }
}
