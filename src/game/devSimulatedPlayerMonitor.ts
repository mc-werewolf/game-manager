import { router } from "@kairo-js/router";
import { handleApplyActions } from "../api/applyActions";
import { getCurrentGameState } from "../state/gameState";
import type { GamePlayerState, GameState } from "../types/gameState";

type DevToolsSessionSummary = {
    readonly players?: readonly DevSimulatedPlayerSummary[];
};

type DevSimulatedPlayerSummary = {
    readonly id?: unknown;
    readonly name?: unknown;
    readonly isValid?: unknown;
    readonly health?: unknown;
};

const DEV_BOT_NAME_PREFIX = "WerewolfDevBot";
const DEV_SIMULATED_PLAYER_DEATH_REASON = "dev_simulated_player";
const MONITOR_INTERVAL_TICKS = 5;

let monitorRunId: number | undefined;
let checking = false;

export function startDevSimulatedPlayerMonitor(): void {
    if (monitorRunId !== undefined) return;
    monitorRunId = router.runInterval(checkDevSimulatedPlayers, MONITOR_INTERVAL_TICKS);
}

function checkDevSimulatedPlayers(): void {
    if (checking) return;

    const state = getCurrentGameState();
    if (state?.status !== "running") {
        stopDevSimulatedPlayerMonitor();
        return;
    }

    checking = true;
    checkDevSimulatedPlayersAsync(state)
        .catch((err) => {
            console.warn("[game-manager] Failed to check dev simulated players:", err);
        })
        .finally(() => {
            checking = false;
        });
}

async function checkDevSimulatedPlayersAsync(state: GameState): Promise<void> {
    if (getCurrentGameState() !== state || state.status !== "running") return;

    const session = await getDevToolsSession();
    if (!session?.players) return;

    for (const playerState of Object.values(state.players)) {
        if (!playerState.isAlive || !isDevBot(playerState)) continue;

        const devPlayer = findDevPlayer(session.players, playerState);
        if (!devPlayer || !isDeadDevPlayer(devPlayer)) continue;

        applyDevSimulatedPlayerDeath(state, playerState.playerId, playerState.name);
    }
}

async function getDevToolsSession(): Promise<DevToolsSessionSummary | undefined> {
    try {
        const session = await router.request<DevToolsSessionSummary | undefined>(
            "werewolf-dev-tools",
            "werewolf-dev-tools:simulatedPlayers.list",
            undefined,
            { timeout: 5 },
        );
        if (isCanceledResult(session)) return undefined;
        return session;
    } catch {
        return undefined;
    }
}

function findDevPlayer(
    players: readonly DevSimulatedPlayerSummary[],
    playerState: GamePlayerState,
): DevSimulatedPlayerSummary | undefined {
    return players.find((player) =>
        matchesUnknownString(player.id, playerState.playerId)
        || matchesUnknownString(player.id, playerState.name)
        || matchesUnknownString(player.name, playerState.playerId)
        || matchesUnknownString(player.name, playerState.name)
    );
}

function isDeadDevPlayer(player: DevSimulatedPlayerSummary): boolean {
    const isValid = typeof player.isValid === "boolean" ? player.isValid : true;
    const health = typeof player.health === "number" ? player.health : undefined;
    return !isValid || (health !== undefined && health <= 0);
}

function applyDevSimulatedPlayerDeath(state: GameState, playerId: string, playerName: string): void {
    if (getCurrentGameState() !== state || state.status !== "running") return;
    if (!state.players[playerId]?.isAlive) return;

    console.warn(`[game-manager] Dev simulated player is dead; marking dead: ${playerName} (${playerId})`);
    handleApplyActions({
        actions: [{ type: "kill", targetId: playerId, reason: DEV_SIMULATED_PLAYER_DEATH_REASON }],
    });
}

function stopDevSimulatedPlayerMonitor(): void {
    if (monitorRunId !== undefined) {
        router.clearRun(monitorRunId);
        monitorRunId = undefined;
    }
}

function isDevBot(playerState: GamePlayerState): boolean {
    return playerState.name.startsWith(DEV_BOT_NAME_PREFIX);
}

function matchesUnknownString(value: unknown, expected: string): boolean {
    return typeof value === "string" && value === expected;
}

function isCanceledResult(value: unknown): value is { readonly canceled: unknown } {
    return typeof value === "object" && value !== null && "canceled" in value;
}
