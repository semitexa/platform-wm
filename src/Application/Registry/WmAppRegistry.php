<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Registry;

use Semitexa\Core\Discovery\ClassDiscovery;
use Semitexa\Platform\Wm\Domain\Model\WmAppDescriptor;
use Semitexa\Platform\Wm\Application\Attribute\AsWmApp;

/**
 * Discovers and returns all WM apps registered via #[AsWmApp] in modules.
 */
final class WmAppRegistry
{
    /** @var list<WmAppDescriptor>|null */
    private static ?array $apps = null;

    /**
     * @return list<WmAppDescriptor>
     */
    public static function all(): array
    {
        if (self::$apps !== null) {
            return self::$apps;
        }

        $classes = ClassDiscovery::findClassesWithAttribute(AsWmApp::class);
        $list = [];

        foreach ($classes as $class) {
            try {
                $reflection = new \ReflectionClass($class);
                $attrs = $reflection->getAttributes(AsWmApp::class);
                if ($attrs === []) {
                    continue;
                }
                /** @var AsWmApp $attr */
                $attr = $attrs[0]->newInstance();
                $list[] = new WmAppDescriptor(
                    id: $attr->id,
                    title: $attr->title,
                    entryUrl: $attr->entryUrl,
                    icon: $attr->icon,
                    permission: $attr->permission,
                );
            } catch (\Throwable) {
                continue;
            }
        }

        self::$apps = $list;
        return self::$apps;
    }

    public static function get(string $id): ?WmAppDescriptor
    {
        foreach (self::all() as $app) {
            if ($app->id === $id) {
                return $app;
            }
        }
        return null;
    }

    public static function reset(): void
    {
        self::$apps = null;
    }
}
