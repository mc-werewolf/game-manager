const counts = new Map<string, number>();

export const roleCountSettings = {
    get(roleId: string): number {
        return counts.get(roleId) ?? 0;
    },

    set(roleId: string, count: number): void {
        counts.set(roleId, count);
    },

    getAll(): ReadonlyMap<string, number> {
        return counts;
    },
};
