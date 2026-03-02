<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Payload\Request;

use Semitexa\Core\Attributes\AsPayload;
use Semitexa\Core\Attributes\RequiresAuth;
use Semitexa\Core\Contract\PayloadInterface;
use Semitexa\Core\Http\Response\GenericResponse;

#[AsPayload(path: '/api/platform/wm/windows/{id}', methods: ['PATCH'], responseWith: GenericResponse::class, requirements: ['id' => '[a-zA-Z0-9_]+'])]
#[RequiresAuth]
class WmWindowUpdatePayload implements PayloadInterface
{
    public string $id = '';
    /** @var array<string, mixed> */
    public array $updates = [];

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    /** @param array<string, mixed> $updates */
    public function setUpdates(array $updates): void
    {
        $this->updates = $updates;
    }
}
