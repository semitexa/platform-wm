<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Payload\Request;

use Semitexa\Core\Attributes\AsPayload;
use Semitexa\Core\Http\Response\GenericResponse;

#[AsPayload(path: '/api/platform/wm/windows/group', methods: ['POST'], responseWith: GenericResponse::class)]
class WmWindowGroupPayload
{
    /** @var list<string> */
    public array $windowIds = [];

    /** @param list<string> $windowIds */
    public function setWindowIds(array $windowIds): void
    {
        $this->windowIds = $windowIds;
    }
}
