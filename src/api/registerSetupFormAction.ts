import type { ApiHandlerContext } from "@kairo-js/router";
import { setupFormActionRegistry } from "../registry/setupFormActionRegistry";
import type { StoredSetupFormAction } from "../types/setupFormAction";

type RegisterSetupFormActionArgs = {
    readonly id: string;
    readonly label: string;
    readonly description?: string;
    readonly order?: number;
    readonly apiName: string;
};

export function handleRegisterSetupFormAction(args: RegisterSetupFormActionArgs, ctx: ApiHandlerContext): void {
    validateSetupFormActionArgs(args);
    setupFormActionRegistry.register(toStoredSetupFormAction(args, ctx.callerAddonId));
}

function validateSetupFormActionArgs(args: RegisterSetupFormActionArgs): void {
    if (!args.id) {
        throw new Error("[game-manager] Setup form action id is required");
    }
    if (!args.label) {
        throw new Error(`[game-manager] Setup form action "${args.id}" label is required`);
    }
    if (!args.apiName) {
        throw new Error(`[game-manager] Setup form action "${args.id}" apiName is required`);
    }
}

function toStoredSetupFormAction(args: RegisterSetupFormActionArgs, addonId: string): StoredSetupFormAction {
    return {
        id: args.id,
        label: args.label,
        description: args.description,
        order: args.order,
        addonId,
        apiName: args.apiName,
    };
}

