/**
 * WM Shell Bootstrap — thin wrapper that imports the ES module entry point.
 * Loaded via /assets/platform-wm/js/wm-shell.js
 */
(function () {
    'use strict';

    var bootstrap = window.__WM_BOOTSTRAP__;
    if (!bootstrap) {
        console.error('[WM] Missing __WM_BOOTSTRAP__');
        return;
    }

    import('/assets/platform-wm/js/wm-app.js').then(function (mod) {
        mod.init(bootstrap);
    }).catch(function (err) {
        console.error('[WM] Failed to load wm-app module', err);
    });
})();
