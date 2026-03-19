/**
 * Semitexa WM SDK — for use inside iframe apps.
 *
 * Works as <script> (exposes window.SemitexaWM) and via import().
 *
 * Usage:
 *   <script src="/assets/platform-wm/js/wm-sdk.js"></script>
 *   const wm = SemitexaWM.init();
 *   await wm.open('my-app', { key: 'value' });
 *   await wm.closeSelf();
 */

(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.SemitexaWM = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var REQUEST_TIMEOUT = 10000;
    var _requestId = 0;
    var _pending = {};
    var _listeners = {};
    var _origin = '*';
    var _windowId = null;
    var _initialized = false;

    function _generateId() {
        return 'wmReq_' + (++_requestId) + '_' + Math.random().toString(36).substr(2, 6);
    }

    function _detectWindowId() {
        // From URL param
        var params = new URLSearchParams(window.location.search);
        var fromUrl = params.get('_wmWindowId');
        if (fromUrl) return fromUrl;

        // From frameElement (same-origin only)
        try {
            if (window.frameElement && window.frameElement.dataset.windowId) {
                return window.frameElement.dataset.windowId;
            }
        } catch (e) {
            // Cross-origin, ignore
        }

        return null;
    }

    function _sendRequest(action, data) {
        var id = _generateId();
        var msg = Object.assign({ _wmRequestId: id, action: action }, data || {});
        if (_windowId) msg.windowId = _windowId;

        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () {
                delete _pending[id];
                reject(new Error('WM request timed out: ' + action));
            }, REQUEST_TIMEOUT);

            _pending[id] = function (result) {
                clearTimeout(timer);
                if (result && result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve(result);
                }
            };

            window.parent.postMessage(msg, _origin);
        });
    }

    // Listen for responses and events from the shell
    window.addEventListener('message', function (ev) {
        if (!ev.data || typeof ev.data !== 'object') return;

        // Response to a request
        if (ev.data._wmResponseId && _pending[ev.data._wmResponseId]) {
            _pending[ev.data._wmResponseId](ev.data.result);
            delete _pending[ev.data._wmResponseId];
            return;
        }

        // Event from shell
        if (ev.data._wmEvent) {
            var eventName = ev.data._wmEvent;
            var handlers = _listeners[eventName];
            if (handlers) {
                var payload = ev.data.payload || ev.data;
                for (var i = 0; i < handlers.length; i++) {
                    try { handlers[i](payload); } catch (e) { console.error('[WM SDK] Event handler error', e); }
                }
            }
        }
    });

    var SDK = {
        /**
         * Initialize the SDK.
         * @param {object} [opts]
         * @param {string} [opts.origin] - Expected parent origin (default: '*')
         * @returns {object} The SDK instance
         */
        init: function (opts) {
            opts = opts || {};
            if (opts.origin) _origin = opts.origin;
            _windowId = _detectWindowId();
            _initialized = true;
            return SDK;
        },

        /**
         * Open a new window.
         * @param {string} appId
         * @param {object} [context]
         * @returns {Promise<object>} The created window
         */
        open: function (appId, context) {
            return _sendRequest('wm.open', { appId: appId, context: context || {} });
        },

        /**
         * Close the current window.
         * @returns {Promise<object>}
         */
        closeSelf: function () {
            return _sendRequest('wm.closeSelf');
        },

        /**
         * Update the current window's properties.
         * @param {object} updates
         * @returns {Promise<object>}
         */
        updateSelf: function (updates) {
            return _sendRequest('wm.updateSelf', { updates: updates });
        },

        /**
         * Set the title of the current window.
         * @param {string} title
         * @returns {Promise<object>}
         */
        setTitle: function (title) {
            return _sendRequest('wm.setTitle', { title: title });
        },

        /**
         * Get the current window's ID.
         * @returns {string|null}
         */
        getWindowId: function () {
            if (!_windowId) _windowId = _detectWindowId();
            return _windowId;
        },

        /**
         * Listen for WM events.
         * @param {string} event - Event name (e.g., 'window.update', 'message')
         * @param {function} callback
         * @returns {function} Unsubscribe function
         */
        on: function (event, callback) {
            if (!_listeners[event]) _listeners[event] = [];
            _listeners[event].push(callback);
            return function () {
                _listeners[event] = _listeners[event].filter(function (cb) { return cb !== callback; });
            };
        },

        /**
         * Send a message to another window.
         * @param {string} windowId - Target window ID
         * @param {*} payload - Message payload
         * @returns {Promise<object>}
         */
        send: function (windowId, payload) {
            return _sendRequest('wm.send', { targetWindowId: windowId, payload: payload });
        },
    };

    return SDK;
}));
