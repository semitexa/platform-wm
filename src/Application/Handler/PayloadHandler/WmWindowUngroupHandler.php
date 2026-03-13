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
use Semitexa\Platform\Wm\Application\Payload\Request\WmWindowUngroupPayload;
use Semitexa\Platform\Wm\Application\Service\WmEventBus;
use Semitexa\Platform\Wm\Application\Service\WmStateService;

#[AsPayloadHandler(payload: WmWindowUngroupPayload::class, resource: GenericResponse::class)]
final class WmWindowUngroupHandler implements TypedHandlerInterface
{
    #[InjectAsReadonly]
    protected SessionInterface $session;

    public function handle(WmWindowUngroupPayload $payload, GenericResponse $resource): GenericResponse
    {
        if (trim($payload->id) === '') {
            throw new ValidationException(['id' => ['id is required']]);
        }

        $wmState = WmStateService::fromSession($this->session);
        $window = $wmState->getWindow($payload->id);

        if ($window === null) {
            throw new NotFoundException('Window', $payload->id);
        }

        $oldGroupId = $window['groupId'] ?? null;
        $ungrouped = $wmState->ungroupWindow($payload->id);

        WmEventBus::windowUngroup($this->session->getId(), $payload->id, $oldGroupId);

        $resource->setContext(['window' => $ungrouped]);
        return $resource;
    }
}
