import { router } from "@kairo-js/router";
import { saveSettings } from "../persistence/gameManagerPersistence";
import { settingRegistry } from "../registry/settingRegistry";
import { settingValues } from "../state/settingValues";
import type { SettingValue } from "../types/setting";

type SetSettingArgs = {
    id: string;
    value: SettingValue;
};

type ResetSettingsArgs = {
    ids?: string[];
};

export function handleGetSettings(): Record<string, SettingValue> {
    return settingValues.getResolvedValues();
}

export function handleSetSetting(args: SetSettingArgs): void {
    settingValues.set(args.id, args.value);
    saveSettings();
    router.emit("werewolf:settingsChanged", {
        values: settingValues.getResolvedValues(),
        changedIds: [args.id],
    });
}

export function handleResetSettings(args?: ResetSettingsArgs): void {
    const settingIds = args?.ids ?? [...settingRegistry.getAll().keys()];
    for (const settingId of settingIds) {
        settingValues.reset(settingId);
    }
    saveSettings();
    router.emit("werewolf:settingsChanged", {
        values: settingValues.getResolvedValues(),
        changedIds: settingIds,
    });
}
