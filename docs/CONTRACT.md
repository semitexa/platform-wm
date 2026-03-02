# Semitexa Platform WM — Frozen Contract

This document describes the **versioned, documented, and frozen** contract between the Window Manager core and applications. The core may evolve internally as long as it does not break this contract.

---

## 1. App Registration

### Attribute

Applications register as WM apps using the PHP attribute:

- **Attribute:** `Semitexa\Platform\Wm\Attributes\AsWmApp`
- **Target:** Class (any module)

### Parameters

| Parameter   | Type   | Required | Description                                      |
|------------|--------|----------|--------------------------------------------------|
| `id`       | string | Yes      | Unique app identifier (e.g. `customer`, `order`) |
| `title`    | string | Yes      | Display name (e.g. "Customer", "Orders")         |
| `entryUrl` | string | Yes      | Base URL or path for the app (e.g. `/app/customer`) |
| `icon`     | string | No       | Icon URL or identifier                           |
| `permission` | string | No     | Permission key for future ACL integration        |

### Example

```php
use Semitexa\Platform\Wm\Attributes\AsWmApp;

#[AsWmApp(id: 'customer', title: 'Customer', entryUrl: '/app/customer', icon: null, permission: null)]
final class CustomerWmApp {}
```

### Entry URL and context

When the shell opens a window, it builds the iframe `src` from `entryUrl` and the window `context`. Context is passed as query parameters. Example: `entryUrl = '/app/customer'`, `context = { id: 42 }` → `/app/customer?id=42`.

---

## 2. SSE Event Format

The WM uses the **same SSE endpoint** as the rest of the platform (`/sse` or `/__semitexa_sse`). WM events are distinguished by a `channel` field.

### Message shape

```json
{
  "channel": "wm",
  "event": "<event-name>",
  "payload": { ... }
}
```

### Events

| Event           | When                    | Payload (window object)                          |
|-----------------|-------------------------|--------------------------------------------------|
| `window.open`   | A new window is opened  | `{ id, appId, context, title, order }`           |
| `window.close`  | A window is closed      | Same window object                               |
| `window.minimize` | Window minimized (MVP: optional) | Same window object            |
| `window.focus`  | Window focused (MVP: optional)   | Same window object            |

The client (WM shell) MUST ignore messages where `channel !== 'wm'`.

---

## 3. API Endpoints

Base path: `/api/platform/wm`. All endpoints are relative to this base.

| Method | Path             | Description |
|--------|------------------|-------------|
| GET    | `/apps`          | List registered apps. Response: `{ "apps": [ { id, title, entryUrl, icon, permission } ] }` |
| GET    | `/state`         | Current window state for the session. Response: `{ "windows": [ { id, appId, context, title, order } ] }` |
| POST   | `/windows`       | Open a window. Body: `{ "appId": string, "context"?: object }`. Response: `{ "window": { id, appId, context, title, order } }`. Emits SSE `window.open`. |
| PATCH  | `/windows/:id`   | Update window (e.g. position, minimized). Body: `{ ...updates }`. Response: `{ "window": { ... } }`. |
| DELETE | `/windows/:id`   | Close window. Response: `{ "ok": true }`. Emits SSE `window.close`. |

- `id` in path MUST match `[a-zA-Z0-9_]+`.
- Session is identified by the standard session cookie; no separate auth in MVP.

---

## 4. postMessage — Shell ↔ iframe

All communication between the WM shell and app iframes goes through `postMessage`. Apps MUST use the following contract.

### iframe → shell (app requests)

| `action`       | Payload              | Description |
|----------------|----------------------|-------------|
| `wm.open`      | `{ appId, context? }` | Open another app in a new window. Example: `{ action: 'wm.open', appId: 'customer', context: { id: 42 } }`. |
| `wm.closeSelf` | —                    | Request to close the current window. Shell will call DELETE `/windows/:id` and remove the window. |

### shell → iframe (lifecycle, optional)

The shell MAY send messages to the iframe for lifecycle (e.g. focus, blur, close). Format and list to be extended in a later version; MVP may omit these.

### Target origin

Apps MUST use `window.parent.postMessage(..., '*')` or the actual origin of the shell for security. The shell MUST validate `ev.origin` when handling messages in production.

---

## 5. Versioning

- This contract is **v1** for the WM MVP.
- Changes that add optional fields or new events are backward-compatible.
- Breaking changes (removing or renaming fields, changing semantics) require a new contract version and MUST be documented.

---

*Semitexa Platform WM · Update without fear.*
