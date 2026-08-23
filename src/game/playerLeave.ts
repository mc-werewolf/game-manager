import type { PlayerLeaveAfterEvent } from "@minecraft/server";
import { router } from "@kairo-js/router";
import { getCurrentGameState } from "../state/gameState";
import { checkAndEndGame } from "./winConditions";

const PLAYER_LEAVE_DEATH_REASON = "leave";

export function handlePlayerLeave(ev: PlayerLeaveAfterEvent): void {
    const state = getCurrentGameState();
    if (state?.status !== "running") return;

    const playerId = findGamePlayerId(ev.playerId, ev.playerName);
    if (playerId === undefined) return;

    const playerState = state.players[playerId];
    if (!playerState) return;

    playerState.isLeft = true;
    if (!playerState.isAlive) return;

    playerState.isAlive = false;
    state.deathRecords.push({
        targetId: playerId,
        killerId: undefined,
        reason: PLAYER_LEAVE_DEATH_REASON,
        tick: router.currentTick,
    });

    router.emit("werewolf:playerLeft", {
        playerId,
        playerName: ev.playerName,
    });
    router.emit("werewolf:playerKilled", {
        playerId,
        killerId: undefined,
        reason: PLAYER_LEAVE_DEATH_REASON,
    });
    checkAndEndGame();
}

function findGamePlayerId(playerId: string, playerName: string): string | undefined {
    const state = getCurrentGameState();
    if (!state) return undefined;
    if (state.players[playerId] !== undefined) return playerId;
    return Object.values(state.players).find((player) => player.name === playerName)?.playerId;
}
