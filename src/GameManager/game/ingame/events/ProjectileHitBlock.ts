import { ProjectileHitBlockAfterEvent, system, world } from "@minecraft/server";
import { BaseEventHandler } from "../../events/BaseEventHandler";
import type { InGameEventManager } from "./InGameEventManager";
import { MinecraftEntityTypes } from "@minecraft/vanilla-data";

export class InGameProjectileHitBlockHandler extends BaseEventHandler<
    undefined,
    ProjectileHitBlockAfterEvent
> {
    private constructor(private readonly inGameEventManager: InGameEventManager) {
        super(inGameEventManager);
    }
    public static create(inGameEventManager: InGameEventManager): InGameProjectileHitBlockHandler {
        return new InGameProjectileHitBlockHandler(inGameEventManager);
    }

    protected afterEvent = world.afterEvents.projectileHitBlock;

    protected handleAfter(ev: ProjectileHitBlockAfterEvent): void {
        const { dimension, hitVector, projectile, source } = ev;

        if (source?.typeId !== MinecraftEntityTypes.Player) return;
        if (projectile.typeId !== MinecraftEntityTypes.Arrow) return;

        system.runTimeout(() => {
            if (projectile.isValid) {
                projectile.remove();
            }
        }, 5);
    }
}
