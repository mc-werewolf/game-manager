import { Player, ProjectileHitEntityAfterEvent, world } from "@minecraft/server";
import { BaseEventHandler } from "../../events/BaseEventHandler";
import type { InGameEventManager } from "./InGameEventManager";
import { MinecraftEntityTypes } from "@minecraft/vanilla-data";

export class InGameProjectileHitEntityHandler extends BaseEventHandler<
    undefined,
    ProjectileHitEntityAfterEvent
> {
    private constructor(private readonly inGameEventManager: InGameEventManager) {
        super(inGameEventManager);
    }
    public static create(inGameEventManager: InGameEventManager): InGameProjectileHitEntityHandler {
        return new InGameProjectileHitEntityHandler(inGameEventManager);
    }

    protected afterEvent = world.afterEvents.projectileHitEntity;

    protected handleAfter(ev: ProjectileHitEntityAfterEvent): void {
        const { dimension, hitVector, projectile, source } = ev;

        if (source?.typeId !== MinecraftEntityTypes.Player) return;
        if (projectile.typeId !== MinecraftEntityTypes.Arrow) return;
        if (ev.getEntityHit().entity?.typeId !== MinecraftEntityTypes.Player) return;
        const player = source as Player;
        player.playSound("random.orb");
    }
}
