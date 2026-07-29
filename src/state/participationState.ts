export type ParticipationStatus = "join" | "spectate";

const statuses = new Map<string, ParticipationStatus>();

export const participationState = {
    join(playerId: string): void {
        statuses.set(playerId, "join");
    },

    spectate(playerId: string): void {
        statuses.set(playerId, "spectate");
    },

    getStatus(playerId: string): ParticipationStatus {
        return statuses.get(playerId) ?? "join";
    },

    getSpectatorIds(): readonly string[] {
        return [...statuses.entries()].flatMap(([playerId, status]) =>
            status === "spectate" ? [playerId] : []
        );
    },

    isParticipating(playerId: string): boolean {
        return (statuses.get(playerId) ?? "join") === "join";
    },

    isSpectating(playerId: string): boolean {
        return (statuses.get(playerId) ?? "join") === "spectate";
    },

    toRecord(): Record<string, ParticipationStatus> {
        return Object.fromEntries(statuses);
    },

    replaceAll(record: Record<string, ParticipationStatus>): void {
        statuses.clear();
        for (const [playerId, status] of Object.entries(record)) {
            if (status === "join" || status === "spectate") {
                statuses.set(playerId, status);
            }
        }
    },

    clear(): void {
        statuses.clear();
    },
};
