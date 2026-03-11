import type { RawMessage } from "@minecraft/server";
import { WEREWOLF_GAMEMANAGER_TRANSLATE_IDS } from "../constants/translate";

export const GameEventTypeValues = [
    "AfterGameStart",
    "BeforeMeetingStart",
    "AfterMeetingStart",
    "SkillUse",
    "SkillUseInMeeting",
    "SkillUseOutMeeting",
    "Death",
] as const;
export type GameEventType = (typeof GameEventTypeValues)[number];

interface RoleKey {
    addonId: string;
    roleId: string;
}

type RoleRef = RoleKey;

export interface BaseDefinition {
    providerAddonId: string; // 登録要求時に GameManager が独自に付与する。定義側では不要
    id: string;
}

export interface RoleDefinition extends BaseDefinition {
    name: RawMessage;
    description: RawMessage;
    factionId: string;
    roleGroup?: {
        id: string;
        name: RawMessage;
        color: string;
    };
    isExcludedFromSurvivalCheck?: boolean; // 主に狂人枠で使用
    count?: {
        max?: number;
        step?: number;
    };
    color?: string; // 指定しなければ、チームに基づいて自動で決定される
    divinationResult?: string; // 占い結果 roleId (別アドオンでも可)
    clairvoyanceResult?: string; // 霊視結果 roleId (別アドオンでも可)
    revealTo?: {
        roles?: string[];
        factions?: string[];
        roleGroups?: string[];
    };
    skills?: SkillDefinition[]; // 役職に紐づくスキル定義
    handleGameEvents?: RoleSkillEvents; // スキルのトリガーとなるイベント
    appearance?: {
        toSelf?: RoleRef; // 自分目線の表示 (呪われし者とか)
        toOthers?: RoleRef; // 他人目線の表示 (テレパシストとか)
        toWerewolves?: RoleRef; // 人狼目線の表示 (スパイとか)
    };
    sortIndex: number; // ソート順
}

export type SkillValue = number | string;
export interface SkillDefinition {
    id: string;
    name: RawMessage;
    cooldown?: SkillValue; // seconds
    maxUses?: SkillValue;
}
export interface SkillEventBinding {
    skillId: string;
}
export type RoleSkillEvents = Partial<Record<GameEventType, SkillEventBinding>>;

/**
 * 役職が足りなかった場合に割り当てられるデフォルト役職
 * 初期化時に登録はせず、直接この場所からimportして使います
 * 後から消します
 */
export const defaultRole: RoleDefinition = {
    providerAddonId: "werewolf-gamemanager",
    id: "villager",
    name: { translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.ROLE_NAME_VILLAGER },
    description: { translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.ROLE_DESCRIPTION_VILLAGER },
    factionId: "villager",
    count: { max: 40 },
    sortIndex: 0,
};
