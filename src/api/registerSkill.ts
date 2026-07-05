import type { ApiHandlerContext } from "@kairo-js/router";
import { skillRegistry } from "../registry/skillRegistry";
import type { StoredSkill } from "../types/skill";

type RegisterSkillArgs = {
    id: string;
    name: string;
    description?: string;
    roleId?: string;
    phaseId?: string;
    timing?: string;
    target?: unknown;
    handler: {
        addonId?: string;
        apiName: string;
    };
    cooldownTicks?: number;
    uses?: number;
    priority?: number;
    tags?: string[];
};

export function handleRegisterSkill(args: RegisterSkillArgs, ctx: ApiHandlerContext): void {
    skillRegistry.register(toStoredSkill(args, ctx.callerAddonId));
}

function toStoredSkill(args: RegisterSkillArgs, callerAddonId: string): StoredSkill {
    return {
        skillId: args.id,
        name: args.name,
        description: args.description,
        roleId: args.roleId,
        phaseId: args.phaseId,
        timing: args.timing,
        target: args.target,
        handler: {
            addonId: args.handler.addonId ?? callerAddonId,
            apiName: args.handler.apiName,
        },
        cooldownTicks: args.cooldownTicks,
        uses: args.uses,
        priority: args.priority,
        tags: args.tags,
        addonId: callerAddonId,
    };
}

