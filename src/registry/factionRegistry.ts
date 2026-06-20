import type { StoredFaction } from "../types/faction";

const factions = new Map<string, StoredFaction>();

export const factionRegistry = {
    register(faction: StoredFaction): void {
        if (factions.has(faction.factionId)) {
            throw new Error(`[game-manager] Faction "${faction.factionId}" is already registered`);
        }
        factions.set(faction.factionId, faction);
    },

    get(factionId: string): StoredFaction | undefined {
        return factions.get(factionId);
    },

    getAll(): ReadonlyMap<string, StoredFaction> {
        return factions;
    },

    clear(): void {
        factions.clear();
    },
};
