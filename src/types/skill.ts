export type SkillHandlerRef = {
    readonly addonId: string;
    readonly apiName: string;
};

export type StoredSkill = {
    readonly skillId: string;
    readonly name: string;
    readonly description: string | undefined;
    readonly roleId: string | undefined;
    readonly phaseId: string | undefined;
    readonly timing: string | undefined;
    readonly target: unknown;
    readonly handler: SkillHandlerRef;
    readonly cooldownTicks: number | undefined;
    readonly uses: number | undefined;
    readonly priority: number | undefined;
    readonly tags: readonly string[] | undefined;
    readonly addonId: string;
};

