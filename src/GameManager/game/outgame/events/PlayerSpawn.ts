import { PlayerSpawnAfterEvent, world } from "@minecraft/server";
import { BaseEventHandler } from "../../events/BaseEventHandler";
import type { OutGameEventManager } from "./OutGameEventManager";
import { KairoUtils } from "@kairo-js/router";

export class OutGamePlayerSpawnHandler extends BaseEventHandler<undefined, PlayerSpawnAfterEvent> {
    private constructor(private readonly outGameEventManager: OutGameEventManager) {
        super(outGameEventManager);
    }
    public static create(outGameEventManager: OutGameEventManager): OutGamePlayerSpawnHandler {
        return new OutGamePlayerSpawnHandler(outGameEventManager);
    }

    protected afterEvent = world.afterEvents.playerSpawn;

    protected async handleAfter(ev: PlayerSpawnAfterEvent): Promise<void> {
        const { initialSpawn, player } = ev;

        const players = world.getPlayers();
        const alivePlayerIds = new Set(players.map((p) => p.id));
        const playersKairoData = (await KairoUtils.getPlayersKairoData())
            .filter((data) => alivePlayerIds.has(data.playerId))
            .sort((a, b) => a.joinOrder - b.joinOrder);

        const leaderPlayerId = playersKairoData[0]?.playerId;
        const isLeader = player.id === leaderPlayerId;

        this.outGameEventManager.getOutGameManager().initializePlayer(player, isLeader);
    }
}
