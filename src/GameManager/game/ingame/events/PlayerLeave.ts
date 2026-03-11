import {
    GameMode,
    PlayerLeaveAfterEvent,
    PlayerLeaveBeforeEvent,
    system,
    world,
} from "@minecraft/server";
import { BaseEventHandler } from "../../events/BaseEventHandler";
import type { InGameEventManager } from "./InGameEventManager";

export class InGamePlayerLeaveHandler extends BaseEventHandler<
    PlayerLeaveBeforeEvent,
    PlayerLeaveAfterEvent
> {
    private constructor(private readonly inGameEventManager: InGameEventManager) {
        super(inGameEventManager);
    }
    public static create(inGameEventManager: InGameEventManager): InGamePlayerLeaveHandler {
        return new InGamePlayerLeaveHandler(inGameEventManager);
    }

    protected beforeEvent = world.beforeEvents.playerLeave;
    protected afterEvent = world.afterEvents.playerLeave;

    protected handleBefore(ev: PlayerLeaveBeforeEvent): void {
        const { player } = ev;
        const gameManager = this.inGameEventManager.getInGameManager().getGameManager();

        const playerData = gameManager.getPlayerData(player.id);
        if (!playerData) return;

        playerData.isLeave = true;
        playerData.isAlive = false;
        system.run(() => {
            if (player.isValid) {
                player.setGameMode(GameMode.Spectator);
            }
        });
    }
    protected handleAfter(ev: PlayerLeaveAfterEvent): void {}
}
