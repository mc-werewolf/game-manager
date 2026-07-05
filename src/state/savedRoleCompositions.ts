import type { SavedRoleCompositionRecord } from "../types/savedRoleComposition";

const MAX_SAVED_ROLE_COMPOSITIONS = 20;
const records: SavedRoleCompositionRecord[] = [];

export const savedRoleCompositions = {
    add(record: SavedRoleCompositionRecord): void {
        if (records.some((existing) => existing.name === record.name)) {
            throw new Error(`[game-manager] Saved role composition "${record.name}" already exists`);
        }
        records.unshift(record);
        if (records.length > MAX_SAVED_ROLE_COMPOSITIONS) {
            records.length = MAX_SAVED_ROLE_COMPOSITIONS;
        }
    },

    delete(id: string): boolean {
        const index = records.findIndex((record) => record.id === id);
        if (index < 0) return false;
        records.splice(index, 1);
        return true;
    },

    hasName(name: string): boolean {
        return records.some((record) => record.name === name);
    },

    getAll(): readonly SavedRoleCompositionRecord[] {
        return records;
    },

    replaceAll(nextRecords: readonly SavedRoleCompositionRecord[]): void {
        records.length = 0;
        records.push(...nextRecords.slice(0, MAX_SAVED_ROLE_COMPOSITIONS));
    },
};
