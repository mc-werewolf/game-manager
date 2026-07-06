export type SettingValue = boolean | number | string;

export type StoredSetting =
    | StoredToggleSetting
    | StoredSliderSetting
    | StoredDropdownSetting;

type StoredSettingBase = {
    readonly settingId: string;
    readonly name: string;
    readonly description: string | undefined;
    readonly category: string | undefined;
    readonly order: number | undefined;
    readonly addonId: string;
};

export type StoredToggleSetting = StoredSettingBase & {
    readonly type: "toggle";
    readonly defaultValue: boolean;
};

export type StoredSliderSetting = StoredSettingBase & {
    readonly type: "slider";
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly defaultValue: number;
};

export type StoredDropdownSetting = StoredSettingBase & {
    readonly type: "dropdown";
    readonly options: readonly {
        readonly value: string;
        readonly label: string;
    }[];
    readonly defaultValue: string;
};

