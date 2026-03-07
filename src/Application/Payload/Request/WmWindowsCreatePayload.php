<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Payload\Request;

use Semitexa\Core\Attributes\AsPayload;
use Semitexa\Core\Attributes\RequiresAuth;
use Semitexa\Core\Contract\PayloadInterface;
use Semitexa\Core\Http\Response\GenericResponse;

#[AsPayload(path: '/api/platform/wm/windows', methods: ['POST'], responseWith: GenericResponse::class)]
#[RequiresAuth]
class WmWindowsCreatePayload implements PayloadInterface
{
    public string $appId = '';
    /** @var array<string, mixed> */
    public array $context = [];
    public ?string $parentWindowId = null;

    public function setAppId(string $appId): void
    {
        $this->appId = $appId;
    }

    /** @param array<string, mixed> $context */
    public function setContext(array $context): void
    {
        $this->context = $context;
    }

    public function setParentWindowId(?string $parentWindowId): void
    {
        $this->parentWindowId = $parentWindowId;
    }
}
