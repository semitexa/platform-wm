# Semitexa Platform WM — Frozen Contract

This document describes the **versioned, documented, and frozen** contract between the Window Manager core and applications. The core may evolve internally as long as it does not break this contract.

---

## 1. App Registration

### Attribute

Applications register as WM apps using the PHP attribute:

- **Attribute:** `Semitexa\Platform\Wm\Application\Attribute\AsWmApp`
- **Target:** Class (any module)

### Parameters

| Parameter    | Type    | Required | Default | Description                                      |
|-------------|---------|----------|---------|--------------------------------------------------|
| `id`        | string  | Yes      | —       | Unique app identifier (e.g. `customer`, `order`) |
| `title`     | string  | Yes      | —       | Display name (e.g. "Customer", "Orders")         |
| `entryUrl`  | string  | Yes      | —       | Base URL or path for the app (e.g. `/app/customer`) |
| `icon`      | ?string | No       | `null`  | Icon URL or identifier                           |
| `permission`| ?string | No       | `null`  | Permission key for ACL integration               |
| `desktop`   | bool    | No       | `true`  | Whether to show the app on the desktop           |

### Example

```php
use Semitexa\Platform\Wm\Application\Attribute\AsWmApp;

#[AsWmApp(id: 'customer', title: 'Customer', entryUrl: '/app/customer', icon: null, permission: null, desktop: true)]
final class CustomerWmApp {}
```

### Entry URL and context

When the shell opens a window, it builds the iframe `src` from `entryUrl` and the window `context`. Context is passed as query parameters. Additionally, the shell injects `_wmWindowId=<windowId>` as a query parameter so the SDK can auto-detect the window ID.

Example: `entryUrl = '/app/customer'`, `context = { id: 42 }`, `windowId = 'wm_a1b2c3d4e5f6g7h8'` → `/app/customer?id=42&_wmWindowId=wm_a1b2c3d4e5f6g7h8`.

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

### Window object

All events that carry a window object use the full shape:

```json
{
  "id": "wm_<16-char-hex>",
  "appId": "string",
  "context": {},
  "title": "string",
  "order": 1,
  "bounds": { "x": 50, "y": 50, "w": 800, "h": 600 },
  "state": "normal",
  "groupId": null,
  "groupOrder": 0
}
```

### Events

| Event             | When                           | Payload                                                  |
|-------------------|--------------------------------|----------------------------------------------------------|
| `window.open`     | A new window is opened         | Full window object                                       |
| `window.close`    | A window is closed             | Full window object                                       |
| `window.minimize` | Window minimized               | Full window object                                       |
| `window.focus`    | Window focused                 | Full window object                                       |
| `window.update`   | Window properties changed      | Full window object (with updated fields)                 |
| `window.group`    | Windows grouped together       | `{ "groupId": "grp_...", "windowIds": ["wm_...", ...] }` |
| `window.ungroup`  | Window removed from group      | `{ "windowId": "wm_...", "dissolvedGroupId": "grp_..." \| null }` |

The client (WM shell) MUST ignore messages where `channel !== 'wm'`.

---

## 3. API Endpoints

Base path: `/api/platform/wm`. All endpoints are relative to this base. All endpoints require session authentication.

### List Apps

**`GET /apps`**

Response:
```json
{ "apps": [{ "id": "string", "title": "string", "entryUrl": "string", "icon": "string|null", "permission": "string|null", "desktop": true }] }
```

### Get Window State

**`GET /state`**

Returns current window state for the session.

Response:
```json
{ "windows": [{ "id": "wm_...", "appId": "string", "context": {}, "title": "string", "order": 1, "bounds": { "x": 50, "y": 50, "w": 800, "h": 600 }, "state": "normal", "groupId": null, "groupOrder": 0 }] }
```

### Open Window

**`POST /windows`**

Body:
```json
{
  "appId": "string",
  "context": {},
  "parentWindowId": "string|null"
}
```

| Field            | Type    | Required | Description                                              |
|-----------------|---------|----------|----------------------------------------------------------|
| `appId`         | string  | Yes      | App identifier (must be non-empty)                       |
| `context`       | object  | No       | Context data passed as query params to the entry URL     |
| `parentWindowId`| ?string | No       | If set, auto-groups the new window with the parent       |

Response: `{ "window": { ... } }` (full window object). Emits SSE `window.open`.

### Update Window

**`PATCH /windows/{id}`**

`id` in path MUST match `[a-zA-Z0-9_]+`.

Body:
```json
{
  "updates": {
    "bounds": { "x": 100, "y": 100, "w": 800, "h": 600 },
    "state": "normal",
    "order": 5,
    "title": "New Title",
    "groupId": "grp_..."
  }
}
```

| Update field | Type   | Constraints                                          |
|-------------|--------|------------------------------------------------------|
| `bounds`    | object | `w` >= 200, `h` >= 120, all values must be numeric  |
| `state`     | string | Must be one of: `normal`, `minimized`, `maximized`   |
| `order`     | int    | Z-index stacking order                               |
| `title`     | string | New window title                                     |
| `groupId`   | ?string| Group identifier or `null` to ungroup                |

All fields in `updates` are optional — only include the fields you want to change.

Response: `{ "window": { ... } }` (full window object). Emits SSE `window.update`.

Errors:
- `400` — Invalid update key, bounds validation failure, or invalid state
- `404` — Window not found

### Close Window

**`DELETE /windows/{id}`**

`id` in path MUST match `[a-zA-Z0-9_]+`.

Response: `{ "ok": true }`. Emits SSE `window.close`.

Errors:
- `404` — Window not found

### Group Windows

**`POST /windows/group`**

Body:
```json
{
  "windowIds": ["wm_...", "wm_..."]
}
```

| Field      | Type     | Required | Constraints                   |
|-----------|----------|----------|-------------------------------|
| `windowIds`| string[] | Yes      | At least 2 window IDs        |

Grouped windows share the first window's bounds. Each window receives a `groupOrder` within the group.

Response: `{ "groupId": "grp_...", "windowIds": ["wm_...", ...] }`. Emits SSE `window.group`.

Errors:
- `400` — Less than 2 window IDs provided
- `404` — Any referenced window not found

### Ungroup Window

**`POST /windows/{id}/ungroup`**

`id` in path MUST match `[a-zA-Z0-9_]+`.

Removes the window from its group. If fewer than 2 windows remain in the group after ungrouping, the entire group is dissolved.

Response: `{ "window": { ... } }` (full window object). Emits SSE `window.ungroup`.

Errors:
- `404` — Window not found

---

## 4. postMessage — Shell ↔ iframe

All communication between the WM shell and app iframes goes through `postMessage`. The recommended approach is to use `wm-sdk.js` (see section 4.3), which wraps the raw protocol.

### 4.1. iframe → shell (app requests)

All requests use the correlation ID protocol:

```json
{
  "_wmRequestId": "wmReq_1_abc123",
  "action": "<action-name>",
  ...
}
```

The shell responds with:

```json
{
  "_wmResponseId": "wmReq_1_abc123",
  "result": { "ok": true, ... }
}
```

#### Actions

| `action`         | Additional fields                          | Description                                      |
|------------------|--------------------------------------------|--------------------------------------------------|
| `wm.open`        | `appId`, `context?`, `parentWindowId?`     | Open another app in a new window                 |
| `wm.closeSelf`   | —                                          | Close the current window                         |
| `wm.updateSelf`  | `updates: { bounds?, state?, order?, title?, groupId? }` | Update the current window's properties |
| `wm.setTitle`    | `title`                                    | Shorthand for updating the window title          |
| `wm.send`        | `targetWindowId`, `payload`                | Send a message to another window                 |

The shell identifies the source window by matching the `MessageEvent.source` to a known iframe `contentWindow`.

#### Legacy support

The shell also accepts the v1 format without `_wmRequestId` for `wm.open` and `wm.closeSelf`. These are fire-and-forget (no response).

### 4.2. shell → iframe (events)

The shell broadcasts SSE events to iframes using the following format:

```json
{
  "_wmEvent": "<event-name>",
  "payload": { ... }
}
```

Event names match the SSE events: `window.open`, `window.close`, `window.update`, `window.group`, `window.ungroup`.

Inter-window messages (sent via `wm.send`) are delivered as:

```json
{
  "_wmEvent": "message",
  "payload": { ... }
}
```

### 4.3. wm-sdk.js (recommended client library)

Apps SHOULD use the SDK instead of raw `postMessage`. Include it as a `<script>` tag or import it.

```javascript
const wm = SemitexaWM.init({ origin: '*' });
```

#### Methods

| Method                              | Returns              | Description                          |
|-------------------------------------|----------------------|--------------------------------------|
| `wm.open(appId, context?)`         | `Promise<window>`    | Open another app in a new window     |
| `wm.closeSelf()`                   | `Promise<object>`    | Close the current window             |
| `wm.updateSelf(updates)`           | `Promise<window>`    | Update the current window            |
| `wm.setTitle(title)`               | `Promise<window>`    | Set the window title                 |
| `wm.send(windowId, payload)`       | `Promise<{ok:true}>` | Send a message to another window     |
| `wm.getWindowId()`                 | `string \| null`     | Get the current window ID            |
| `wm.on(event, callback)`           | `() => void`         | Subscribe to events; returns unsub   |

#### Window ID auto-detection

The SDK resolves the current window ID from:
1. The `_wmWindowId` URL parameter (injected by the shell)
2. `frameElement.dataset.windowId` (same-origin only)
3. Falls back to `null`

#### Timeouts

All request-response operations timeout after **10 seconds**.

### Target origin

Apps MUST use `window.parent.postMessage(..., '*')` or the actual origin of the shell. The shell MUST validate `ev.origin` when handling messages in production.

---

## 5. Versioning

- This contract is **v2**.
- v1 → v2 changes: added `bounds`, `state`, `groupId`, `groupOrder` to window objects; added `window.update`, `window.group`, `window.ungroup` events; added `POST /windows/group` and `POST /windows/{id}/ungroup` endpoints; added `parentWindowId` to `POST /windows`; added `desktop` parameter to `AsWmApp`; documented SDK protocol with correlation IDs.
- Changes that add optional fields or new events are backward-compatible.
- Breaking changes (removing or renaming fields, changing semantics) require a new contract version and MUST be documented.

---

*Semitexa Platform WM · Update without fear.*
