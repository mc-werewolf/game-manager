export type StoredFaction = {
    readonly factionId: string;
    readonly name: string;
    readonly color: string;
    readonly sortIndex: number | undefined;
    readonly victoryTitle?: string;
    readonly victoryMessage?: string;
    readonly winCondition: {
        readonly expr: string;
        readonly priority: number;
    };
    readonly addonId: string;
};
