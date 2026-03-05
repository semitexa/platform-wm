<?php

declare(strict_types=1);

namespace Semitexa\Platform\Wm\Domain\Contract;

/**
 * Contract for reading and writing WM window state (session-backed in MVP).
 */
interface WmStateServiceInterface
{
    /** @return list<array<string, mixed>> */
    public function getWindows(): array;

    public function addWindow(string $appId, array $context = []): array;

    public function validateUpdates(array $updates): ?string;

    public function updateWindow(string $id, array $updates): ?array;

    public function removeWindow(string $id): ?array;

    public function getWindow(string $id): ?array;

    /** @param list<string> $windowIds */
    public function groupWindows(array $windowIds): string;

    public function ungroupWindow(string $id): ?array;
}
