import type { ApiHandlerContext } from "@kairo-js/router";
import { roleRegistry } from "../registry/roleRegistry";

type RegisterRoleArgs = {
    roleId: string;
    name: string;
    description?: string;
    faction: string;
    divinationResult?: string;
    color?: string;
    sortIndex?: number;
    index?: number;
    max?: number;
    step?: number;
};

export function handleRegisterRole(args: RegisterRoleArgs, ctx: ApiHandlerContext): void {
    roleRegistry.register({
        roleId: args.roleId,
        name: args.name,
        description: args.description,
        faction: args.faction,
        divinationResult: args.divinationResult,
        color: args.color,
        sortIndex: args.sortIndex,
        index: args.index,
        max: args.max ?? 4,
        step: args.step ?? 1,
        addonId: ctx.callerAddonId,
    });
}
