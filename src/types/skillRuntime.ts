import type { GameConfigSnapshot } from "./gameConfigSnapshot";
import type { GameState } from "./gameState";

export type ResolveSkillArgs = {
    readonly skillId: string;
    readonly actorId: string;
    readonly targetIds?: readonly string[];
    readonly snapshot?: GameConfigSnapshot;
    readonly metadata?: Record<string, unknown>;
};

export type ApplyActionsArgs = {
    readonly actions: readonly GameAction[];
    readonly context?: SkillContext;
};

export type ApplyActionsResult = {
    readonly applied: readonly AppliedGameAction[];
};

export type AppliedGameAction = {
    readonly action: GameAction;
    readonly applied: boolean;
    readonly reason?: string;
};

export type SkillContext = {
    readonly skillId: string;
    readonly actorId: string;
    readonly targetIds: readonly string[];
    readonly snapshot: GameConfigSnapshot;
    readonly game: GameState | undefined;
    readonly metadata?: Record<string, unknown>;
};

export type SkillResult = {
    readonly actions: readonly GameAction[];
    readonly messages?: readonly MessageGameAction[];
    readonly metadata?: Record<string, unknown>;
};

export type GameAction =
    | KillGameAction
    | ProtectGameAction
    | RevealGameAction
    | SetStatusGameAction
    | SendMessageGameAction
    | CustomGameAction;

export type KillGameAction = {
    readonly type: "kill";
    readonly targetId: string;
    readonly reason?: string;
};

export type ProtectGameAction = {
    readonly type: "protect";
    readonly targetId: string;
    readonly reason?: string;
};

export type RevealGameAction = {
    readonly type: "reveal";
    readonly toPlayerId: string;
    readonly targetId: string;
    readonly key: string;
    readonly value: unknown;
};

export type SetStatusGameAction = {
    readonly type: "setStatus";
    readonly targetId: string;
    readonly statusId: string;
    readonly value: unknown;
};

export type SendMessageGameAction = {
    readonly type: "sendMessage";
    readonly toPlayerId: string;
    readonly message: string;
};

export type CustomGameAction = {
    readonly type: "custom";
    readonly actionId: string;
    readonly payload?: unknown;
};

export type MessageGameAction = {
    readonly toPlayerId: string;
    readonly message: string;
};
