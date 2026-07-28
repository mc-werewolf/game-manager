import type { GameStartPresentationStage, StoredGameStartPresentationStep } from "../types/gameStartPresentationStep";

const steps = new Map<string, StoredGameStartPresentationStep>();

export const gameStartPresentationStepRegistry = {
    register(step: StoredGameStartPresentationStep): void {
        if (steps.has(step.id)) {
            throw new Error(`[game-manager] Game start presentation step "${step.id}" is already registered`);
        }
        steps.set(step.id, step);
    },

    getByStage(stage: GameStartPresentationStage): StoredGameStartPresentationStep[] {
        return [...steps.values()]
            .filter((step) => step.stage === stage)
            .sort(compareSteps);
    },

    clear(): void {
        steps.clear();
    },
};

function compareSteps(a: StoredGameStartPresentationStep, b: StoredGameStartPresentationStep): number {
    return (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id);
}
