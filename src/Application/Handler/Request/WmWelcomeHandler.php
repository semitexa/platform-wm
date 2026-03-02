<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Handler\Request;

use Semitexa\Core\Attributes\AsPayloadHandler;
use Semitexa\Core\Contract\HandlerInterface;
use Semitexa\Core\Contract\PayloadInterface;
use Semitexa\Core\Contract\ResourceInterface;
use Semitexa\Core\Response;
use Semitexa\Platform\Wm\Application\Payload\Request\WmWelcomePayload;

#[AsPayloadHandler(payload: WmWelcomePayload::class, resource: \Semitexa\Core\Http\Response\GenericResponse::class)]
final class WmWelcomeHandler implements HandlerInterface
{
    public function handle(PayloadInterface $payload, ResourceInterface $resource): ResourceInterface
    {
        $html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Welcome</title></head><body><h1>Welcome to Semitexa Platform</h1><p>This app runs inside the Window Manager iframe.</p></body></html>';
        return Response::html($html);
    }
}
