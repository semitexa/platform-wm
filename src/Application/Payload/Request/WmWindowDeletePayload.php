<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Payload\Request;

use Semitexa\Core\Attributes\AsPayload;
use Semitexa\Core\Http\Response\GenericResponse;

#[AsPayload(path: '/api/platform/wm/windows/{id}', methods: ['DELETE'], responseWith: GenericResponse::class, requirements: ['id' => '[a-zA-Z0-9_]+'])]
class WmWindowDeletePayload
{
    public string $id = '';

    public function setId(string $id): void
    {
        $this->id = $id;
    }
}
