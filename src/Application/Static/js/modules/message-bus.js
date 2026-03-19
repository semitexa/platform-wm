/**
 * postMessage handler — legacy protocol + SDK protocol with correlation IDs.
 */

export class MessageBus {
    /**
     * @param {object} opts
     * @param {function(string, object):Promise} opts.onOpen - Open a window
     * @param {function(string):Promise} opts.onClose - Close a window
     * @param {function(string, object):Promise} opts.onUpdate - Update a window
     * @param {function(string):string|null} opts.getWindowIdForSource - Get windowId for an iframe's contentWindow
     * @param {function(string):Window|null} opts.getIframeWindow - Get iframe contentWindow by windowId
     */
    constructor(opts = {}) {
        this._onOpen = opts.onOpen || (() => Promise.resolve());
        this._onClose = opts.onClose || (() => Promise.resolve());
        this._onUpdate = opts.onUpdate || (() => Promise.resolve());
        this._getWindowIdForSource = opts.getWindowIdForSource || (() => null);
        this._getIframeWindow = opts.getIframeWindow || (() => null);

        window.addEventListener('message', (ev) => this._handleMessage(ev));
    }

    async _handleMessage(ev) {
        if (!ev.data || typeof ev.data !== 'object') return;
        const data = ev.data;

        // SDK protocol (has correlation ID)
        if (data._wmRequestId) {
            await this._handleSdkRequest(ev, data);
            return;
        }

        // Legacy protocol
        const a = data.action;
        if (a === 'wm.open' && data.appId) {
            const parentWindowId = this._resolveWindowId(ev);
            this._onOpen(data.appId, data.context || {}, parentWindowId, data);
        }
        if (a === 'wm.closeSelf') {
            const windowId = this._resolveWindowId(ev);
            if (windowId) this._onClose(windowId);
        }
    }

    async _handleSdkRequest(ev, data) {
        const requestId = data._wmRequestId;
        const action = data.action;
        let result;

        try {
            switch (action) {
                case 'wm.open': {
                    const parentWindowId = this._resolveWindowId(ev);
                    result = await this._onOpen(data.appId, data.context || {}, parentWindowId, data);
                    break;
                }
                case 'wm.closeSelf': {
                    const windowId = this._resolveWindowId(ev) || data.windowId;
                    if (windowId) result = await this._onClose(windowId);
                    else result = { error: 'Could not determine window ID' };
                    break;
                }
                case 'wm.updateSelf': {
                    const windowId = this._resolveWindowId(ev) || data.windowId;
                    if (windowId) result = await this._onUpdate(windowId, data.updates || {});
                    else result = { error: 'Could not determine window ID' };
                    break;
                }
                case 'wm.setTitle': {
                    const windowId = this._resolveWindowId(ev) || data.windowId;
                    if (windowId) result = await this._onUpdate(windowId, { title: data.title });
                    else result = { error: 'Could not determine window ID' };
                    break;
                }
                case 'wm.send': {
                    const targetWindow = this._getIframeWindow(data.targetWindowId);
                    if (targetWindow) {
                        targetWindow.postMessage({ _wmEvent: 'message', from: data.windowId, payload: data.payload }, '*');
                        result = { ok: true };
                    } else {
                        result = { error: 'Target window not found' };
                    }
                    break;
                }
                default:
                    result = { error: 'Unknown action: ' + action };
            }
        } catch (e) {
            result = { error: e.message };
        }

        // Respond via postMessage back to the requester
        if (ev.source) {
            ev.source.postMessage({ _wmResponseId: requestId, result }, '*');
        }
    }

    _resolveWindowId(ev) {
        // Try to find which iframe sent this message
        return this._getWindowIdForSource(ev.source);
    }

    /**
     * Forward SSE events to all iframes.
     * @param {string} event - Event name
     * @param {object} payload - Event payload
     * @param {function():Array<{windowId:string, contentWindow:Window}>} getIframes
     */
    broadcastToIframes(event, payload, getIframes) {
        const iframes = getIframes();
        for (const { contentWindow } of iframes) {
            if (contentWindow) {
                contentWindow.postMessage({ _wmEvent: event, payload }, '*');
            }
        }
    }
}
