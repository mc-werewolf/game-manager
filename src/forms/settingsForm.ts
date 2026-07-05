import type { Player } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { router } from "@kairo-js/router";
import { T } from "../constants/translate";
import { saveSettings } from "../persistence/gameManagerPersistence";
import { settingRegistry } from "../registry/settingRegistry";
import { settingValues } from "../state/settingValues";
import type { SettingValue, StoredSetting } from "../types/setting";
import { rawtext, text, tr, trLine } from "../ui/text";

const UNCATEGORIZED_SETTINGS = T.settings.uncategorized;

type SettingGroup = {
    readonly title: string;
    readonly settings: StoredSetting[];
};

type FormField = {
    readonly setting: StoredSetting;
    readonly toValue: (raw: unknown) => SettingValue | undefined;
};

export async function openSettingsForm(player: Player): Promise<void> {
    const groups = getSettingGroups();
    if (groups.length === 0) {
        player.sendMessage(tr(T.settings.empty));
        return;
    }

    if (groups.length === 1) {
        await openSettingGroupForm(player, groups[0]!);
        return;
    }

    while (true) {
        const form = new ActionFormData()
            .title(tr(T.settings.title))
            .body(tr(T.settings.categoryBody));

        for (const group of groups) {
            form.button(rawtext([
                tr(group.title),
                text(` §7(${group.settings.length})§r`),
            ]));
        }
        form.button(tr(T.setup.closeButton));

        const response = await form.show(player);
        if (response.canceled || response.selection === undefined) return;
        if (response.selection === groups.length) return;

        const group = groups[response.selection];
        if (group) await openSettingGroupForm(player, group);
    }
}

async function openSettingGroupForm(player: Player, group: SettingGroup): Promise<void> {
    const fields: FormField[] = [];
    const form = new ModalFormData().title(tr(group.title));

    for (const setting of group.settings) {
        appendSettingControl(form, fields, setting);
    }

    form.submitButton(tr(T.settings.saveButton));

    const response = await form.show(player);
    if (response.canceled || !response.formValues) return;

    const changedIds: string[] = [];
    for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (!field) continue;

        const nextValue = field.toValue(response.formValues[i]);
        if (nextValue === undefined) continue;

        const previousValue = settingValues.get(field.setting.settingId);
        if (previousValue === nextValue) continue;

        settingValues.set(field.setting.settingId, nextValue);
        changedIds.push(field.setting.settingId);
    }

    if (changedIds.length === 0) return;

    saveSettings();
    router.emit("werewolf:settingsChanged", {
        values: settingValues.getResolvedValues(),
        changedIds,
    });
    player.sendMessage(tr(T.settings.saved));
}

function appendSettingControl(form: ModalFormData, fields: FormField[], setting: StoredSetting): void {
    const label = trLine(setting.name, setting.description);

    if (setting.type === "toggle") {
        form.toggle(label, {
            defaultValue: settingValues.get(setting.settingId) === true,
        });
        fields.push({
            setting,
            toValue: (raw) => typeof raw === "boolean" ? raw : undefined,
        });
        return;
    }

    if (setting.type === "slider") {
        const currentValue = settingValues.get(setting.settingId);
        form.slider(label, setting.min, setting.max, {
            valueStep: setting.step,
            defaultValue: typeof currentValue === "number" ? currentValue : setting.defaultValue,
        });
        fields.push({
            setting,
            toValue: (raw) => typeof raw === "number" ? raw : undefined,
        });
        return;
    }

    const options = setting.options.map((option) => option.label);
    const currentValue = settingValues.get(setting.settingId);
    const currentIndex = setting.options.findIndex((option) => option.value === currentValue);
    const defaultIndex = currentIndex >= 0
        ? currentIndex
        : Math.max(0, setting.options.findIndex((option) => option.value === setting.defaultValue));

    form.dropdown(label, options, {
        defaultValueIndex: defaultIndex,
    });
    fields.push({
        setting,
        toValue: (raw) => {
            if (typeof raw !== "number") return undefined;
            return setting.options[raw]?.value;
        },
    });
}

function getSettingGroups(): SettingGroup[] {
    const groups = new Map<string, StoredSetting[]>();
    for (const setting of getOrderedSettings()) {
        const title = setting.category ?? setting.addonId ?? UNCATEGORIZED_SETTINGS;
        const settings = groups.get(title) ?? [];
        settings.push(setting);
        groups.set(title, settings);
    }

    return [...groups.entries()]
        .map(([title, settings]) => ({ title, settings }))
        .sort((a, b) => a.title.localeCompare(b.title));
}

function getOrderedSettings(): StoredSetting[] {
    return [...settingRegistry.getAll().values()].sort(compareSettings);
}

function compareSettings(a: StoredSetting, b: StoredSetting): number {
    const ac = a.category ?? a.addonId ?? UNCATEGORIZED_SETTINGS;
    const bc = b.category ?? b.addonId ?? UNCATEGORIZED_SETTINGS;
    const categoryOrder = ac.localeCompare(bc);
    if (categoryOrder !== 0) return categoryOrder;

    const ao = a.order ?? Infinity;
    const bo = b.order ?? Infinity;
    if (ao !== bo) return ao - bo;

    return a.name.localeCompare(b.name);
}
