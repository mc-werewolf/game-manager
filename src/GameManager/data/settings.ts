import type { RawMessage } from "@minecraft/server";
import { properties } from "../../properties";
import { WEREWOLF_GAMEMANAGER_TRANSLATE_IDS } from "../constants/translate";
import { SCRIPT_EVENT_COMMAND_IDS } from "../constants/scriptevent";
import type { BaseDefinition } from "./roles";

export interface SettingDefinition extends BaseDefinition {}

export interface SettingNodeBase {
    id: string;
    title: RawMessage;
    iconPath?: string;
    order?: number;
}

export interface SettingCommand {
    commandId: string;
    targetAddonId: string;
}

export interface SettingCategoryNode extends SettingNodeBase {
    type: "category";
    children: SettingNode[];
}

export interface SettingItemNode extends SettingNodeBase {
    type: "item";
    command: SettingCommand;
}

export type SettingNode = SettingCategoryNode | SettingItemNode;

export const ROOT_SETTINGS: SettingCategoryNode = {
    id: "root",
    title: {
        translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_SETTING_TITLE,
    },
    type: "category",
    children: [
        {
            id: "RoleComposition",
            title: {
                translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_TITLE,
            },
            type: "item",
            command: {
                commandId: SCRIPT_EVENT_COMMAND_IDS.OPEN_FORM_ROLE_COMPOSITION,
                targetAddonId: properties.id,
            },
            order: 100,
        },
        {
            id: "GameSettings",
            title: {
                translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_SETTING_TITLE,
            },
            type: "category",
            order: 200,
            children: [
                {
                    id: "RoleSettings",
                    title: {
                        translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_SETTING_TITLE,
                    },
                    type: "item",
                    command: {
                        commandId: SCRIPT_EVENT_COMMAND_IDS.OPEN_FORM_ROLE_SETTINGS,
                        targetAddonId: properties.id,
                    },
                    order: 100,
                },
                {
                    id: "GameSettings",
                    title: {
                        translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_SETTING_TITLE,
                    },
                    type: "item",
                    command: {
                        commandId: SCRIPT_EVENT_COMMAND_IDS.OPEN_FORM_GAME_SETTINGS,
                        targetAddonId: properties.id,
                    },
                    order: 200,
                },
            ],
        },
        {
            id: "Credit",
            title: {
                translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME.CREDITS.TITLE,
            },
            type: "item",
            command: {
                commandId: SCRIPT_EVENT_COMMAND_IDS.OPEN_FORM_WEREWOLF_GAME_CREDIT,
                targetAddonId: properties.id,
            },
            order: 10000,
        },
    ],
};
