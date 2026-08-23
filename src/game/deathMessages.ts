import { T } from "../constants/translate";
import type { GameState } from "../types/gameState";
import { trWith } from "../ui/text";
import { getWorldPlayers, matchesGamePlayerId } from "./playerIdentity";

type DeathMessageDefinition = {
    readonly killerMessage?: string;
    readonly targetMessage?: string;
};

const attackDeathMessage: DeathMessageDefinition = {
    killerMessage: T.game.death.attackKiller,
    targetMessage: T.game.death.attackTarget,
};

const deathMessageDefinitions: Readonly<Record<string, DeathMessageDefinition>> = {
    arrow: attackDeathMessage,
    "vanilla:werewolfAttack": attackDeathMessage,
};

export function sendDeathMessages(
    state: GameState,
    targetId: string,
    killerId: string | undefined,
    reason: string | undefined,
): void {
    if (!reason || !killerId || killerId === targetId) return;

    const definition = deathMessageDefinitions[reason];
    if (!definition) return;

    const targetState = state.players[targetId];
    const killerState = state.players[killerId];
    if (!targetState || !killerState) return;

    const target = findPlayer(targetId);
    if (target && definition.targetMessage) {
        target.sendMessage(trWith(definition.targetMessage, [killerState.name]));
    }

    const killer = findPlayer(killerId);
    if (killer && definition.killerMessage) {
        killer.sendMessage(trWith(definition.killerMessage, [targetState.name]));
    }
}

function findPlayer(playerId: string) {
    return getWorldPlayers().find((player) => matchesGamePlayerId(player, playerId));
}
