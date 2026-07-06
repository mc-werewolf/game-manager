export type SavedRoleCompositionRecord = {
    readonly id: string;
    readonly name: string;
    readonly savedAtUnixMs: number;
    readonly savedAtIso: string;
    readonly savedByPlayerId: string;
    readonly savedByName: string;
    readonly counts: Record<string, number>;
};
