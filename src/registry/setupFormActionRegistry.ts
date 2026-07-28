import type { StoredSetupFormAction } from "../types/setupFormAction";

const actions = new Map<string, StoredSetupFormAction>();

export const setupFormActionRegistry = {
    register(action: StoredSetupFormAction): void {
        if (actions.has(action.id)) {
            throw new Error(`[game-manager] Setup form action "${action.id}" is already registered`);
        }
        actions.set(action.id, action);
    },

    getAll(): ReadonlyMap<string, StoredSetupFormAction> {
        return actions;
    },

    clear(): void {
        actions.clear();
    },
};

