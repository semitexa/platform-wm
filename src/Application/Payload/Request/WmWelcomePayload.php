<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Payload\Request;

use Semitexa\Core\Attributes\AsPayload;
use Semitexa\Core\Http\Response\GenericResponse;
use Semitexa\Authorization\Attributes\PublicEndpoint;

#[PublicEndpoint]
#[AsPayload(path: '/platform/welcome', methods: ['GET'], responseWith: GenericResponse::class)]
class WmWelcomePayload
{
}
