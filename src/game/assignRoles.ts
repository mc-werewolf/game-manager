import type { Player } from "@minecraft/server";
import type { GameConfigSnapshot } from "../types/gameConfigSnapshot";
import type { GamePlayerState } from "../types/gameState";

export function assignRoles(players: readonly Player[], snapshot: GameConfigSnapshot): Record<string, GamePlayerState> {
    const rolePool = createRolePool(snapshot);
    if (rolePool.length === 0) {
        throw new Error("[game-manager] Cannot start game because no roles are selected");
    }
    if (rolePool.length !== players.length) {
        throw new Error(`[game-manager] Role count (${rolePool.length}) must match player count (${players.length})`);
    }

    const shuffledRoles = shuffle(rolePool);
    const result: Record<string, GamePlayerState> = {};
    for (let i = 0; i < players.length; i++) {
        const player = players[i]!;
        const roleId = shuffledRoles[i]!;
        const role = snapshot.roles[roleId];
        if (!role) {
            throw new Error(`[game-manager] Selected role "${roleId}" is not registered`);
        }
        result[player.id] = {
            playerId: player.id,
            name: player.name,
            roleId,
            factionId: role.faction,
            isAlive: true,
            isLeft: false,
            statuses: {},
        };
    }
    return result;
}

function createRolePool(snapshot: GameConfigSnapshot): string[] {
    const rolePool: string[] = [];
    for (const [roleId, count] of Object.entries(snapshot.roleComposition)) {
        if (count <= 0) continue;
        for (let i = 0; i < count; i++) {
            rolePool.push(roleId);
        }
    }
    return rolePool;
}

function shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
}

