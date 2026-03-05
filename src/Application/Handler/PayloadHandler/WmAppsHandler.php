<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Handler\PayloadHandler;

use Semitexa\Core\Attributes\AsPayloadHandler;
use Semitexa\Core\Contract\HandlerInterface;
use Semitexa\Core\Contract\PayloadInterface;
use Semitexa\Core\Contract\ResourceInterface;
use Semitexa\Core\Response;
use Semitexa\Platform\Wm\Application\Payload\Request\WmAppsPayload;
use Semitexa\Platform\Wm\Application\Registry\WmAppRegistry;

#[AsPayloadHandler(payload: WmAppsPayload::class, resource: \Semitexa\Core\Http\Response\GenericResponse::class)]
final class WmAppsHandler implements HandlerInterface
{
    public function handle(PayloadInterface $payload, ResourceInterface $resource): ResourceInterface
    {
        $apps = WmAppRegistry::all();
        $data = array_map(static fn ($d) => $d->toArray(), $apps);
        return Response::json(['apps' => $data]);
    }
}
