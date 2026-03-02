<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Payload\Session;

use Semitexa\Core\Session\Attribute\SessionSegment;

/**
 * Session segment holding WM window state: list of open windows.
 * Structure: windows = [ { id, appId, context, title, order }, ... ]
 */
#[SessionSegment('wm_state')]
final class WmStateSessionPayload
{
    /** @var list<array{id: string, appId: string, context: array<string, mixed>, title: string, order: int}> */
    private array $windows = [];

    /** @return list<array{id: string, appId: string, context: array<string, mixed>, title: string, order: int}> */
    public function getWindows(): array
    {
        return $this->windows;
    }

    /**
     * @param list<array{id: string, appId: string, context: array<string, mixed>, title: string, order: int}> $windows
     */
    public function setWindows(array $windows): void
    {
        $this->windows = $windows;
    }
}
