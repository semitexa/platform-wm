<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Handler\PayloadHandler;

use Semitexa\Core\Attributes\AsPayloadHandler;
use Semitexa\Core\Attributes\InjectAsReadonly;
use Semitexa\Core\Auth\AuthContextInterface;
use Semitexa\Core\Contract\HandlerInterface;
use Semitexa\Core\Contract\PayloadInterface;
use Semitexa\Core\Contract\ResourceInterface;
use Semitexa\Core\Response;
use Semitexa\Core\Session\SessionInterface;
use Semitexa\Platform\Wm\Application\Payload\Request\WmDesktopPayload;
use Semitexa\Platform\Wm\Application\Resource\WmDesktopResource;
use Semitexa\Platform\Wm\Application\Registry\WmAppRegistry;
use Semitexa\Platform\Wm\Application\Service\WmStateService;

#[AsPayloadHandler(payload: WmDesktopPayload::class, resource: WmDesktopResource::class)]
final class WmDesktopHandler implements HandlerInterface
{
    #[InjectAsReadonly]
    protected SessionInterface $session;

    #[InjectAsReadonly]
    protected AuthContextInterface $auth;

    public function handle(PayloadInterface $payload, ResourceInterface $resource): ResourceInterface
    {
        if ($this->auth->isGuest()) {
            return Response::redirect('/platform/login');
        }

        if (!$resource instanceof WmDesktopResource) {
            return $resource;
        }

        $user = $this->auth->getUser();
        $wmState = WmStateService::fromSession($this->session);
        $apps = array_map(static fn ($d) => $d->toArray(), WmAppRegistry::all());
        $windows = $wmState->getWindows();
        $sessionId = $this->session->getId();
        $resource->renderTemplate('@project-layouts-platform-wm/desktop.html.twig', [
            'wmBootstrap' => [
                'apps' => $apps,
                'windows' => $windows,
                'sessionId' => $sessionId,
                'sseUrl' => '/sse',
                'apiBase' => '/api/platform/wm',
                'user' => $user !== null ? [
                    'id' => $user->getId(),
                ] : null,
            ],
        ]);
        return $resource;
    }
}
