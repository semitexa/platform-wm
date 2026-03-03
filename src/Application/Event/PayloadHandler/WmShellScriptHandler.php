<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Event\PayloadHandler;

use Semitexa\Core\Attributes\AsPayloadHandler;
use Semitexa\Core\Contract\HandlerInterface;
use Semitexa\Core\Contract\PayloadInterface;
use Semitexa\Core\Contract\ResourceInterface;
use Semitexa\Core\Response;
use Semitexa\Platform\Wm\Application\Payload\Request\WmShellScriptPayload;

#[AsPayloadHandler(payload: WmShellScriptPayload::class, resource: \Semitexa\Core\Http\Response\GenericResponse::class)]
final class WmShellScriptHandler implements HandlerInterface
{
    public function handle(PayloadInterface $payload, ResourceInterface $resource): ResourceInterface
    {
        $baseDir = dirname(__DIR__, 4); // PayloadHandler -> Event -> Application -> src -> package root
        $path = $baseDir . '/resources/js/wm-shell.js';
        if (!is_file($path)) {
            return Response::text('/* WM shell not found */', 404);
        }
        $content = file_get_contents($path);
        return new Response($content, 200, ['Content-Type' => 'application/javascript']);
    }
}
