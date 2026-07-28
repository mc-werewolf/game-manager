import type { ApiHandlerContext } from "@kairo-js/router";
import { gameStartPresentationStepRegistry } from "../registry/gameStartPresentationStepRegistry";
import type { GameStartPresentationStage, StoredGameStartPresentationStep } from "../types/gameStartPresentationStep";

const STAGES: readonly GameStartPresentationStage[] = ["start", "fadeStart", "blackout", "fadeOut", "complete"];

type RegisterGameStartPresentationStepArgs = {
    readonly id: string;
    readonly stage: GameStartPresentationStage;
    readonly order?: number;
    readonly apiName: string;
    readonly timeout?: number;
};

export function handleRegisterGameStartPresentationStep(args: RegisterGameStartPresentationStepArgs, ctx: ApiHandlerContext): void {
    validateGameStartPresentationStepArgs(args);
    gameStartPresentationStepRegistry.register(toStoredGameStartPresentationStep(args, ctx.callerAddonId));
}

function validateGameStartPresentationStepArgs(args: RegisterGameStartPresentationStepArgs): void {
    if (!args.id) {
        throw new Error("[game-manager] Game start presentation step id is required");
    }
    if (!STAGES.includes(args.stage)) {
        throw new Error(`[game-manager] Game start presentation step "${args.id}" has an invalid stage`);
    }
    if (!args.apiName) {
        throw new Error(`[game-manager] Game start presentation step "${args.id}" apiName is required`);
    }
}

function toStoredGameStartPresentationStep(
    args: RegisterGameStartPresentationStepArgs,
    addonId: string,
): StoredGameStartPresentationStep {
    return {
        id: args.id,
        stage: args.stage,
        order: args.order,
        addonId,
        apiName: args.apiName,
        timeout: args.timeout,
    };
}
