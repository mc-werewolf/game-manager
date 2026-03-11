import type { RawMessage } from "@minecraft/server";
import type { Condition } from "./types/conditions";
import type { BaseDefinition } from "./roles";

export interface VictoryCondition {
    priority: number;
    condition: Condition;
    description: RawMessage;
    presentation: {
        title: RawMessage;
        message: RawMessage;
    };
}

export interface FactionDefinition extends BaseDefinition {
    defaultRoleId: string;
    type: FactionCategory;
    name: RawMessage;
    description: RawMessage;
    defaultColor: string;
    victoryCondition: VictoryCondition;
    sortIndex: number;
}

export type FactionCategory = "standard" | "independent" | "neutral";
