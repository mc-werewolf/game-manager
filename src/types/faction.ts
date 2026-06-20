export type StoredFaction = {
    readonly factionId: string;
    readonly name: string;
    readonly color: string;
    readonly winCondition: {
        readonly expr: string;
        readonly priority: number;
    };
    readonly addonId: string;
};
