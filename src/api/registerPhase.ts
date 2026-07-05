import type { ApiHandlerContext } from "@kairo-js/router";
import { phaseRegistry } from "../registry/phaseRegistry";
import type { StoredPhase } from "../types/phase";

type RegisterPhaseArgs = {
    id: string;
    name: string;
    order: number;
    durationTicks?: number;
    enterEvent?: string;
    tickEvent?: string;
    exitEvent?: string;
    tags?: string[];
};

export function handleRegisterPhase(args: RegisterPhaseArgs, ctx: ApiHandlerContext): void {
    phaseRegistry.register(toStoredPhase(args, ctx.callerAddonId));
}

function toStoredPhase(args: RegisterPhaseArgs, addonId: string): StoredPhase {
    return {
        phaseId: args.id,
        name: args.name,
        order: args.order,
        durationTicks: args.durationTicks,
        enterEvent: args.enterEvent,
        tickEvent: args.tickEvent,
        exitEvent: args.exitEvent,
        tags: args.tags,
        addonId,
    };
}

