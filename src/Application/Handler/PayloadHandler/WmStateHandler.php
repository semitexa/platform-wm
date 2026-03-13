<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Handler\PayloadHandler;

use Semitexa\Core\Attributes\AsPayloadHandler;
use Semitexa\Core\Attributes\InjectAsReadonly;
use Semitexa\Core\Contract\TypedHandlerInterface;
use Semitexa\Core\Http\Response\GenericResponse;
use Semitexa\Core\Session\SessionInterface;
use Semitexa\Platform\Wm\Application\Payload\Request\WmStatePayload;
use Semitexa\Platform\Wm\Application\Service\WmStateService;

#[AsPayloadHandler(payload: WmStatePayload::class, resource: GenericResponse::class)]
final class WmStateHandler implements TypedHandlerInterface
{
    #[InjectAsReadonly]
    protected SessionInterface $session;

    public function handle(WmStatePayload $payload, GenericResponse $resource): GenericResponse
    {
        $wmState = WmStateService::fromSession($this->session);
        $resource->setContext(['windows' => $wmState->getWindows()]);
        return $resource;
    }
}
