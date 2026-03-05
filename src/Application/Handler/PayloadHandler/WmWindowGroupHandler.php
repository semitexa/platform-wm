<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Handler\PayloadHandler;

use Semitexa\Core\Attributes\AsPayloadHandler;
use Semitexa\Core\Attributes\InjectAsReadonly;
use Semitexa\Core\Contract\HandlerInterface;
use Semitexa\Core\Contract\PayloadInterface;
use Semitexa\Core\Contract\ResourceInterface;
use Semitexa\Core\Response;
use Semitexa\Core\Session\SessionInterface;
use Semitexa\Platform\Wm\Application\Payload\Request\WmWindowGroupPayload;
use Semitexa\Platform\Wm\Application\Service\WmEventBus;
use Semitexa\Platform\Wm\Application\Service\WmStateService;

#[AsPayloadHandler(payload: WmWindowGroupPayload::class, resource: \Semitexa\Core\Http\Response\GenericResponse::class)]
final class WmWindowGroupHandler implements HandlerInterface
{
    #[InjectAsReadonly]
    protected SessionInterface $session;

    public function handle(PayloadInterface $payload, ResourceInterface $resource): ResourceInterface
    {
        if (!$payload instanceof WmWindowGroupPayload || count($payload->windowIds) < 2) {
            return Response::json(['error' => 'At least 2 windowIds required'], 400);
        }

        $wmState = WmStateService::fromSession($this->session);

        // Validate all windows exist
        foreach ($payload->windowIds as $windowId) {
            if ($wmState->getWindow($windowId) === null) {
                return Response::json(['error' => "Window not found: $windowId"], 404);
            }
        }

        $groupId = $wmState->groupWindows($payload->windowIds);
        WmEventBus::windowGroup($this->session->getId(), $groupId, $payload->windowIds);

        return Response::json(['groupId' => $groupId, 'windowIds' => $payload->windowIds]);
    }
}
