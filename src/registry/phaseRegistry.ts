import type { StoredPhase } from "../types/phase";

const phases = new Map<string, StoredPhase>();

export const phaseRegistry = {
    register(phase: StoredPhase): void {
        if (phases.has(phase.phaseId)) {
            throw new Error(`[game-manager] Phase "${phase.phaseId}" is already registered`);
        }
        phases.set(phase.phaseId, phase);
    },

    get(phaseId: string): StoredPhase | undefined {
        return phases.get(phaseId);
    },

    getAll(): ReadonlyMap<string, StoredPhase> {
        return phases;
    },

    getOrdered(): StoredPhase[] {
        return [...phases.values()].sort(comparePhases);
    },

    clear(): void {
        phases.clear();
    },
};

function comparePhases(a: StoredPhase, b: StoredPhase): number {
    if (a.order !== b.order) return a.order - b.order;
    return a.phaseId.localeCompare(b.phaseId);
}

