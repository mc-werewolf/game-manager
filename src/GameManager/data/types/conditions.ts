export type GameVariableKey = "remainingTime" | "alivePlayerCount";

export type NumericValue = number | GameVariableKey | { factionAliveCount: string };

export interface GameContext {
    remainingTime: number;
    alivePlayerCount: number;
    aliveCountByFaction: Record<string, number>;
}

export type Condition =
    | StandardFactionVictoryCondition
    | ComparisonCondition
    | FactionAliveCountComparison
    | PlayerAliveCountComparison
    | RemainingTimeComparison
    | AndCondition
    | OrCondition
    | NotCondition;

export interface StandardFactionVictoryCondition {
    type: "standardFactionVictory";
}

export interface ComparisonCondition {
    type: "comparison";
    operator: "==" | "!=" | "<" | "<=" | ">" | ">=";
    left: NumericValue;
    right: NumericValue;
}

export interface FactionAliveCountComparison {
    type: "factionAliveCount";
    factionId: string;
    operator: "==" | "!=" | "<" | "<=" | ">" | ">=";
    value: NumericValue;
}

export interface PlayerAliveCountComparison {
    type: "playerAliveCount";
    operator: "==" | "!=" | "<" | "<=" | ">" | ">=";
    value: NumericValue;
}

export interface RemainingTimeComparison {
    type: "remainingTime";
    operator: "==" | "!=" | "<" | "<=" | ">" | ">=";
    value: NumericValue;
}

export interface AndCondition {
    type: "and";
    conditions: Condition[];
}

export interface OrCondition {
    type: "or";
    conditions: Condition[];
}

export interface NotCondition {
    type: "not";
    condition: Condition;
}

export type GameOutcome =
    | { type: "victory"; factionId: string }
    | { type: "draw"; reason: string }
    | { type: "end"; reason: string };

export interface ConstantExpression {
    type: "constant";
    value: number;
}

export interface GameVariableExpression {
    type: "gameVariable";
    key: GameVariableKey;
}

export interface FactionAliveCountExpression {
    type: "factionAliveCount";
    factionId: string;
}

export type NumericExpression =
    | ConstantExpression
    | GameVariableExpression
    | FactionAliveCountExpression;

export interface NormalizedComparison {
    type: "comparison";
    operator: "==" | "!=" | "<" | "<=" | ">" | ">=";
    left: NumericExpression;
    right: NumericExpression;
}

export type NormalizedCondition =
    | NormalizedComparison
    | { type: "standardFactionVictory" }
    | { type: "and"; conditions: NormalizedCondition[] }
    | { type: "or"; conditions: NormalizedCondition[] }
    | { type: "not"; condition: NormalizedCondition };
