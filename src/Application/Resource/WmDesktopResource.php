<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Resource;

use Semitexa\Core\Contract\ResourceInterface;
use Semitexa\Ssr\Http\Response\HtmlResponse;

class WmDesktopResource extends HtmlResponse implements ResourceInterface
{
    protected string $renderHandle = 'wm-desktop';
    protected array $renderContext = [];
}
