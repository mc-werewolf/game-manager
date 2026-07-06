const participants = new Set<string>();
const spectators = new Set<string>();

export const participationState = {
    join(playerId: string): void {
        spectators.delete(playerId);
        participants.add(playerId);
    },

    spectate(playerId: string): void {
        participants.delete(playerId);
        spectators.add(playerId);
    },

    getParticipantIds(): readonly string[] {
        return [...participants];
    },

    getSpectatorIds(): readonly string[] {
        return [...spectators];
    },

    hasExplicitParticipants(): boolean {
        return participants.size > 0;
    },

    clear(): void {
        participants.clear();
        spectators.clear();
    },
};

