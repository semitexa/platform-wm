<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Application\Handler\PayloadHandler;

use Psr\Container\ContainerInterface;
use Semitexa\Core\Attributes\AsPayloadHandler;
use Semitexa\Core\Attributes\InjectAsReadonly;
use Semitexa\Core\Auth\AuthContextInterface;
use Semitexa\Core\Contract\TypedHandlerInterface;
use Semitexa\Core\Http\Response\GenericResponse;
use Semitexa\Platform\Wm\Application\Payload\Request\WmAppsPayload;
use Semitexa\Platform\Wm\Application\Registry\WmAppRegistry;

#[AsPayloadHandler(payload: WmAppsPayload::class, resource: GenericResponse::class)]
final class WmAppsHandler implements TypedHandlerInterface
{
    #[InjectAsReadonly]
    protected AuthContextInterface $auth;

    #[InjectAsReadonly]
    protected ?ContainerInterface $container = null;

    public function handle(WmAppsPayload $payload, GenericResponse $resource): GenericResponse
    {
        $user = $this->auth->getUser();
        $rbac = $this->resolveRbac();
        $apps = WmAppRegistry::all();

        $visible = array_filter(
            $apps,
            function ($app) use ($user, $rbac): bool {
                if ($app->permission === null) {
                    return true;
                }
                if ($user === null || $rbac === null) {
                    return false;
                }
                return $rbac->userHasPermission($user->getId(), $app->permission);
            },
        );

        $data = array_map(static fn ($d) => $d->toArray(), array_values($visible));
        $resource->setContext(['apps' => $data]);
        return $resource;
    }

    private function resolveRbac(): ?object
    {
        $rbacClass = 'Semitexa\\Platform\\User\\Domain\\Service\\RbacServiceInterface';
        if (!interface_exists($rbacClass) && !class_exists($rbacClass)) {
            return null;
        }
        try {
            return $this->container?->get($rbacClass);
        } catch (\Throwable) {
            return null;
        }
    }
}
