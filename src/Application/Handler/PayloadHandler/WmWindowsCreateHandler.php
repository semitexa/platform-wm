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
use Semitexa\Platform\Wm\Application\Payload\Request\WmWindowsCreatePayload;
use Semitexa\Platform\Wm\Application\Service\WmEventBus;
use Semitexa\Platform\Wm\Application\Service\WmStateService;

#[AsPayloadHandler(payload: WmWindowsCreatePayload::class, resource: \Semitexa\Core\Http\Response\GenericResponse::class)]
final class WmWindowsCreateHandler implements HandlerInterface
{
    #[InjectAsReadonly]
    protected SessionInterface $session;

    public function handle(PayloadInterface $payload, ResourceInterface $resource): ResourceInterface
    {
        if (!$payload instanceof WmWindowsCreatePayload || trim($payload->appId) === '') {
            return Response::json(['error' => 'appId required'], 400);
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

        return Response::json(['window' => $window]);
    }
}
