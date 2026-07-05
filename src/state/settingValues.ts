import { settingRegistry } from "../registry/settingRegistry";
import type { SettingValue, StoredSetting } from "../types/setting";

const values = new Map<string, SettingValue>();

export const settingValues = {
    get(settingId: string): SettingValue | undefined {
        if (values.has(settingId)) return values.get(settingId);
        return settingRegistry.get(settingId)?.defaultValue;
    },

    set(settingId: string, value: SettingValue): void {
        const setting = settingRegistry.get(settingId);
        if (!setting) {
            throw new Error(`[game-manager] Setting "${settingId}" is not registered`);
        }
        validateSettingValue(setting, value);
        values.set(settingId, value);
    },

    reset(settingId: string): void {
        values.delete(settingId);
    },

    replaceAll(nextValues: Record<string, SettingValue>): void {
        values.clear();
        for (const [settingId, value] of Object.entries(nextValues)) {
            values.set(settingId, value);
        }
    },

    getStoredValues(): Record<string, SettingValue> {
        return Object.fromEntries(values);
    },

    getResolvedValues(): Record<string, SettingValue> {
        const resolved: Record<string, SettingValue> = {};
        for (const setting of settingRegistry.getAll().values()) {
            const value = settingValues.get(setting.settingId);
            if (value !== undefined) {
                resolved[setting.settingId] = value;
            }
        }
        return resolved;
    },
};

function validateSettingValue(setting: StoredSetting, value: SettingValue): void {
    if (setting.type === "toggle" && typeof value !== "boolean") {
        throw new Error(`[game-manager] Setting "${setting.settingId}" expects a boolean value`);
    }

    if (setting.type === "slider") {
        if (typeof value !== "number") {
            throw new Error(`[game-manager] Setting "${setting.settingId}" expects a number value`);
        }
        if (value < setting.min || value > setting.max) {
            throw new Error(`[game-manager] Setting "${setting.settingId}" expects a value between ${setting.min} and ${setting.max}`);
        }
        return;
    }

    if (setting.type === "dropdown") {
        if (typeof value !== "string") {
            throw new Error(`[game-manager] Setting "${setting.settingId}" expects a string value`);
        }
        if (!setting.options.some((option) => option.value === value)) {
            throw new Error(`[game-manager] Setting "${setting.settingId}" expects one of the registered dropdown option values`);
        }
    }
}
