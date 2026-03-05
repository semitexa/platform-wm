/**
 * EventSource wrapper with reconnect and WM channel filtering.
 */

const RECONNECT_DELAY = 3000;
const MAX_RECONNECTS = 10;

export class SseClient {
    constructor(url, onEvent) {
        this._url = url;
        this._onEvent = onEvent;
        this._es = null;
        this._reconnects = 0;
        this._closed = false;
        this.connect();
    }

    connect() {
        if (this._closed) return;
        this._es = new EventSource(this._url);

        this._es.onmessage = (ev) => {
            this._reconnects = 0;
            try {
                const data = JSON.parse(ev.data);
                if (data.channel !== 'wm') return;
                this._onEvent(data.event, data.payload);
            } catch (e) {
                console.warn('[WM] SSE parse error', e);
            }
        };

        this._es.onerror = () => {
            this._es.close();
            if (this._reconnects < MAX_RECONNECTS && !this._closed) {
                this._reconnects++;
                setTimeout(() => this.connect(), RECONNECT_DELAY);
            }
        };
    }

    close() {
        this._closed = true;
        if (this._es) this._es.close();
    }
}
