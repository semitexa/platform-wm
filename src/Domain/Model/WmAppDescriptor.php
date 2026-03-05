<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Domain\Model;

/**
 * DTO for a registered WM app. Returned by WmAppRegistry and serialized in GET /api/platform/wm/apps.
 */
final readonly class WmAppDescriptor
{
    public function __construct(
        public string $id,
        public string $title,
        public string $entryUrl,
        public ?string $icon = null,
        public ?string $permission = null,
        public bool $desktop = true,
    ) {
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'entryUrl' => $this->entryUrl,
            'icon' => $this->icon,
            'permission' => $this->permission,
            'desktop' => $this->desktop,
        ];
    }
}
