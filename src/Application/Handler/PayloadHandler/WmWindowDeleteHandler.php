<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Handler\PayloadHandler;

use Semitexa\Core\Attributes\AsPayloadHandler;
use Semitexa\Core\Attributes\InjectAsReadonly;
use Semitexa\Core\Contract\TypedHandlerInterface;
use Semitexa\Core\Exception\NotFoundException;
use Semitexa\Core\Exception\ValidationException;
use Semitexa\Core\Http\Response\GenericResponse;
use Semitexa\Core\Session\SessionInterface;
use Semitexa\Platform\Wm\Application\Payload\Request\WmWindowDeletePayload;
use Semitexa\Platform\Wm\Application\Service\WmEventBus;
use Semitexa\Platform\Wm\Application\Service\WmStateService;

#[AsPayloadHandler(payload: WmWindowDeletePayload::class, resource: GenericResponse::class)]
final class WmWindowDeleteHandler implements TypedHandlerInterface
{
    #[InjectAsReadonly]
    protected SessionInterface $session;

    public function handle(WmWindowDeletePayload $payload, GenericResponse $resource): GenericResponse
    {
        if (trim($payload->id) === '') {
            throw new ValidationException(['id' => ['id is required']]);
        }

        $wmState = WmStateService::fromSession($this->session);
        $removed = $wmState->removeWindow($payload->id);

        if ($removed === null) {
            throw new NotFoundException('Window', $payload->id);
        }

        WmEventBus::windowClose($this->session->getId(), $removed);
        $resource->setContext(['ok' => true]);
        return $resource;
    }
}
