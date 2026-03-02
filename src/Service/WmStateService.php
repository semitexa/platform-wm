<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Service;

use Semitexa\Core\Session\SessionInterface;
use Semitexa\Platform\Wm\Application\Payload\Session\WmStateSessionPayload;
use Semitexa\Platform\Wm\Contract\WmStateServiceInterface;
use Semitexa\Platform\Wm\Registry\WmAppRegistry;

/**
 * Reads and writes WM window state from/to session.
 * Not registered as a service contract (SessionInterface is request-scoped); create via fromSession() in handlers.
 */
final class WmStateService implements WmStateServiceInterface
{
    public function __construct(
        private readonly SessionInterface $session,
    ) {
    }

    public static function fromSession(SessionInterface $session): self
    {
        return new self($session);
    }

    /**
     * @return list<array{id: string, appId: string, context: array<string, mixed>, title: string, order: int}>
     */
    public function getWindows(): array
    {
        $payload = $this->session->getPayload(WmStateSessionPayload::class);
        return $payload->getWindows();
    }

    public function addWindow(string $appId, array $context = []): array
    {
        $payload = $this->session->getPayload(WmStateSessionPayload::class);
        $windows = $payload->getWindows();
        $order = $windows === [] ? 0 : max(array_column($windows, 'order')) + 1;
        $app = WmAppRegistry::get($appId);
        $title = $app !== null ? $app->title : $appId;
        $id = 'wm_' . bin2hex(random_bytes(8));
        $window = [
            'id' => $id,
            'appId' => $appId,
            'context' => $context,
            'title' => $title,
            'order' => $order,
        ];
        $windows[] = $window;
        $payload->setWindows($windows);
        $this->session->setPayload($payload);
        return $window;
    }

    public function updateWindow(string $id, array $updates): ?array
    {
        $payload = $this->session->getPayload(WmStateSessionPayload::class);
        $windows = $payload->getWindows();
        foreach ($windows as $i => $w) {
            if (($w['id'] ?? '') === $id) {
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
}
