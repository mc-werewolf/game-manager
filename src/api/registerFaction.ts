import type { ApiHandlerContext } from "@kairo-js/router";
import { factionRegistry } from "../registry/factionRegistry";

type RegisterFactionArgs = {
    id: string;
    name: string;
    color: string;
    winCondition: {
        expr: string;
        priority: number;
    };
};

export function handleRegisterFaction(args: RegisterFactionArgs, ctx: ApiHandlerContext): void {
    factionRegistry.register({
        factionId: args.id,
        name: args.name,
        color: args.color,
        winCondition: args.winCondition,
        addonId: ctx.callerAddonId,
    });
}
