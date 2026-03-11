import type { FactionDefinition } from "../../../../data/factions";
import type {
    Condition,
    GameContext,
    NormalizedCondition,
    NumericExpression,
    NumericValue,
} from "../../../../data/types/conditions";
import type { GameTerminationEvaluator } from "./GameTerminationEvaluator";

export class ConditionNormalizer {
    private constructor(private readonly gameTerminationEvaluator: GameTerminationEvaluator) {}
    public static create(gameTerminationEvaluator: GameTerminationEvaluator): ConditionNormalizer {
        return new ConditionNormalizer(gameTerminationEvaluator);
    }

    public normalizeNumeric(value: NumericValue): NumericExpression {
        if (typeof value === "number") {
            return { type: "constant", value };
        }

        if (typeof value === "string") {
            return { type: "gameVariable", key: value };
        }

        return {
            type: "factionAliveCount",
            factionId: value.factionAliveCount,
        };
    }

    public normalizeCondition(condition: Condition): NormalizedCondition {
        switch (condition.type) {
            case "standardFactionVictory":
                return { type: "standardFactionVictory" };

            case "comparison":
                return {
                    type: "comparison",
                    operator: condition.operator,
                    left: this.normalizeNumeric(condition.left),
                    right: this.normalizeNumeric(condition.right),
                };

            case "factionAliveCount":
                return {
                    type: "comparison",
                    operator: condition.operator,
                    left: {
                        type: "factionAliveCount",
                        factionId: condition.factionId,
                    },
                    right: this.normalizeNumeric(condition.value),
                };

            case "playerAliveCount":
                return {
                    type: "comparison",
                    operator: condition.operator,
                    left: {
                        type: "gameVariable",
                        key: "alivePlayerCount",
                    },
                    right: this.normalizeNumeric(condition.value),
                };

            case "remainingTime":
                return {
                    type: "comparison",
                    operator: condition.operator,
                    left: {
                        type: "gameVariable",
                        key: "remainingTime",
                    },
                    right: this.normalizeNumeric(condition.value),
                };

            case "and":
                return {
                    type: "and",
                    conditions: condition.conditions.map((c) => this.normalizeCondition(c)),
                };

            case "or":
                return {
                    type: "or",
                    conditions: condition.conditions.map((c) => this.normalizeCondition(c)),
                };

            case "not":
                return {
                    type: "not",
                    condition: this.normalizeCondition(condition.condition),
                };
        }
    }

    public evalNumeric(expr: NumericExpression, ctx: GameContext): number {
        switch (expr.type) {
            case "constant":
                return expr.value;

            case "gameVariable":
                return ctx[expr.key];

            case "factionAliveCount":
                return ctx.aliveCountByFaction[expr.factionId] ?? 0;
        }
    }

    public evalNormalized(
        condition: NormalizedCondition,
        ctx: GameContext,
        factionId?: string | undefined,
    ): boolean {
        switch (condition.type) {
            case "standardFactionVictory":
                return this.evalStandardFactionVictory(ctx, factionId);
            case "comparison": {
                const left = this.evalNumeric(condition.left, ctx);
                const right = this.evalNumeric(condition.right, ctx);

                switch (condition.operator) {
                    case "==":
                        return left === right;
                    case "!=":
                        return left !== right;
                    case "<":
                        return left < right;
                    case "<=":
                        return left <= right;
                    case ">":
                        return left > right;
                    case ">=":
                        return left >= right;
                }
            }

            case "and":
                return condition.conditions.every((c) => this.evalNormalized(c, ctx, factionId));

            case "or":
                return condition.conditions.some((c) => this.evalNormalized(c, ctx, factionId));

            case "not":
                return !this.evalNormalized(condition.condition, ctx, factionId);
        }
    }

    private evalStandardFactionVictory(ctx: GameContext, factionId: string | undefined): boolean {
        if (factionId === undefined) return false;

        const factions = this.gameTerminationEvaluator
            .getGameManager()
            .getDefinitions<FactionDefinition>("faction")
            .filter((f) => f.type === "standard");

        const selfAliveCount = ctx.aliveCountByFaction[factionId] ?? 0;
        if (selfAliveCount <= 0) return false;

        let otherAliveCount = 0;
        for (const other of factions) {
            if (other.id === factionId) continue;
            otherAliveCount += ctx.aliveCountByFaction[other.id] ?? 0;
        }

        if (otherAliveCount === 0) {
            return true;
        }

        return false;
    }
}
