import type { GameConfigSnapshot } from "./gameConfigSnapshot";

export type GameState = {
    status: "running" | "ended";
    readonly startedAtTick: number;
    readonly startedAtUnixMs: number;
    endedAtTick: number | undefined;
    endedAtUnixMs: number | undefined;
    winnerFactionIds: readonly string[];
    readonly snapshot: GameConfigSnapshot;
    readonly players: Record<string, GamePlayerState>;
    readonly deathRecords: GameDeathRecord[];
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

export type GameDeathRecord = {
    readonly targetId: string;
    readonly killerId: string | undefined;
    readonly reason: string | undefined;
    readonly tick: number;
};
