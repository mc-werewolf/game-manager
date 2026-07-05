import { type Player, world } from "@minecraft/server";
import { router, type CanceledResult } from "@kairo-js/router";
import { assignRoles } from "./assignRoles";
import { givePlayerSkillItem } from "./playerItems";
import { T } from "../constants/translate";
import { setCurrentGameConfigSnapshot } from "../state/gameConfigSnapshot";
import { getCurrentGameState, setCurrentGameState } from "../state/gameState";
import { participationState } from "../state/participationState";
import { skillUsageState } from "../state/skillUsageState";
import type { GameConfigSnapshot } from "../types/gameConfigSnapshot";
import type { GameState } from "../types/gameState";
import { rawtext, text, tr } from "../ui/text";

export async function prepareGameStart(playersOverride?: readonly Player[]): Promise<GameState | undefined> {
    const currentState = getCurrentGameState();
    if (currentState?.status === "running") {
        throw new Error("[game-manager] Cannot start a new game while another game is running");
    }

    const result = await router.request<GameConfigSnapshot>("werewolf-gamemanager", "werewolf:resolveGameConfig");
    if (isCanceledResult(result)) return undefined;

    setCurrentGameConfigSnapshot(result);
    router.emit("werewolf:gameConfigResolved", result);

    const players = playersOverride ?? getStartingPlayers();
    const state: GameState = {
        status: "running",
        startedAtTick: router.currentTick,
        endedAtTick: undefined,
        winnerFactionIds: [],
        snapshot: result,
        players: assignRoles(players, result),
    };
    skillUsageState.clear();
    setCurrentGameState(state);
    router.emit("werewolf:beforeGameStart", state);
    notifyRoleAssignments(state);
    router.emit("werewolf:afterGameStart", state);
    console.warn("[game-manager] Game state started. Phase progression is not implemented yet.");
    return state;
}

function getStartingPlayers(): Player[] {
    const players = world.getPlayers();
    if (!participationState.hasExplicitParticipants()) return players;

    const participantIds = new Set(participationState.getParticipantIds());
    return players.filter((player) => participantIds.has(player.id));
}

function isCanceledResult(value: GameConfigSnapshot | CanceledResult): value is CanceledResult {
    return typeof value === "object" && value !== null && "canceled" in value;
}

function notifyRoleAssignments(state: GameState): void {
    for (const player of world.getPlayers()) {
        const playerState = state.players[player.id];
        if (!playerState) continue;
        const role = state.snapshot.roles[playerState.roleId];
        givePlayerSkillItem(player);
        player.sendMessage(rawtext([
            tr(T.game.roleAssigned),
            text(" "),
            tr(role?.name ?? playerState.roleId),
        ]));
    }
}
