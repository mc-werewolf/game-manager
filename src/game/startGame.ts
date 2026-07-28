import type { Player } from "@minecraft/server";
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
import { getGamePlayerId, getWorldPlayers, toGameStartPlayer, type GameStartPlayer } from "./playerIdentity";

type DevToolsSessionSummary = {
    readonly players?: readonly {
        readonly id?: unknown;
        readonly name?: unknown;
    }[];
};

export async function prepareGameStart(playersOverride?: readonly (Player | GameStartPlayer)[]): Promise<GameState | undefined> {
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

    const players = normalizeStartingPlayers(playersOverride ? playersOverride.map(normalizeStartPlayerInput) : await getStartingPlayers());
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

function normalizeStartingPlayers(players: readonly GameStartPlayer[]): GameStartPlayer[] {
    const result: GameStartPlayer[] = [];
    const seenIds = new Set<string>();
    for (const player of players) {
        if (!player || !player.playerId || !player.name) {
            throw new Error("[game-manager] Cannot start game because a player could not be resolved");
        }
        const playerId = player.playerId;
        if (seenIds.has(playerId)) continue;
        seenIds.add(playerId);
        result.push(player);
    }
    if (result.length === 0) {
        throw new Error("[game-manager] Cannot start game because no players are available");
    }
    return result;
}

function normalizeStartPlayerInput(player: Player | GameStartPlayer): GameStartPlayer {
    if ("playerId" in player) return player;
    return toGameStartPlayer(player);
}

async function getStartingPlayers(): Promise<GameStartPlayer[]> {
    const players = getWorldPlayers().map(toGameStartPlayer);
    const devPlayers = await getDevToolsSimulatedPlayers();
    const combinedPlayers = [...players, ...devPlayers];
    if (!participationState.hasExplicitParticipants()) {
        if (!participationState.hasSpectators()) return combinedPlayers;

        const spectatorIds = new Set(participationState.getSpectatorIds());
        return combinedPlayers.filter((player) => !spectatorIds.has(player.playerId));
    }

    const participantIds = new Set(participationState.getParticipantIds());
    return combinedPlayers.filter((player) => participantIds.has(player.playerId));
}

async function getDevToolsSimulatedPlayers(): Promise<GameStartPlayer[]> {
    try {
        const session = await router.request<DevToolsSessionSummary | undefined>(
            "werewolf-dev-tools",
            "werewolf-dev-tools:simulatedPlayers.list",
            undefined,
            { timeout: 5 },
        );
        if (isCanceledResult(session) || !session?.players) return [];
        return session.players.flatMap((player) => {
            const name = typeof player.name === "string" && player.name.trim().length > 0 ? player.name : undefined;
            if (!name) return [];
            const id = typeof player.id === "string" && player.id.trim().length > 0 ? player.id : name;
            return [{ playerId: id, name }];
        });
    } catch {
        return [];
    }
}

function isCanceledResult(value: unknown): value is CanceledResult {
    return typeof value === "object" && value !== null && "canceled" in value;
}

function notifyRoleAssignments(state: GameState): void {
    for (const player of getWorldPlayers()) {
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
