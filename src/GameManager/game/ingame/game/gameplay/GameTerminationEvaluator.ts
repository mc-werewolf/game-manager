import type { FactionDefinition } from "../../../../data/factions";
import type { GameOutcomeRule } from "../../../../data/outcome";
import type { Condition, GameContext, GameOutcome } from "../../../../data/types/conditions";
import type { GameManager } from "../GameManager";
import { ConditionNormalizer } from "./ConditionNormalizer";
import type { PlayerData } from "./PlayerData";

export type GameEvaluationResult =
    | { type: "none" }
    | {
          type: "resolved";
          ruleId: string;
          outcome: GameOutcome;
      };

export class GameTerminationEvaluator {
    private readonly conditonNormalizer: ConditionNormalizer;
    private constructor(private readonly gameManager: GameManager) {
        this.conditonNormalizer = ConditionNormalizer.create(this);
    }
    public static create(gameManager: GameManager): GameTerminationEvaluator {
        return new GameTerminationEvaluator(gameManager);
    }

    public evaluate(playersData: readonly PlayerData[]) {
        const context = this.buildContext(playersData);

        const rules: GameOutcomeRule[] = [
            ...this.gameManager.getDefaultOutcomeRules(),
            ...this.buildFactionVictoryRules(),
        ];

        const satisfied = rules
            .filter((rule) => this.evaluateCondition(rule.condition, context, rule.factionId))
            .sort((a, b) => b.priority - a.priority);

        if (satisfied.length === 0) {
            return { type: "none" } as const;
        }

        const winner = satisfied[0];
        if (!winner) {
            return { type: "none" } as const;
        }

        return {
            type: "resolved",
            ruleId: winner.id,
            outcome: winner.outcome,
            presentation: winner.presentation,
        } as const;
    }

    public evaluateCondition(
        condition: Condition,
        context: GameContext,
        factionId: string | undefined,
    ): boolean {
        const normalized = this.conditonNormalizer.normalizeCondition(condition);
        return this.conditonNormalizer.evalNormalized(normalized, context, factionId);
    }

    private buildContext(playersData: readonly PlayerData[]) {
        const alive = playersData.filter((p) => p.isParticipating && p.isAlive);

        const aliveCountByFaction: Record<string, number> = {};

        for (const p of alive) {
            const role = p.role;
            if (!role) continue;

            // 狂人枠はカウントしない
            if (role.isExcludedFromSurvivalCheck === true) continue;

            const factionId = role.factionId;
            aliveCountByFaction[factionId] = (aliveCountByFaction[factionId] ?? 0) + 1;
        }

        return {
            remainingTime: this.gameManager.getRemainingTicks(),
            alivePlayerCount: alive.length,
            aliveCountByFaction,
        };
    }

    private buildFactionVictoryRules(): GameOutcomeRule[] {
        return this.gameManager.getDefinitions<FactionDefinition>("faction").map((faction) => ({
            id: `victory:${faction.id}`,
            factionId: faction.id,
            priority: faction.victoryCondition.priority,
            condition: faction.victoryCondition.condition,
            outcome: {
                type: "victory",
                factionId: faction.id,
            } satisfies GameOutcome,
            presentation: faction.victoryCondition.presentation,
        }));
    }

    public getGameManager(): GameManager {
        return this.gameManager;
    }
}
