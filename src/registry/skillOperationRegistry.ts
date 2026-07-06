import type { StoredSkillOperation, StoredSkillOperationInput } from "../types/skillOperation";

const operations = new Map<string, StoredSkillOperation[]>();
let nextOrder = 0;

export const skillOperationRegistry = {
    register(operation: StoredSkillOperationInput): void {
        const stored = { ...operation, order: nextOrder++ } as StoredSkillOperation;
        const entries = operations.get(stored.targetId) ?? [];
        entries.push(stored);
        operations.set(stored.targetId, entries);
    },

    getForTarget(targetId: string): readonly StoredSkillOperation[] {
        return operations.get(targetId) ?? [];
    },

    clear(): void {
        operations.clear();
        nextOrder = 0;
    },
};
