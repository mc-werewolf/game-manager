const counts = new Map<string, number>();

export const roleCountSettings = {
    get(roleId: string): number {
        return counts.get(roleId) ?? 0;
    },

    set(roleId: string, count: number): void {
        counts.set(roleId, count);
    },

    replaceAll(nextCounts: Record<string, number>): void {
        counts.clear();
        for (const [roleId, count] of Object.entries(nextCounts)) {
            counts.set(roleId, count);
        }
    },

    toRecord(): Record<string, number> {
        return Object.fromEntries(counts);
    },

    getAll(): ReadonlyMap<string, number> {
        return counts;
    },
};
