/**
 * Fetch wrapper with auth redirect for WM API calls.
 */

let apiBase = '/api/platform/wm';

export function configure(base) {
    apiBase = base;
}

export function api(method, path, body) {
    const url = apiBase + path;
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    return fetch(url, opts).then(r => {
        if (r.status === 401) {
            window.location.href = '/platform/login';
            return Promise.reject(new Error('Unauthorized'));
        }
        return r.json();
    });
}

export function updateWindow(id, updates) {
    return api('PATCH', '/windows/' + encodeURIComponent(id), { updates });
}

export function createWindow(appId, context, parentWindowId) {
    const body = { appId, context: context || {} };
    if (parentWindowId) body.parentWindowId = parentWindowId;
    return api('POST', '/windows', body);
}

export function deleteWindow(id) {
    return api('DELETE', '/windows/' + encodeURIComponent(id));
}

export function getState() {
    return api('GET', '/state');
}

export function groupWindows(windowIds) {
    return api('POST', '/windows/group', { windowIds });
}

export function ungroupWindow(id) {
    return api('POST', '/windows/' + encodeURIComponent(id) + '/ungroup');
}

export function logout() {
    fetch('/api/platform/user/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }).then(() => {
        window.location.href = '/platform/login';
    }).catch(() => {
        window.location.href = '/platform/login';
    });
}

export function unlock(password) {
    return fetch('/api/platform/user/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    }).then((r) => {
        if (r.status === 401) {
            return { success: false, unauthorized: true };
        }
        if (!r.ok) {
            return { success: false };
        }
        return r.json().catch(() => ({ success: true }));
    });
}
