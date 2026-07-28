export type StoredSetupFormAction = {
    readonly id: string;
    readonly label: string;
    readonly description: string | undefined;
    readonly order: number | undefined;
    readonly addonId: string;
    readonly apiName: string;
};

