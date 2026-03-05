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
use Semitexa\Platform\Wm\Application\Payload\Request\WmWindowUngroupPayload;
use Semitexa\Platform\Wm\Application\Service\WmEventBus;
use Semitexa\Platform\Wm\Application\Service\WmStateService;

#[AsPayloadHandler(payload: WmWindowUngroupPayload::class, resource: \Semitexa\Core\Http\Response\GenericResponse::class)]
final class WmWindowUngroupHandler implements HandlerInterface
{
    #[InjectAsReadonly]
    protected SessionInterface $session;

    public function handle(PayloadInterface $payload, ResourceInterface $resource): ResourceInterface
    {
        if (!$payload instanceof WmWindowUngroupPayload || trim($payload->id) === '') {
            return Response::json(['error' => 'id required'], 400);
        }

        $wmState = WmStateService::fromSession($this->session);
        $window = $wmState->getWindow($payload->id);

        if ($window === null) {
            return Response::json(['error' => 'Window not found'], 404);
        }

        $oldGroupId = $window['groupId'] ?? null;
        $ungrouped = $wmState->ungroupWindow($payload->id);

        WmEventBus::windowUngroup($this->session->getId(), $payload->id, $oldGroupId);

        return Response::json(['window' => $ungrouped]);
    }
}
