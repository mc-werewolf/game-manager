import type { ApiHandlerContext } from "@kairo-js/router";
import { settingRegistry } from "../registry/settingRegistry";
import type { StoredSetting } from "../types/setting";

type RegisterSettingArgs =
    | RegisterToggleSettingArgs
    | RegisterSliderSettingArgs
    | RegisterDropdownSettingArgs;

type RegisterSettingBase = {
    id: string;
    name: string;
    description?: string;
    category?: string;
    order?: number;
};

type RegisterToggleSettingArgs = RegisterSettingBase & {
    type: "toggle";
    defaultValue: boolean;
};

type RegisterSliderSettingArgs = RegisterSettingBase & {
    type: "slider";
    min: number;
    max: number;
    step: number;
    defaultValue: number;
};

type RegisterDropdownSettingArgs = RegisterSettingBase & {
    type: "dropdown";
    options: {
        value: string;
        label: string;
    }[];
    defaultValue: string;
};

export function handleRegisterSetting(args: RegisterSettingArgs, ctx: ApiHandlerContext): void {
    validateSettingArgs(args);
    settingRegistry.register(toStoredSetting(args, ctx.callerAddonId));
}

function validateSettingArgs(args: RegisterSettingArgs): void {
    if (!args.id) {
        throw new Error("[game-manager] Setting id is required");
    }
    if (!args.name) {
        throw new Error(`[game-manager] Setting "${args.id}" name is required`);
    }

    if (args.type === "slider") {
        if (args.max < args.min) {
            throw new Error(`[game-manager] Setting "${args.id}" max must be greater than or equal to min`);
        }
        if (args.step <= 0) {
            throw new Error(`[game-manager] Setting "${args.id}" step must be greater than 0`);
        }
        if (args.defaultValue < args.min || args.defaultValue > args.max) {
            throw new Error(`[game-manager] Setting "${args.id}" defaultValue must be within slider range`);
        }
        return;
    }

    if (args.type === "dropdown") {
        if (args.options.length === 0) {
            throw new Error(`[game-manager] Setting "${args.id}" dropdown options must not be empty`);
        }
        if (!args.options.some((option) => option.value === args.defaultValue)) {
            throw new Error(`[game-manager] Setting "${args.id}" defaultValue must match one dropdown option`);
        }
    }
}

function toStoredSetting(args: RegisterSettingArgs, addonId: string): StoredSetting {
    const base = {
        settingId: args.id,
        name: args.name,
        description: args.description,
        category: args.category,
        order: args.order,
        addonId,
    };

    if (args.type === "toggle") {
        return {
            ...base,
            type: "toggle",
            defaultValue: args.defaultValue,
        };
    }

    if (args.type === "slider") {
        return {
            ...base,
            type: "slider",
            min: args.min,
            max: args.max,
            step: args.step,
            defaultValue: args.defaultValue,
        };
    }

    return {
        ...base,
        type: "dropdown",
        options: args.options,
        defaultValue: args.defaultValue,
    };
}
