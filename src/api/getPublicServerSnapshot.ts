import { getWorldPlayers } from "../game/playerIdentity";
import { getCurrentGameState } from "../state/gameState";

export type PublicServerSnapshot = {
    readonly gameStatus: "lobby" | "running" | "ended";
    readonly connectedPlayers: number;
    readonly startedAtUnixMs?: number;
    readonly endedAtUnixMs?: number;
};

/**
 * Returns only the non-sensitive state that an optional hosting adapter may
 * publish. This API is environment-neutral and does not perform any network
 * access, so GameManager remains usable in ordinary local worlds.
 */
export function handleGetPublicServerSnapshot(): PublicServerSnapshot {
    const game = getCurrentGameState();

    return {
        gameStatus: game?.status ?? "lobby",
        connectedPlayers: getWorldPlayers().length,
        startedAtUnixMs: game?.startedAtUnixMs,
        endedAtUnixMs: game?.endedAtUnixMs,
    };
}
