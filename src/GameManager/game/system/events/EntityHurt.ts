import {
    EntityComponentTypes,
    GameMode,
    Player,
    world,
    type EntityHurtAfterEvent,
} from "@minecraft/server";
import { BaseEventHandler } from "../../events/BaseEventHandler";
import type { SystemEventManager } from "./SystemEventManager";
import { MinecraftDimensionTypes } from "@minecraft/vanilla-data";

export class EntityHurtHandler extends BaseEventHandler<undefined, EntityHurtAfterEvent> {
    private constructor(private readonly systemEventManager: SystemEventManager) {
        super(systemEventManager);
    }
    public static create(systemEventManager: SystemEventManager): EntityHurtHandler {
        return new EntityHurtHandler(systemEventManager);
    }

    protected afterEvent = world.afterEvents.entityHurt;

    protected handleAfter(ev: EntityHurtAfterEvent): void {
        // entityHurtBefore が実装されたら、spawnの仕組みをもう一度試みる。
        // とりあえずは root index.ts で、onTick 連打する
        // const { damage, damageSource, hurtEntity } = ev;
        // if (!(hurtEntity instanceof Player)) return;
        // const hurtPlayer = hurtEntity as Player;
        // const hurtPlayerHealthComponent = hurtPlayer.getComponent(EntityComponentTypes.Health);
        // if (!hurtPlayerHealthComponent) return;
        // if (hurtPlayerHealthComponent.currentValue === 0) {
        //     hurtPlayer.setSpawnPoint({
        //         dimension: world.getDimension(MinecraftDimensionTypes.Overworld),
        //         x: hurtPlayer.location.x,
        //         y: hurtPlayer.location.y,
        //         z: hurtPlayer.location.z,
        //     });
        // }
    }
}
