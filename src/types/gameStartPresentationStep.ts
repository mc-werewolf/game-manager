export type GameStartPresentationStage = "start" | "fadeStart" | "blackout" | "fadeOut" | "complete";

export type StoredGameStartPresentationStep = {
    readonly id: string;
    readonly stage: GameStartPresentationStage;
    readonly order: number | undefined;
    readonly addonId: string;
    readonly apiName: string;
    readonly timeout: number | undefined;
};
