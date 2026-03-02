<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\App;

use Semitexa\Platform\Wm\Attributes\AsWmApp;

/** Demo WM app registered by platform-wm for desktop entry. */
#[AsWmApp(id: 'welcome', title: 'Welcome', entryUrl: '/platform/welcome')]
final class WelcomeWmApp
{
}
