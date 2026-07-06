import type { GameConfigSnapshot } from "./gameConfigSnapshot";

export type GameState = {
    status: "running" | "ended";
    readonly startedAtTick: number;
    endedAtTick: number | undefined;
    winnerFactionIds: readonly string[];
    readonly snapshot: GameConfigSnapshot;
    readonly players: Record<string, GamePlayerState>;
};

export type GamePlayerState = {
    readonly playerId: string;
    readonly name: string;
    readonly roleId: string;
    readonly factionId: string;
    isAlive: boolean;
    isLeft: boolean;
    readonly statuses: Record<string, unknown>;
};
