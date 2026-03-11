import { KairoUtils } from "@kairo-js/router";
import type { FactionDefinition, VictoryCondition } from "../../../../data/factions";
import type {
    AndCondition,
    ComparisonCondition,
    Condition,
    FactionAliveCountComparison,
    GameOutcome,
    NotCondition,
    NumericValue,
    OrCondition,
    PlayerAliveCountComparison,
    RemainingTimeComparison,
} from "../../../../data/types/conditions";
import { BaseDefinitionValidator } from "../BaseDefinitionValidator";
import type { FactionDefinitionRegistry } from "./FactionDefinitionRegistry";

export class FactionDefinitionValidator extends BaseDefinitionValidator<
    FactionDefinition,
    FactionDefinitionRegistry
> {
    private constructor(registry: FactionDefinitionRegistry) {
        super(registry);
    }
    public static create(factionDefinitionRegistry: FactionDefinitionRegistry) {
        return new FactionDefinitionValidator(factionDefinitionRegistry);
    }

    public isDefinition(data: unknown): data is FactionDefinition {
        if (!this.isObject(data)) return false;

        if (typeof data.id !== "string") return false;
        if (typeof data.defaultRoleId !== "string") return false;
        if (typeof data.type !== "string") return false;
        if (!KairoUtils.isRawMessage(data.name)) return false;
        if (!KairoUtils.isRawMessage(data.description)) return false;
        if (typeof data.defaultColor !== "string") return false;
        if (!this.isVictoryCondition(data.victoryCondition)) return false;
        if (typeof data.sortIndex !== "number") return false;

        return true;
    }

    public isGameOutcomeRule(data: unknown): boolean {
        if (!this.isObject(data)) return false;

        if (typeof data.id !== "string") return false;
        if (typeof data.priority !== "number") return false;
        if (!this.isCondition(data.condition)) return false;
        if (!this.isGameOutcome(data.outcome)) return false;
        if (!this.isPresentation(data.presentation)) return false;

        return true;
    }

    private isVictoryCondition(data: unknown): data is VictoryCondition {
        if (!this.isObject(data)) return false;

        if (typeof data.priority !== "number") return false;
        if (!this.isCondition(data.condition)) return false;
        if (!KairoUtils.isRawMessage(data.description)) return false;
        if (!this.isPresentation(data.presentation)) return false;

        return true;
    }

    private isGameOutcome(data: unknown): data is GameOutcome {
        if (!this.isObject(data)) return false;

        switch (data.type) {
            case "victory":
                return typeof data.factionId === "string";

            case "draw":
            case "end":
                return typeof data.reason === "string";

            default:
                return false;
        }
    }

    private isPresentation(data: unknown): boolean {
        if (!this.isObject(data)) return false;
        if (!KairoUtils.isRawMessage(data.title)) return false;
        if (!KairoUtils.isRawMessage(data.message)) return false;
        return true;
    }

    /* =========================
     * Condition
     * ========================= */

    private isCondition(data: unknown): data is Condition {
        if (!this.isObject(data)) return false;
        if (typeof data.type !== "string") return false;

        switch (data.type) {
            case "standardFactionVictory":
                return true;
            case "comparison":
                return this.isComparisonCondition(data);

            case "factionAliveCount":
                return this.isFactionAliveCountComparison(data);

            case "playerAliveCount":
                return this.isPlayerAliveCountComparison(data);

            case "remainingTime":
                return this.isRemainingTimeComparison(data);

            case "and":
                return this.isAndCondition(data);

            case "or":
                return this.isOrCondition(data);

            case "not":
                return this.isNotCondition(data);

            default:
                return false;
        }
    }

    private isComparisonCondition(data: any): data is ComparisonCondition {
        return (
            this.isOperator(data.operator) &&
            this.isNumericValue(data.left) &&
            this.isNumericValue(data.right)
        );
    }

    private isFactionAliveCountComparison(data: any): data is FactionAliveCountComparison {
        return (
            typeof data.factionId === "string" &&
            this.isOperator(data.operator) &&
            this.isNumericValue(data.value)
        );
    }

    private isPlayerAliveCountComparison(data: any): data is PlayerAliveCountComparison {
        return this.isOperator(data.operator) && this.isNumericValue(data.value);
    }

    private isRemainingTimeComparison(data: any): data is RemainingTimeComparison {
        return this.isOperator(data.operator) && this.isNumericValue(data.value);
    }

    private isAndCondition(data: any): data is AndCondition {
        return (
            Array.isArray(data.conditions) &&
            data.conditions.every((c: unknown) => this.isCondition(c))
        );
    }

    private isOrCondition(data: any): data is OrCondition {
        return (
            Array.isArray(data.conditions) &&
            data.conditions.every((c: unknown) => this.isCondition(c))
        );
    }

    private isNotCondition(data: any): data is NotCondition {
        return this.isCondition(data.condition);
    }

    private isNumericValue(value: unknown): value is NumericValue {
        if (typeof value === "number") return true;
        if (value === "remainingTime" || value === "alivePlayerCount") return true;

        if (this.isObject(value)) {
            return typeof value.factionAliveCount === "string";
        }

        return false;
    }

    private isOperator(op: unknown): boolean {
        return op === "==" || op === "!=" || op === "<" || op === "<=" || op === ">" || op === ">=";
    }
}
