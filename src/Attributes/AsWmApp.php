<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Attributes;

use Attribute;

/**
 * Marks a class as a WM app descriptor. The class is discovered by WmAppRegistry
 * and exposed in the apps list API. Use on a class that provides app metadata
 * (id, title, entryUrl, icon, permission).
 */
#[Attribute(Attribute::TARGET_CLASS)]
final readonly class AsWmApp
{
    public function __construct(
        public string $id,
        public string $title,
        public string $entryUrl,
        public ?string $icon = null,
        public ?string $permission = null,
    ) {
    }
}
