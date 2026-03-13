<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Handler\PayloadHandler;

use Semitexa\Core\Attributes\AsPayloadHandler;
use Semitexa\Core\Contract\TypedHandlerInterface;
use Semitexa\Core\Http\Response\GenericResponse;
use Semitexa\Platform\Wm\Application\Payload\Request\WmWelcomePayload;

#[AsPayloadHandler(payload: WmWelcomePayload::class, resource: GenericResponse::class)]
final class WmWelcomeHandler implements TypedHandlerInterface
{
    public function handle(WmWelcomePayload $payload, GenericResponse $resource): GenericResponse
    {
        $html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Welcome</title></head><body><h1>Welcome to Semitexa Platform</h1><p>This app runs inside the Window Manager iframe.</p></body></html>';
        $resource->setContent($html);
        $resource->setHeader('Content-Type', 'text/html; charset=utf-8');
        return $resource;
    }
}
