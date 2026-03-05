<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Payload\Session;

use Semitexa\Core\Session\Attribute\SessionSegment;

/**
 * Session segment holding WM window state: list of open windows.
 *
 * Window structure:
 *   id: string, appId: string, context: array, title: string, order: int,
 *   bounds: {x: int, y: int, w: int, h: int}, state: 'normal'|'minimized'|'maximized',
 *   groupId: ?string
 */
#[SessionSegment('wm_state')]
final class WmStateSessionPayload
{
    /** @var list<array<string, mixed>> */
    private array $windows = [];

    /** @return list<array<string, mixed>> */
    public function getWindows(): array
    {
        return $this->windows;
    }

    /** @param list<array<string, mixed>> $windows */
    public function setWindows(array $windows): void
    {
        $this->windows = $windows;
    }
}
