import type { Player } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { T } from "../constants/translate";
import {
    saveRoleComposition,
    saveRoleCompositionHistory,
    saveSavedRoleCompositions,
} from "../persistence/gameManagerPersistence";
import { factionRegistry } from "../registry/factionRegistry";
import { roleRegistry } from "../registry/roleRegistry";
import { roleCompositionHistory } from "../state/roleCompositionHistory";
import { roleCountSettings } from "../state/roleCountSettings";
import { savedRoleCompositions } from "../state/savedRoleCompositions";
import type { SavedRoleCompositionRecord } from "../types/savedRoleComposition";
import type { StoredRole } from "../types/role";
import { formatJstDateTime } from "../ui/datetime";
import { rawtext, text, tr, trWith } from "../ui/text";
import {
    createHistoryRecord,
    hasRoleCompositionChanged,
    notifyRoleCompositionChanged,
} from "./roleCompositionHistoryForm";

const PAGE_SIZE = 5;

type SavedAction =
    | { readonly type: "save-current" }
    | { readonly type: "restore"; readonly record: SavedRoleCompositionRecord }
    | { readonly type: "delete" }
    | { readonly type: "previous" }
    | { readonly type: "next" };

export async function openSavedRoleCompositionsForm(player: Player): Promise<void> {
    let page = 0;

    while (true) {
        const records = savedRoleCompositions.getAll();
        const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
        page = Math.max(0, Math.min(page, pageCount - 1));

        const actions: SavedAction[] = [];
        const form = new ActionFormData()
            .title(tr(T.roleComposition.savedTitle))
            .label(buildCurrentCompositionLabel())
            .button(tr(T.roleComposition.savedSaveCurrentButton));
        actions.push({ type: "save-current" });
        form.divider();

        if (records.length === 0) {
            form.label(tr(T.roleComposition.savedEmpty));
        } else {
            const pageRecords = records.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
            for (const record of pageRecords) {
                form.label(buildSavedCompositionLabel(record));
                form.button(tr(T.roleComposition.savedRestoreButton));
                actions.push({ type: "restore", record });
                form.divider();
            }
        }

        form.button(tr(T.roleComposition.savedDeleteButton));
        actions.push({ type: "delete" });

        if (page > 0) {
            form.button(tr(T.roleComposition.savedPreviousPage));
            actions.push({ type: "previous" });
        }
        if (page < pageCount - 1) {
            form.button(tr(T.roleComposition.savedNextPage));
            actions.push({ type: "next" });
        }

        const response = await form.show(player);
        if (response.canceled || response.selection === undefined) return;

        const action = actions[response.selection];
        if (!action) return;
        if (action.type === "previous") {
            page--;
            continue;
        }
        if (action.type === "next") {
            page++;
            continue;
        }
        if (action.type === "save-current") {
            await openSaveCurrentCompositionForm(player);
            continue;
        }
        if (action.type === "delete") {
            await openDeleteSavedCompositionForm(player);
            continue;
        }

        restoreSavedRoleComposition(player, action.record);
        return;
    }
}

async function openSaveCurrentCompositionForm(player: Player): Promise<void> {
    const form = new ModalFormData()
        .title(tr(T.roleComposition.savedNameTitle))
        .textField(tr(T.roleComposition.savedNameLabel), tr(T.roleComposition.savedNamePlaceholder))
        .submitButton(tr(T.roleComposition.savedSubmitButton));

    const response = await form.show(player);
    if (response.canceled || !response.formValues) return;

    const name = typeof response.formValues[0] === "string" ? response.formValues[0].trim() : "";
    if (!name) {
        player.sendMessage(tr(T.roleComposition.savedEmptyName));
        return;
    }
    if (savedRoleCompositions.hasName(name)) {
        player.sendMessage(trWith(T.roleComposition.savedDuplicateName, [name]));
        return;
    }

    savedRoleCompositions.add(createSavedRoleCompositionRecord(player, name, roleCountSettings.toRecord()));
    saveSavedRoleCompositions();
    player.sendMessage(trWith(T.roleComposition.savedSaved, [name]));
}

async function openDeleteSavedCompositionForm(player: Player): Promise<void> {
    const records = savedRoleCompositions.getAll();
    if (records.length === 0) {
        player.sendMessage(tr(T.roleComposition.savedEmpty));
        return;
    }

    const form = new ModalFormData()
        .title(tr(T.roleComposition.savedDeleteTitle))
        .dropdown(tr(T.roleComposition.savedDeleteDropdown), records.map((record) => record.name))
        .submitButton(tr(T.roleComposition.savedDeleteSubmitButton));

    const response = await form.show(player);
    if (response.canceled || !response.formValues) return;

    const index = response.formValues[0];
    if (typeof index !== "number") return;

    const record = records[index];
    if (!record) return;

    savedRoleCompositions.delete(record.id);
    saveSavedRoleCompositions();
    player.sendMessage(trWith(T.roleComposition.savedDeleted, [record.name]));
}

function restoreSavedRoleComposition(player: Player, record: SavedRoleCompositionRecord): void {
    const before = roleCountSettings.toRecord();
    const after = record.counts;
    if (!hasRoleCompositionChanged(before, after)) return;

    roleCountSettings.replaceAll(after);
    saveRoleComposition();

    roleCompositionHistory.add(createHistoryRecord(player, before, after));
    saveRoleCompositionHistory();
    notifyRoleCompositionChanged(player, getSelectedRolesFromCounts(after), getTotal(after));
}

function createSavedRoleCompositionRecord(
    player: Player,
    name: string,
    counts: Record<string, number>,
): SavedRoleCompositionRecord {
    const savedAtUnixMs = Date.now();
    return {
        id: `${savedAtUnixMs}-${Math.floor(Math.random() * 1_000_000)}`,
        name,
        savedAtUnixMs,
        savedAtIso: new Date(savedAtUnixMs).toISOString(),
        savedByPlayerId: player.id,
        savedByName: player.name,
        counts,
    };
}

function buildCurrentCompositionLabel() {
    const counts = roleCountSettings.toRecord();
    return rawtext([
        tr(T.roleComposition.current),
        text("\n"),
        ...buildRoleCompositionParts(getSelectedRolesFromCounts(counts), counts),
        text("\n\n"),
        tr(T.roleComposition.total),
        text(` ${getTotal(counts)}`),
    ]);
}

function buildSavedCompositionLabel(record: SavedRoleCompositionRecord) {
    const selectedRoles = getSelectedRolesFromCounts(record.counts);
    return rawtext([
        text("§6"),
        tr(record.name),
        text("§r\n"),
        trWith(T.roleComposition.savedAt, [formatJstDateTime(record.savedAtUnixMs)]),
        text("\n"),
        trWith(T.roleComposition.savedBy, [record.savedByName]),
        text("\n§6---------------------§r\n"),
        tr(T.roleComposition.savedComposition),
        text("\n"),
        ...buildRoleCompositionParts(selectedRoles, record.counts),
        text("\n\n"),
        tr(T.roleComposition.total),
        text(` ${getTotal(record.counts)}`),
    ]);
}

function buildRoleCompositionParts(selectedRoles: StoredRole[], counts: Record<string, number>) {
    return selectedRoles.length > 0
        ? selectedRoles.flatMap((role, index) => [
            ...(index > 0 ? [text("\n")] : []),
            text(getRoleColor(role)),
            tr(role.name),
            text(`§r: ${counts[role.roleId] ?? 0}`),
        ])
        : [tr(T.roleComposition.noneRoles)];
}

function getSelectedRolesFromCounts(counts: Record<string, number>): StoredRole[] {
    return Object.keys(counts)
        .filter((roleId) => (counts[roleId] ?? 0) > 0)
        .map((roleId) => roleRegistry.get(roleId))
        .filter((role): role is StoredRole => role !== undefined)
        .sort(compareRoles);
}

function getTotal(counts: Record<string, number>): number {
    return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function compareRoles(a: StoredRole, b: StoredRole): number {
    const ai = a.index ?? Infinity;
    const bi = b.index ?? Infinity;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
}

function getRoleColor(role: StoredRole): string {
    return role.color ?? factionRegistry.get(role.faction)?.color ?? "§f";
}
