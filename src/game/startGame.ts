import { type Player, world } from "@minecraft/server";
import { router, type CanceledResult } from "@kairo-js/router";
import { assignRoles } from "./assignRoles";
import { clearPlayerItems } from "./playerItems";
import { T } from "../constants/translate";
import { savePlayerProfiles } from "../persistence/gameManagerPersistence";
import { setCurrentGameConfigSnapshot } from "../state/gameConfigSnapshot";
import { getCurrentGameState, setCurrentGameState } from "../state/gameState";
import { participationState } from "../state/participationState";
import { playerProfiles } from "../state/playerProfiles";
import { skillUsageState } from "../state/skillUsageState";
import type { GameConfigSnapshot } from "../types/gameConfigSnapshot";
import type { GameState } from "../types/gameState";
import { rawtext, text, tr } from "../ui/text";
import { getGamePlayerId } from "./playerIdentity";

export async function prepareGameStart(playersOverride?: readonly Player[]): Promise<GameState | undefined> {
    if (playerProfiles.applySeasonTransition()) {
        savePlayerProfiles();
    }
    const currentState = getCurrentGameState();
    if (currentState?.status === "running") {
        throw new Error("[game-manager] Cannot start a new game while another game is running");
    }

    const result = await router.request<GameConfigSnapshot>("werewolf-gamemanager", "werewolf:resolveGameConfig");
    if (isCanceledResult(result)) return undefined;

    setCurrentGameConfigSnapshot(result);
    router.emit("werewolf:gameConfigResolved", result);

    const players = normalizeStartingPlayers(playersOverride ?? getStartingPlayers());
    const state: GameState = {
        status: "running",
        startedAtTick: router.currentTick,
        startedAtUnixMs: Date.now(),
        endedAtTick: undefined,
        endedAtUnixMs: undefined,
        winnerFactionIds: [],
        snapshot: result,
        players: assignRoles(players, result),
        deathRecords: [],
    };
    skillUsageState.clear();
    setCurrentGameState(state);
    router.emit("werewolf:beforeGameStart", state);
    notifyRoleAssignments(state);
    router.emit("werewolf:afterGameStart", state);
    console.warn("[game-manager] Game state started. Phase progression is not implemented yet.");
    return state;
}

function normalizeStartingPlayers(players: readonly Player[]): Player[] {
    const result: Player[] = [];
    const seenIds = new Set<string>();
    for (const player of players) {
        if (!player) {
            throw new Error("[game-manager] Cannot start game because a player could not be resolved");
        }
        const playerId = getGamePlayerId(player);
        if (seenIds.has(playerId)) continue;
        seenIds.add(playerId);
        result.push(player);
    }
    if (result.length === 0) {
        throw new Error("[game-manager] Cannot start game because no players are available");
    }
    return result;
}

function getStartingPlayers(): Player[] {
    const players = world.getPlayers();
    if (!participationState.hasExplicitParticipants()) {
        if (!participationState.hasSpectators()) return players;

        const spectatorIds = new Set(participationState.getSpectatorIds());
        return players.filter((player) => !spectatorIds.has(getGamePlayerId(player)));
    }

    const participantIds = new Set(participationState.getParticipantIds());
    return players.filter((player) => participantIds.has(getGamePlayerId(player)));
}

function isCanceledResult(value: GameConfigSnapshot | CanceledResult): value is CanceledResult {
    return typeof value === "object" && value !== null && "canceled" in value;
}

function notifyRoleAssignments(state: GameState): void {
    for (const player of world.getPlayers()) {
        clearPlayerItems(player);

        const playerState = state.players[getGamePlayerId(player)];
        if (!playerState) continue;
        const role = state.snapshot.roles[playerState.roleId];
        player.sendMessage(rawtext([
            tr(T.game.roleAssigned),
            text(" "),
            tr(role?.name ?? playerState.roleId),
        ]));
    }
}
