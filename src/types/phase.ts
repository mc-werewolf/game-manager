export type StoredPhase = {
    readonly phaseId: string;
    readonly name: string;
    readonly order: number;
    readonly durationTicks: number | undefined;
    readonly enterEvent: string | undefined;
    readonly tickEvent: string | undefined;
    readonly exitEvent: string | undefined;
    readonly tags: readonly string[] | undefined;
    readonly addonId: string;
};

