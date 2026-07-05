type SkillUsageEntry = {
    uses: number;
    lastUsedTick: number | undefined;
};

const usages = new Map<string, SkillUsageEntry>();

export const skillUsageState = {
    get(actorId: string, skillId: string): SkillUsageEntry {
        return usages.get(createKey(actorId, skillId)) ?? { uses: 0, lastUsedTick: undefined };
    },

    consume(actorId: string, skillId: string, currentTick: number): void {
        const key = createKey(actorId, skillId);
        const current = skillUsageState.get(actorId, skillId);
        usages.set(key, {
            uses: current.uses + 1,
            lastUsedTick: currentTick,
        });
    },

    clear(): void {
        usages.clear();
    },
};

function createKey(actorId: string, skillId: string): string {
    return `${actorId}\n${skillId}`;
}

