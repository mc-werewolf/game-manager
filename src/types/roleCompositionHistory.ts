export type RoleCompositionDiff = {
    readonly roleId: string;
    readonly addonId: string;
    readonly from: number;
    readonly to: number;
};

export type RoleCompositionHistoryRecord = {
    readonly id: string;
    readonly changedAtUnixMs: number;
    readonly changedAtIso: string;
    readonly changedByPlayerId: string;
    readonly changedByName: string;
    readonly before: Record<string, number>;
    readonly after: Record<string, number>;
    readonly diffs: RoleCompositionDiff[];
};
