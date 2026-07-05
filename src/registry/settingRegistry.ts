import type { StoredSetting } from "../types/setting";

const settings = new Map<string, StoredSetting>();

export const settingRegistry = {
    register(setting: StoredSetting): void {
        if (settings.has(setting.settingId)) {
            throw new Error(`[game-manager] Setting "${setting.settingId}" is already registered`);
        }
        settings.set(setting.settingId, setting);
    },

    get(settingId: string): StoredSetting | undefined {
        return settings.get(settingId);
    },

    getAll(): ReadonlyMap<string, StoredSetting> {
        return settings;
    },

    clear(): void {
        settings.clear();
    },
};

