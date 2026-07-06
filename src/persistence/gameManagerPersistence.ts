import { router } from "@kairo-js/router";
import { roleCompositionHistory } from "../state/roleCompositionHistory";
import { roleCountSettings } from "../state/roleCountSettings";
import { savedRoleCompositions } from "../state/savedRoleCompositions";
import { settingValues } from "../state/settingValues";
import type { RoleCompositionHistoryRecord } from "../types/roleCompositionHistory";
import type { SavedRoleCompositionRecord } from "../types/savedRoleComposition";
import type { SettingValue } from "../types/setting";

const SETTINGS_KEY = "settings";
const ROLE_COMPOSITION_KEY = "role-composition";
const ROLE_COMPOSITION_HISTORY_KEY = "role-composition-history";
const SAVED_ROLE_COMPOSITIONS_KEY = "saved-role-compositions";

export async function restoreGameManagerState(): Promise<void> {
    await Promise.all([
        restoreSettings(),
        restoreRoleComposition(),
        restoreRoleCompositionHistory(),
        restoreSavedRoleCompositions(),
    ]);
}

export function saveSettings(): void {
    router.save(SETTINGS_KEY, settingValues.getStoredValues()).catch((err) => {
        console.error("[game-manager] Failed to save settings:", err);
    });
}

export function saveRoleComposition(): void {
    router.save(ROLE_COMPOSITION_KEY, roleCountSettings.toRecord()).catch((err) => {
        console.error("[game-manager] Failed to save role composition:", err);
    });
}

export function saveRoleCompositionHistory(): void {
    router.save(ROLE_COMPOSITION_HISTORY_KEY, roleCompositionHistory.getAll()).catch((err) => {
        console.error("[game-manager] Failed to save role composition history:", err);
    });
}

export function saveSavedRoleCompositions(): void {
    router.save(SAVED_ROLE_COMPOSITIONS_KEY, savedRoleCompositions.getAll()).catch((err) => {
        console.error("[game-manager] Failed to save saved role compositions:", err);
    });
}

async function restoreSettings(): Promise<void> {
    const stored = await router.load<Record<string, SettingValue>>(SETTINGS_KEY);
    if (!isSettingValueRecord(stored)) return;
    settingValues.replaceAll(stored);
}

async function restoreRoleComposition(): Promise<void> {
    const stored = await router.load<Record<string, number>>(ROLE_COMPOSITION_KEY);
    if (!isNumberRecord(stored)) return;
    roleCountSettings.replaceAll(stored);
}

async function restoreRoleCompositionHistory(): Promise<void> {
    const stored = await router.load<RoleCompositionHistoryRecord[]>(ROLE_COMPOSITION_HISTORY_KEY);
    if (!isRoleCompositionHistoryRecordArray(stored)) return;
    roleCompositionHistory.replaceAll(stored);
}

async function restoreSavedRoleCompositions(): Promise<void> {
    const stored = await router.load<SavedRoleCompositionRecord[]>(SAVED_ROLE_COMPOSITIONS_KEY);
    if (!isSavedRoleCompositionRecordArray(stored)) return;
    savedRoleCompositions.replaceAll(stored);
}

function isSettingValueRecord(value: unknown): value is Record<string, SettingValue> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Object.values(value).every((v) => typeof v === "boolean" || typeof v === "number" || typeof v === "string");
}

function isNumberRecord(value: unknown): value is Record<string, number> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Object.values(value).every((v) => typeof v === "number");
}

function isRoleCompositionHistoryRecordArray(value: unknown): value is RoleCompositionHistoryRecord[] {
    if (!Array.isArray(value)) return false;
    return value.every((record) => {
        if (!record || typeof record !== "object" || Array.isArray(record)) return false;
        const candidate = record as Partial<RoleCompositionHistoryRecord>;
        return typeof candidate.id === "string"
            && typeof candidate.changedAtUnixMs === "number"
            && typeof candidate.changedAtIso === "string"
            && typeof candidate.changedByPlayerId === "string"
            && typeof candidate.changedByName === "string"
            && isNumberRecord(candidate.before)
            && isNumberRecord(candidate.after)
            && Array.isArray(candidate.diffs);
    });
}

function isSavedRoleCompositionRecordArray(value: unknown): value is SavedRoleCompositionRecord[] {
    if (!Array.isArray(value)) return false;
    return value.every((record) => {
        if (!record || typeof record !== "object" || Array.isArray(record)) return false;
        const candidate = record as Partial<SavedRoleCompositionRecord>;
        return typeof candidate.id === "string"
            && typeof candidate.name === "string"
            && typeof candidate.savedAtUnixMs === "number"
            && typeof candidate.savedAtIso === "string"
            && typeof candidate.savedByPlayerId === "string"
            && typeof candidate.savedByName === "string"
            && isNumberRecord(candidate.counts);
    });
}
