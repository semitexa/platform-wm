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
use Semitexa\Platform\Wm\Application\Payload\Request\WmWindowGroupPayload;
use Semitexa\Platform\Wm\Application\Service\WmEventBus;
use Semitexa\Platform\Wm\Application\Service\WmStateService;

#[AsPayloadHandler(payload: WmWindowGroupPayload::class, resource: GenericResponse::class)]
final class WmWindowGroupHandler implements TypedHandlerInterface
{
    #[InjectAsReadonly]
    protected SessionInterface $session;

    public function handle(WmWindowGroupPayload $payload, GenericResponse $resource): GenericResponse
    {
        $windowIds = array_values(array_unique($payload->windowIds));

        if (count($windowIds) < 2) {
            throw new ValidationException(['windowIds' => ['At least 2 windowIds required']]);
        }

        $wmState = WmStateService::fromSession($this->session);

        // Validate all windows exist
        foreach ($windowIds as $windowId) {
            if ($wmState->getWindow($windowId) === null) {
                throw new NotFoundException('Window', $windowId);
            }
        }

        $groupId = $wmState->groupWindows($windowIds);
        WmEventBus::windowGroup($this->session->getId(), $groupId, $windowIds);

        $resource->setContext(['groupId' => $groupId, 'windowIds' => $windowIds]);
        return $resource;
    }
}
