import { saveRoleComposition } from "../persistence/gameManagerPersistence";
import { getCurrentGameState } from "../state/gameState";
import { roleCountSettings } from "../state/roleCountSettings";
import { skillOperationRegistry } from "../registry/skillOperationRegistry";
import type { GameState } from "../types/gameState";
import { prepareGameStart } from "../game/startGame";
import { getGamePlayerId, getWorldPlayers, toGameStartPlayer, type GameStartPlayer } from "../game/playerIdentity";

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

function resolvePlayersById(playerIds: readonly unknown[]): GameStartPlayer[] {
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
    return requestedIds.map((playerId) => {
        const player = playersById.get(playerId);
        if (player) return toGameStartPlayer(player);
        return { playerId, name: playerId };
    });
}

export function handleDevGetGameState(): GameState | undefined {
    return getCurrentGameState();
}

export function handleDevClearSkillOperations(): void {
    skillOperationRegistry.clear();
}
