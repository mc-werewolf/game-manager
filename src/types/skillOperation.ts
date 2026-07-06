import type { SkillHandlerRef, StoredSkill } from "./skill";
import type { SkillContext, SkillResult } from "./skillRuntime";

export type SkillPatch = {
    readonly name?: string | undefined;
    readonly description?: string | undefined;
    readonly roleId?: string | undefined;
    readonly phaseId?: string | undefined;
    readonly timing?: string | undefined;
    readonly target?: unknown;
    readonly handler?: SkillHandlerRef | undefined;
    readonly cooldownTicks?: number | undefined;
    readonly uses?: number | undefined;
    readonly priority?: number | undefined;
    readonly tags?: readonly string[] | undefined;
};

export type StoredSkillOperation =
    | StoredPatchSkillOperation
    | StoredDisableSkillOperation
    | StoredReplaceSkillOperation
    | StoredWrapSkillOperation;

export type StoredSkillOperationInput =
    | Omit<StoredPatchSkillOperation, "order">
    | Omit<StoredDisableSkillOperation, "order">
    | Omit<StoredReplaceSkillOperation, "order">
    | Omit<StoredWrapSkillOperation, "order">;

export type StoredSkillOperationBase = {
    readonly targetId: string;
    readonly priority: number;
    readonly addonId: string;
    readonly order: number;
};

export type StoredPatchSkillOperation = StoredSkillOperationBase & {
    readonly op: "patch";
    readonly patch: SkillPatch;
};

export type StoredDisableSkillOperation = StoredSkillOperationBase & {
    readonly op: "disable";
};

export type StoredReplaceSkillOperation = StoredSkillOperationBase & {
    readonly op: "replace";
    readonly entry: StoredSkill;
};

export type StoredWrapSkillOperation = StoredSkillOperationBase & {
    readonly op: "wrap";
    readonly wrapper: SkillWrapperDefinition;
};

export type SkillWrapperDefinition = {
    readonly id: string;
    readonly handler: SkillHandlerRef;
};

export type SkillWrapperContext = SkillContext & {
    readonly wrapperId: string;
    readonly targetSkillId: string;
    readonly originalResult: SkillResult;
};
