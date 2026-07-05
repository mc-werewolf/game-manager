import type { ApiHandlerContext } from "@kairo-js/router";
import { skillOperationRegistry } from "../registry/skillOperationRegistry";
import type { SkillHandlerRef, StoredSkill } from "../types/skill";
import type { SkillPatch, SkillWrapperDefinition, StoredSkillOperationInput } from "../types/skillOperation";

type RegisterSkillOperationArgs =
    | RegisterPatchSkillOperationArgs
    | RegisterDisableSkillOperationArgs
    | RegisterReplaceSkillOperationArgs
    | RegisterWrapSkillOperationArgs;

type RegisterSkillOperationBaseArgs = {
    targetId: string;
    priority?: number;
};

type RegisterPatchSkillOperationArgs = RegisterSkillOperationBaseArgs & {
    op: "patch";
    patch: SkillPatchArgs;
};

type RegisterDisableSkillOperationArgs = RegisterSkillOperationBaseArgs & {
    op: "disable";
};

type RegisterReplaceSkillOperationArgs = RegisterSkillOperationBaseArgs & {
    op: "replace";
    entry: SkillEntryArgs;
};

type RegisterWrapSkillOperationArgs = RegisterSkillOperationBaseArgs & {
    op: "wrap";
    wrapper: SkillWrapperArgs;
};

type SkillEntryArgs = {
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

type SkillPatchArgs = Partial<Omit<SkillEntryArgs, "id">>;

type SkillWrapperArgs = {
    id: string;
    handler: {
        addonId?: string;
        apiName: string;
    };
};

type MutableSkillPatch = {
    -readonly [K in keyof SkillPatch]?: SkillPatch[K];
};

export function handleRegisterSkillOperation(args: RegisterSkillOperationArgs, ctx: ApiHandlerContext): void {
    skillOperationRegistry.register(toStoredSkillOperation(args, ctx.callerAddonId));
}

function toStoredSkillOperation(args: RegisterSkillOperationArgs, callerAddonId: string): StoredSkillOperationInput {
    const base = {
        targetId: args.targetId,
        priority: args.priority ?? 0,
        addonId: callerAddonId,
    };

    switch (args.op) {
        case "patch":
            return {
                ...base,
                op: "patch",
                patch: toSkillPatch(args.patch, callerAddonId),
            };
        case "disable":
            return {
                ...base,
                op: "disable",
            };
        case "replace":
            if (args.entry.id !== args.targetId) {
                throw new Error(`[game-manager] Replacement skill id "${args.entry.id}" must match target "${args.targetId}"`);
            }
            return {
                ...base,
                op: "replace",
                entry: toStoredSkill(args.entry, callerAddonId),
            };
        case "wrap":
            return {
                ...base,
                op: "wrap",
                wrapper: toSkillWrapper(args.wrapper, callerAddonId),
            };
    }
}

function toStoredSkill(args: SkillEntryArgs, callerAddonId: string): StoredSkill {
    return {
        skillId: args.id,
        name: args.name,
        description: args.description,
        roleId: args.roleId,
        phaseId: args.phaseId,
        timing: args.timing,
        target: args.target,
        handler: toSkillHandlerRef(args.handler, callerAddonId),
        cooldownTicks: args.cooldownTicks,
        uses: args.uses,
        priority: args.priority,
        tags: args.tags,
        addonId: callerAddonId,
    };
}

function toSkillPatch(args: SkillPatchArgs, callerAddonId: string): SkillPatch {
    const patch: MutableSkillPatch = {};
    if ("name" in args) patch.name = args.name;
    if ("description" in args) patch.description = args.description;
    if ("roleId" in args) patch.roleId = args.roleId;
    if ("phaseId" in args) patch.phaseId = args.phaseId;
    if ("timing" in args) patch.timing = args.timing;
    if ("target" in args) patch.target = args.target;
    if ("handler" in args && args.handler) patch.handler = toSkillHandlerRef(args.handler, callerAddonId);
    if ("cooldownTicks" in args) patch.cooldownTicks = args.cooldownTicks;
    if ("uses" in args) patch.uses = args.uses;
    if ("priority" in args) patch.priority = args.priority;
    if ("tags" in args) patch.tags = args.tags;
    return patch;
}

function toSkillWrapper(args: SkillWrapperArgs, callerAddonId: string): SkillWrapperDefinition {
    return {
        id: args.id,
        handler: toSkillHandlerRef(args.handler, callerAddonId),
    };
}

function toSkillHandlerRef(args: { addonId?: string; apiName: string }, callerAddonId: string): SkillHandlerRef {
    return {
        addonId: args.addonId ?? callerAddonId,
        apiName: args.apiName,
    };
}
