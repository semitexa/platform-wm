<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Service;

use Semitexa\Core\Session\SessionInterface;
use Semitexa\Platform\Wm\Application\Payload\Session\WmStateSessionPayload;
use Semitexa\Platform\Wm\Domain\Contract\WmStateServiceInterface;
use Semitexa\Platform\Wm\Application\Registry\WmAppRegistry;

/**
 * Reads and writes WM window state from/to session.
 * Not registered as a service contract (SessionInterface is request-scoped); create via fromSession() in handlers.
 */
final class WmStateService implements WmStateServiceInterface
{
    private const VALID_STATES = ['normal', 'minimized', 'maximized'];
    private const UPDATABLE_KEYS = ['bounds', 'state', 'order', 'title', 'groupId'];
    private const MIN_WIDTH = 200;
    private const MIN_HEIGHT = 120;
    private const DEFAULT_X = 50;
    private const DEFAULT_Y = 50;
    private const DEFAULT_WIDTH = 800;
    private const DEFAULT_HEIGHT = 600;

    public function __construct(
        private readonly SessionInterface $session,
    ) {
    }

    public static function fromSession(SessionInterface $session): self
    {
        return new self($session);
    }

    /** @return array{x: int, y: int, w: int, h: int} */
    private static function defaultBounds(int $offset = 0): array
    {
        return [
            'x' => self::DEFAULT_X + $offset,
            'y' => self::DEFAULT_Y + $offset,
            'w' => self::DEFAULT_WIDTH,
            'h' => self::DEFAULT_HEIGHT,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function getWindows(): array
    {
        $payload = $this->session->getPayload(WmStateSessionPayload::class);
        $windows = $payload->getWindows();

        // Normalize old windows missing new fields
        $changed = false;
        foreach ($windows as $i => $w) {
            if (!isset($w['bounds'])) {
                $offset = $i * 30;
                $windows[$i]['bounds'] = self::defaultBounds($offset);
                $changed = true;
            }
            if (!isset($w['state'])) {
                $windows[$i]['state'] = 'normal';
                $changed = true;
            }
            if (!array_key_exists('groupId', $w)) {
                $windows[$i]['groupId'] = null;
                $changed = true;
            }
        }

        if ($changed) {
            $payload->setWindows($windows);
            $this->session->setPayload($payload);
        }

        return $windows;
    }

    public function addWindow(string $appId, array $context = []): array
    {
        $payload = $this->session->getPayload(WmStateSessionPayload::class);
        $windows = $payload->getWindows();
        $order = $windows === [] ? 0 : max(array_column($windows, 'order')) + 1;
        $app = WmAppRegistry::get($appId);
        $title = $app !== null ? $app->title : $appId;
        $id = 'wm_' . bin2hex(random_bytes(8));
        $offset = count($windows) * 30;
        $window = [
            'id' => $id,
            'appId' => $appId,
            'context' => $context,
            'title' => $title,
            'order' => $order,
            'bounds' => self::defaultBounds($offset),
            'state' => 'normal',
            'groupId' => null,
        ];
        $windows[] = $window;
        $payload->setWindows($windows);
        $this->session->setPayload($payload);
        return $window;
    }

    /**
     * Validate update keys and values before applying.
     * Returns null if valid, or an error message string.
     */
    public function validateUpdates(array $updates): ?string
    {
        foreach (array_keys($updates) as $key) {
            if (!in_array($key, self::UPDATABLE_KEYS, true)) {
                return "Invalid update key: $key";
            }
        }

        if (isset($updates['bounds'])) {
            $b = $updates['bounds'];
            if (!is_array($b)) {
                return 'bounds must be an object';
            }
            foreach (['x', 'y', 'w', 'h'] as $k) {
                if (isset($b[$k]) && !is_numeric($b[$k])) {
                    return "bounds.$k must be numeric";
                }
            }
            if (isset($b['w']) && $b['w'] < self::MIN_WIDTH) {
                return 'bounds.w minimum is ' . self::MIN_WIDTH;
            }
            if (isset($b['h']) && $b['h'] < self::MIN_HEIGHT) {
                return 'bounds.h minimum is ' . self::MIN_HEIGHT;
            }
        }

        if (isset($updates['state']) && !in_array($updates['state'], self::VALID_STATES, true)) {
            return 'state must be one of: ' . implode(', ', self::VALID_STATES);
        }

        return null;
    }

    public function updateWindow(string $id, array $updates): ?array
    {
        $payload = $this->session->getPayload(WmStateSessionPayload::class);
        $windows = $payload->getWindows();
        foreach ($windows as $i => $w) {
            if (($w['id'] ?? '') === $id) {
                // Merge bounds deeply so partial updates work
                if (isset($updates['bounds']) && isset($w['bounds'])) {
                    $updates['bounds'] = array_merge($w['bounds'], $updates['bounds']);
                }
                $windows[$i] = array_merge($w, $updates);
                $payload->setWindows($windows);
                $this->session->setPayload($payload);
                return $windows[$i];
            }
        }
        return null;
    }

    public function removeWindow(string $id): ?array
    {
        $payload = $this->session->getPayload(WmStateSessionPayload::class);
        $windows = $payload->getWindows();
        foreach ($windows as $i => $w) {
            if (($w['id'] ?? '') === $id) {
                $removed = $windows[$i];
                array_splice($windows, $i, 1);
                $payload->setWindows($windows);
                $this->session->setPayload($payload);
                return $removed;
            }
        }
        return null;
    }

    public function getWindow(string $id): ?array
    {
        foreach ($this->getWindows() as $w) {
            if (($w['id'] ?? '') === $id) {
                return $w;
            }
        }
        return null;
    }

    /**
     * Group multiple windows together. All grouped windows share the first window's bounds.
     *
     * @param list<string> $windowIds
     * @return string The generated groupId
     */
    public function groupWindows(array $windowIds): string
    {
        $payload = $this->session->getPayload(WmStateSessionPayload::class);
        $windows = $payload->getWindows();
        $groupId = 'grp_' . bin2hex(random_bytes(6));
        $firstBounds = null;
        $groupOrder = 0;

        foreach ($windows as $i => $w) {
            if (in_array($w['id'] ?? '', $windowIds, true)) {
                if ($firstBounds === null) {
                    $firstBounds = $w['bounds'] ?? self::defaultBounds();
                }
                $windows[$i]['groupId'] = $groupId;
                $windows[$i]['groupOrder'] = $groupOrder++;
                $windows[$i]['bounds'] = $firstBounds;
            }
        }

        $payload->setWindows($windows);
        $this->session->setPayload($payload);
        return $groupId;
    }

    /**
     * Remove a window from its group. If < 2 windows remain, dissolve the group.
     *
     * @return array|null The ungrouped window data, or null if not found
     */
    public function ungroupWindow(string $id): ?array
    {
        $payload = $this->session->getPayload(WmStateSessionPayload::class);
        $windows = $payload->getWindows();
        $ungrouped = null;
        $groupId = null;

        foreach ($windows as $i => $w) {
            if (($w['id'] ?? '') === $id) {
                $groupId = $w['groupId'] ?? null;
                $windows[$i]['groupId'] = null;
                unset($windows[$i]['groupOrder']);
                $ungrouped = $windows[$i];
                break;
            }
        }

        if ($ungrouped === null || $groupId === null) {
            return $ungrouped;
        }

        // Count remaining members
        $remaining = [];
        foreach ($windows as $i => $w) {
            if (($w['groupId'] ?? null) === $groupId) {
                $remaining[] = $i;
            }
        }

        // Dissolve group if fewer than 2 remain
        if (count($remaining) < 2) {
            foreach ($remaining as $i) {
                $windows[$i]['groupId'] = null;
                unset($windows[$i]['groupOrder']);
            }
        }

        $payload->setWindows($windows);
        $this->session->setPayload($payload);
        return $ungrouped;
    }
}
