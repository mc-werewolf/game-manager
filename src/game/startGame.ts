import { world, type Player } from "@minecraft/server";
import { router, type CanceledResult } from "@kairo-js/router";
import { assignRoles } from "./assignRoles";
import { savePlayerProfiles } from "../persistence/gameManagerPersistence";
import { setCurrentGameConfigSnapshot } from "../state/gameConfigSnapshot";
import { getCurrentGameState, setCurrentGameState } from "../state/gameState";
import { participationState } from "../state/participationState";
import { playerProfiles } from "../state/playerProfiles";
import { skillUsageState } from "../state/skillUsageState";
import type { GameConfigSnapshot } from "../types/gameConfigSnapshot";
import type { GameState } from "../types/gameState";
import { borderedChatMessage } from "../ui/chat";
import { rawtext, text, tr, trWith } from "../ui/text";
import { playPlayerSound } from "../ui/sounds";
import { allowArrowProjectiles, clearArrowProjectiles, giveCombatItemsToAlivePlayers } from "./combat";
import { applyCountdownEffects, removeCountdownEffects } from "./countdownEffects";
import { startDevSimulatedPlayerMonitor } from "./devSimulatedPlayerMonitor";
import { applyGameStartGameModes } from "./gameModes";
import { getGamePlayerId, getWorldPlayers, toGameStartPlayer, type GameStartPlayer } from "./playerIdentity";
import { startRoleActionBar } from "./roleActionBar";
import { playGameStartPresentation } from "./startPresentation";
import { giveGameItems } from "./playerItems";

type DevToolsSessionSummary = {
    readonly players?: readonly {
        readonly id?: unknown;
        readonly name?: unknown;
    }[];
};

const COUNTDOWN_SECONDS = 10;
const ROLE_REVEAL_SECONDS = 3;
const ROLE_REVEAL_KEY = "werewolf-gamemanager.game.start.role.reveal";
const COUNTDOWN_NORMAL_KEY = "werewolf-gamemanager.game.start.countdown.normal";
const COUNTDOWN_CHAT_KEY = "werewolf-gamemanager.game.start.countdown.warning";
const COUNTDOWN_START_KEY = "werewolf-gamemanager.game.start.countdown.start";
const COUNTDOWN_NORMAL_SOUND = "note.hat";
const COUNTDOWN_WARNING_SOUND = "random.orb";
const COUNTDOWN_START_SOUND = "random.levelup";

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
        gameplayStarted: false,
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
    allowArrowProjectiles();
    clearArrowProjectiles();
    setCurrentGameState(state);
    applyGameStartGameModes(state);
    router.emit("werewolf:beforeGameStart", state);
    playGameStartPresentation(players, () => {
        if (getCurrentGameState() !== state || state.status !== "running") return;
        notifyRoleAssignments(state);
        startPreparationCountdown(state);
    });
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
    const spectatorIds = new Set(participationState.getSpectatorIds());
    return combinedPlayers.filter((player) => !spectatorIds.has(player.playerId));
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
        const playerState = state.players[getGamePlayerId(player)];
        if (!playerState) continue;
        const role = state.snapshot.roles[playerState.roleId];
        const roleMessage = trWith(ROLE_REVEAL_KEY, roleName(state.snapshot, role, playerState.roleId));
        player.onScreenDisplay.setTitle(roleMessage, {
            subtitle: trWith(COUNTDOWN_NORMAL_KEY, [String(COUNTDOWN_SECONDS)]),
            fadeInDuration: 0,
            stayDuration: ROLE_REVEAL_SECONDS * 20,
            fadeOutDuration: 20,
        });
        player.sendMessage(borderedChatMessage([roleMessage]));
    }
}

function startPreparationCountdown(state: GameState): void {
    applyCountdownEffects(state);
    for (let seconds = COUNTDOWN_SECONDS; seconds >= 0; seconds -= 1) {
        router.runTimeout(() => {
            if (getCurrentGameState() !== state || state.status !== "running") return;
            showCountdown(seconds);
        }, (COUNTDOWN_SECONDS - seconds) * 20);
    }
}

function showCountdown(seconds: number): void {
    for (const player of getWorldPlayers()) {
        try {
            if (seconds > 0) {
                player.sendMessage(trWith(COUNTDOWN_CHAT_KEY, [String(seconds)]));
                playPlayerSound(player, seconds <= 3 ? COUNTDOWN_WARNING_SOUND : COUNTDOWN_NORMAL_SOUND, undefined, "countdown sound");
            } else {
                player.sendMessage(tr(COUNTDOWN_START_KEY));
                playPlayerSound(player, COUNTDOWN_START_SOUND, undefined, "countdown start sound");
            }
        } catch (err) {
            console.warn("[game-manager] Failed to show game start countdown:", err);
        }
    }
    if (seconds === 1) {
        const state = getCurrentGameState();
        if (state?.status === "running") {
            removeCountdownEffects(state);
        }
    }
    if (seconds === 0) {
        const state = getCurrentGameState();
        if (state?.status === "running") {
            state.gameplayStarted = true;
            removeCountdownEffects(state);
            enablePvp();
            startRoleActionBar(state);
            startDevSimulatedPlayerMonitor();
            giveGameItemsToPlayers(state);
            giveCombatItemsToAlivePlayers(state);
        }
    }
}

function giveGameItemsToPlayers(state: GameState): void {
    for (const player of getWorldPlayers()) {
        if (state.players[getGamePlayerId(player)] === undefined) continue;
        giveGameItems(player);
    }
}

function enablePvp(): void {
    try {
        world.gameRules.pvp = true;
    } catch (err) {
        console.warn("[game-manager] Failed to enable PvP:", err);
    }
}

function roleName(snapshot: GameConfigSnapshot, role: GameState["snapshot"]["roles"][string] | undefined, fallbackRoleId: string) {
    const color = role?.color ?? (role?.faction ? snapshot.factions[role.faction]?.color : undefined) ?? "\u00a7f";
    return rawtext([
        text(color),
        tr(role?.name ?? fallbackRoleId),
        text("\u00a7r"),
    ]);
}
