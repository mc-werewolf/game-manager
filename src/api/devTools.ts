import { saveRoleComposition } from "../persistence/gameManagerPersistence";
import { getCurrentGameState } from "../state/gameState";
import { roleCountSettings } from "../state/roleCountSettings";
import { skillOperationRegistry } from "../registry/skillOperationRegistry";
import type { GameState } from "../types/gameState";
import { prepareGameStart } from "../game/startGame";
import { world } from "@minecraft/server";

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
    readonly playerIds?: readonly string[];
};

export async function handleDevStartGame(args?: DevStartGameArgs): Promise<GameState | undefined> {
    const players = args?.playerIds
        ? world.getPlayers().filter((player) => args.playerIds!.includes(player.id))
        : undefined;
    return prepareGameStart(players);
}

export function handleDevGetGameState(): GameState | undefined {
    return getCurrentGameState();
}

export function handleDevClearSkillOperations(): void {
    skillOperationRegistry.clear();
}
