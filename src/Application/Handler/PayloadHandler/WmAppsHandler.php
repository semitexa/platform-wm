<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Handler\PayloadHandler;

use Semitexa\Core\Attributes\AsPayloadHandler;
use Semitexa\Core\Contract\TypedHandlerInterface;
use Semitexa\Core\Http\Response\GenericResponse;
use Semitexa\Platform\Wm\Application\Payload\Request\WmAppsPayload;
use Semitexa\Platform\Wm\Application\Registry\WmAppRegistry;

#[AsPayloadHandler(payload: WmAppsPayload::class, resource: GenericResponse::class)]
final class WmAppsHandler implements TypedHandlerInterface
{
    public function handle(WmAppsPayload $payload, GenericResponse $resource): GenericResponse
    {
        $apps = WmAppRegistry::all();
        $data = array_map(static fn ($d) => $d->toArray(), $apps);
        $resource->setContext(['apps' => $data]);
        return $resource;
    }
}
