import { saveRoleComposition } from "../persistence/gameManagerPersistence";
import { getCurrentGameState } from "../state/gameState";
import { roleCountSettings } from "../state/roleCountSettings";
import { skillOperationRegistry } from "../registry/skillOperationRegistry";
import type { GameState } from "../types/gameState";
import { prepareGameStart } from "../game/startGame";
import type { Player } from "@minecraft/server";
import { getGamePlayerId, getWorldPlayers } from "../game/playerIdentity";

type DevSetRoleCompositionArgs = {
    readonly roleComposition: Record<string, number>;
    readonly persist?: boolean;
};

export function handleDevSetRoleComposition(args: DevSetRoleCompositionArgs): void {
    roleCountSettings.replaceAll(args.roleComposition);
    if (args.persist) {
        saveRoleComposition();
    }
}

type DevStartGameArgs = {
    readonly playerIds?: readonly unknown[];
};

export async function handleDevStartGame(args?: DevStartGameArgs): Promise<GameState | undefined> {
    const players = args?.playerIds
        ? resolvePlayersById(args.playerIds)
        : undefined;
    return prepareGameStart(players);
}

function resolvePlayersById(playerIds: readonly unknown[]): Player[] {
    const requestedIds = [...new Set(playerIds.map((playerId) => {
        if (typeof playerId !== "string" || playerId.trim().length === 0) {
            throw new Error("[game-manager] Dev start received an invalid player id");
        }
        return playerId;
    }))];
    const playersById = new Map(getWorldPlayers().flatMap((player) => [
        [getGamePlayerId(player), player] as const,
        [player.name, player] as const,
    ]));
    const missingIds = requestedIds.filter((playerId) => !playersById.has(playerId));
    if (missingIds.length > 0) {
        throw new Error(`[game-manager] Dev start players are not available yet: ${missingIds.join(", ")}`);
    }
    return requestedIds.map((playerId) => playersById.get(playerId)!);
}

export function handleDevGetGameState(): GameState | undefined {
    return getCurrentGameState();
}

export function handleDevClearSkillOperations(): void {
    skillOperationRegistry.clear();
}
