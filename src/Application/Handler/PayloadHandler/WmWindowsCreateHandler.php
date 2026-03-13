<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Handler\PayloadHandler;

use Semitexa\Core\Attributes\AsPayloadHandler;
use Semitexa\Core\Attributes\InjectAsReadonly;
use Semitexa\Core\Contract\TypedHandlerInterface;
use Semitexa\Core\Exception\ValidationException;
use Semitexa\Core\Http\Response\GenericResponse;
use Semitexa\Core\Session\SessionInterface;
use Semitexa\Platform\Wm\Application\Payload\Request\WmWindowsCreatePayload;
use Semitexa\Platform\Wm\Application\Service\WmEventBus;
use Semitexa\Platform\Wm\Application\Service\WmStateService;

#[AsPayloadHandler(payload: WmWindowsCreatePayload::class, resource: GenericResponse::class)]
final class WmWindowsCreateHandler implements TypedHandlerInterface
{
    #[InjectAsReadonly]
    protected SessionInterface $session;

    public function handle(WmWindowsCreatePayload $payload, GenericResponse $resource): GenericResponse
    {
        if (trim($payload->appId) === '') {
            throw new ValidationException(['appId' => ['appId is required']]);
        }

        $wmState = WmStateService::fromSession($this->session);
        $window = $wmState->addWindow($payload->appId, $payload->context, $payload->parentWindowId);
        WmEventBus::windowOpen($this->session->getId(), $window);

        // If auto-grouping happened, emit group event so other tabs refresh state
        if ($window['groupId'] !== null) {
            $groupWindowIds = [];
            foreach ($wmState->getWindows() as $w) {
                if (($w['groupId'] ?? null) === $window['groupId']) {
                    $groupWindowIds[] = $w['id'];
                }
            }
            WmEventBus::windowGroup($this->session->getId(), $window['groupId'], $groupWindowIds);
        }

        $resource->setContext(['window' => $window]);
        return $resource;
    }
}
