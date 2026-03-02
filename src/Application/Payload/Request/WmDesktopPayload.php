<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Payload\Request;

use Semitexa\Core\Attributes\AsPayload;
use Semitexa\Core\Contract\PayloadInterface;
use Semitexa\Platform\Wm\Application\Resource\WmDesktopResource;

#[AsPayload(path: '/platform', methods: ['GET'], responseWith: WmDesktopResource::class)]
class WmDesktopPayload implements PayloadInterface
{
}
