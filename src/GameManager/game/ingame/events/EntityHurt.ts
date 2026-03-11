import {
    EntityComponentTypes,
    GameMode,
    Player,
    world,
    type EntityHurtAfterEvent,
} from "@minecraft/server";
import { BaseEventHandler } from "../../events/BaseEventHandler";
import type { InGameEventManager } from "./InGameEventManager";
import { GamePhase } from "../GamePhase";
import { WEREWOLF_GAMEMANAGER_TRANSLATE_IDS } from "../../../constants/translate";
import { MinecraftEntityTypes } from "@minecraft/vanilla-data";

export class InGameEntityHurtHandler extends BaseEventHandler<undefined, EntityHurtAfterEvent> {
    private constructor(private readonly inGameEventManager: InGameEventManager) {
        super(inGameEventManager);
    }
    public static create(inGameEventManager: InGameEventManager): InGameEntityHurtHandler {
        return new InGameEntityHurtHandler(inGameEventManager);
    }

    protected afterEvent = world.afterEvents.entityHurt;

    protected handleAfter(ev: EntityHurtAfterEvent): void {
        const { damage, damageSource, hurtEntity } = ev;
        const currentGamePhase = this.inGameEventManager.getInGameManager().getCurrentPhase();
        if (currentGamePhase !== GamePhase.InGame) return;

        const gameManager = this.inGameEventManager.getInGameManager().getGameManager();

        if (!(hurtEntity instanceof Player)) return;
        const hurtPlayer = hurtEntity as Player;
        const hurtPlayerHealthComponent = hurtPlayer.getComponent(EntityComponentTypes.Health);
        const hurtPlayerData = gameManager.getPlayerData(hurtPlayer.id);
        if (!hurtPlayerData || !hurtPlayerHealthComponent) return;

        if (hurtPlayerHealthComponent.currentValue === 0) {
            hurtPlayerData.isAlive = false;
            hurtPlayer.nameTag = `§b${hurtPlayer.name}§r`;
            hurtPlayer.setGameMode(GameMode.Spectator);

            if (damageSource.damagingEntity === undefined) return;
            if (damageSource.damagingEntity.typeId !== MinecraftEntityTypes.Player) return;
            const hitPlayer = damageSource.damagingEntity as Player;

            if (hitPlayer.id === hurtPlayer.id) {
                hurtPlayer.sendMessage({
                    translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_SELF_KILL_MESSAGE,
                });
            } else {
                hurtPlayer.sendMessage({
                    translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_SLAIN_MESSAGE,
                    with: [damageSource.damagingEntity.nameTag],
                });

                if (damageSource.damagingProjectile?.typeId === MinecraftEntityTypes.Arrow) {
                    const hitPlayerData = gameManager.getPlayerData(hitPlayer.id);
                    hitPlayerData.tmpArrowCooldown = 15;

                    const inventory = hitPlayer.getComponent(EntityComponentTypes.Inventory);
                    if (!inventory) return;

                    inventory.container.setItem(0, undefined);
                }
            }
        }
    }
}
