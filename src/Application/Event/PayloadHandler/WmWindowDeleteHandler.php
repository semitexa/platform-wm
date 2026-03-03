<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Event\PayloadHandler;

use Semitexa\Core\Attributes\AsPayloadHandler;
use Semitexa\Core\Attributes\InjectAsReadonly;
use Semitexa\Core\Contract\HandlerInterface;
use Semitexa\Core\Contract\PayloadInterface;
use Semitexa\Core\Contract\ResourceInterface;
use Semitexa\Core\Response;
use Semitexa\Core\Session\SessionInterface;
use Semitexa\Platform\Wm\Application\Payload\Request\WmWindowDeletePayload;
use Semitexa\Platform\Wm\Event\WmEventBus;
use Semitexa\Platform\Wm\Service\WmStateService;

#[AsPayloadHandler(payload: WmWindowDeletePayload::class, resource: \Semitexa\Core\Http\Response\GenericResponse::class)]
final class WmWindowDeleteHandler implements HandlerInterface
{
    #[InjectAsReadonly]
    protected SessionInterface $session;

    public function handle(PayloadInterface $payload, ResourceInterface $resource): ResourceInterface
    {
        if (!$payload instanceof WmWindowDeletePayload || trim($payload->id) === '') {
            return Response::json(['error' => 'id required'], 400);
        }
        $wmState = WmStateService::fromSession($this->session);
        $removed = $wmState->removeWindow($payload->id);
        if ($removed === null) {
            return Response::json(['error' => 'Window not found'], 404);
        }
        WmEventBus::windowClose($this->session->getId(), $removed);
        return Response::json(['ok' => true]);
    }
}
