export type StoredRole = {
    readonly roleId: string;
    readonly name: string;
    readonly description: string | undefined;
    readonly faction: string;
    readonly divinationResult: string | undefined;
    readonly color: string | undefined;
    readonly index: number | undefined;
    readonly max: number;
    readonly step: number;
    readonly addonId: string;
};
