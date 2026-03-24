# semitexa/platform-wm

Desktop shell with Shadow DOM window manager, iframe isolation, SSE event bus, and app registry.

## Purpose

Provides a browser-based desktop environment. Applications register via `#[AsWmApp]` and run in isolated iframe windows managed by a Shadow DOM web component. Window state is synchronized across tabs via server-sent events.

## Role in Semitexa

Depends on `semitexa/core`, `semitexa/authorization`, and `semitexa/ssr`. Platform modules such as `semitexa/platform-user` register WM apps to appear in the desktop shell. Authorization gates control which apps are visible to a given user.

## Key Features

- `#[AsWmApp]` attribute for app registration
- `AppRegistry` discovers and manages desktop applications
- Shadow DOM `<wm-window-frame>` web component
- 8-handle window resize via `resize-manager.js`
- Iframe isolation for application sandboxing
- SSE event bus for real-time state synchronization
- Authorization-gated app access

## Notes

WM apps run in iframes for full isolation. The Shadow DOM approach ensures window chrome styling cannot leak into application content.
