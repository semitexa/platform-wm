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
use Semitexa\Platform\Wm\Application\Payload\Request\WmWindowUpdatePayload;
use Semitexa\Platform\Wm\Application\Service\WmEventBus;
use Semitexa\Platform\Wm\Application\Service\WmStateService;

#[AsPayloadHandler(payload: WmWindowUpdatePayload::class, resource: GenericResponse::class)]
final class WmWindowUpdateHandler implements TypedHandlerInterface
{
    #[InjectAsReadonly]
    protected SessionInterface $session;

    public function handle(WmWindowUpdatePayload $payload, GenericResponse $resource): GenericResponse
    {
        if (trim($payload->id) === '') {
            throw new ValidationException(['id' => ['id is required']]);
        }

        $wmState = WmStateService::fromSession($this->session);

        $validationError = $wmState->validateUpdates($payload->updates);
        if ($validationError !== null) {
            throw new ValidationException(['updates' => [$validationError]]);
        }

        $updated = $wmState->updateWindow($payload->id, $payload->updates);
        if ($updated === null) {
            throw new NotFoundException('Window', $payload->id);
        }

        WmEventBus::windowUpdate($this->session->getId(), $updated);

        $resource->setContext(['window' => $updated]);
        return $resource;
    }
}
