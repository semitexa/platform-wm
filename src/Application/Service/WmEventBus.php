<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Service;

use Semitexa\Ssr\Async\AsyncResourceSseServer;

/**
 * Sends WM events over the existing SSE connection. Client filters by channel === 'wm'.
 */
final class WmEventBus
{
    private const CHANNEL = 'wm';

    public static function dispatch(string $sessionId, string $event, array $payload): void
    {
        if (!class_exists(AsyncResourceSseServer::class)) {
            return;
        }
        AsyncResourceSseServer::deliver($sessionId, [
            'channel' => self::CHANNEL,
            'event' => $event,
            'payload' => $payload,
        ]);
    }

    public static function windowOpen(string $sessionId, array $window): void
    {
        self::dispatch($sessionId, 'window.open', $window);
    }

    public static function windowClose(string $sessionId, array $window): void
    {
        self::dispatch($sessionId, 'window.close', $window);
    }

    public static function windowMinimize(string $sessionId, array $window): void
    {
        self::dispatch($sessionId, 'window.minimize', $window);
    }

    public static function windowFocus(string $sessionId, array $window): void
    {
        self::dispatch($sessionId, 'window.focus', $window);
    }

    public static function windowUpdate(string $sessionId, array $window): void
    {
        self::dispatch($sessionId, 'window.update', $window);
    }

    public static function windowGroup(string $sessionId, string $groupId, array $windowIds): void
    {
        self::dispatch($sessionId, 'window.group', ['groupId' => $groupId, 'windowIds' => $windowIds]);
    }

    public static function windowUngroup(string $sessionId, string $windowId, ?string $dissolvedGroupId = null): void
    {
        self::dispatch($sessionId, 'window.ungroup', ['windowId' => $windowId, 'dissolvedGroupId' => $dissolvedGroupId]);
    }
}
