import { world, type Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { T } from "../constants/translate";
import { saveRoleComposition, saveRoleCompositionHistory } from "../persistence/gameManagerPersistence";
import { factionRegistry } from "../registry/factionRegistry";
import { roleRegistry } from "../registry/roleRegistry";
import { roleCompositionHistory } from "../state/roleCompositionHistory";
import { roleCountSettings } from "../state/roleCountSettings";
import type { RoleCompositionHistoryRecord } from "../types/roleCompositionHistory";
import type { StoredRole } from "../types/role";
import { formatJstDateTime } from "../ui/datetime";
import { playUiConfirmForAll } from "../ui/sounds";
import { rawtext, text, tr, trWith } from "../ui/text";

const PAGE_SIZE = 5;
const SEPARATOR = "§6---------------------§r";

type HistoryAction =
    | { readonly type: "restore"; readonly record: RoleCompositionHistoryRecord }
    | { readonly type: "previous" }
    | { readonly type: "next" };

export async function openRoleCompositionHistoryForm(player: Player): Promise<void> {
    let page = 0;

    while (true) {
        const records = roleCompositionHistory.getAll();
        if (records.length === 0) {
            const form = new ActionFormData()
                .title(tr(T.roleComposition.historyTitle))
                .body(tr(T.roleComposition.historyEmpty))
                .button(tr(T.setup.closeButton));
            await form.show(player);
            return;
        }

        const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
        page = Math.max(0, Math.min(page, pageCount - 1));

        const actions: HistoryAction[] = [];
        const form = new ActionFormData().title(tr(T.roleComposition.historyTitle));
        const pageRecords = records.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

        for (const record of pageRecords) {
            form.label(buildHistoryLabel(record));
            form.button(tr(T.roleComposition.historyRestoreButton));
            actions.push({ type: "restore", record });
            form.divider();
        }

        if (page > 0) {
            form.button(tr(T.roleComposition.historyPreviousPage));
            actions.push({ type: "previous" });
        }
        if (page < pageCount - 1) {
            form.button(tr(T.roleComposition.historyNextPage));
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

        restoreRoleCompositionFromHistory(player, action.record);
        return;
    }
}

function restoreRoleCompositionFromHistory(player: Player, record: RoleCompositionHistoryRecord): void {
    const before = roleCountSettings.toRecord();
    const after = record.after;
    if (!hasRoleCompositionChanged(before, after)) return;

    roleCountSettings.replaceAll(after);
    saveRoleComposition();

    const nextRecord = createHistoryRecord(player, before, after);
    roleCompositionHistory.add(nextRecord);
    saveRoleCompositionHistory();
    notifyRoleCompositionChanged(player, getSelectedRolesFromCounts(after), getTotal(after));
}

function buildHistoryLabel(record: RoleCompositionHistoryRecord) {
    const selectedRoles = getSelectedRolesFromCounts(record.after);
    return rawtext([
        trWith(T.roleComposition.historyChangedAt, [formatJstDateTime(record.changedAtUnixMs)]),
        text("\n"),
        trWith(T.roleComposition.historyChangedBy, [record.changedByName]),
        text("\n§6---------------------§r\n"),
        tr(T.roleComposition.historyAfter),
        text("\n"),
        ...buildRoleCompositionParts(selectedRoles, record.after),
        text("\n\n"),
        tr(T.roleComposition.total),
        text(` ${getTotal(record.after)}`),
    ]);
}

export function createHistoryRecord(
    player: Player,
    before: Record<string, number>,
    after: Record<string, number>,
): RoleCompositionHistoryRecord {
    const changedAtUnixMs = Date.now();
    return {
        id: `${changedAtUnixMs}-${Math.floor(Math.random() * 1_000_000)}`,
        changedAtUnixMs,
        changedAtIso: new Date(changedAtUnixMs).toISOString(),
        changedByPlayerId: player.id,
        changedByName: player.name,
        before,
        after,
        diffs: buildDiffs(before, after),
    };
}

export function hasRoleCompositionChanged(before: Record<string, number>, after: Record<string, number>): boolean {
    const roleIds = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const roleId of roleIds) {
        if ((before[roleId] ?? 0) !== (after[roleId] ?? 0)) return true;
    }
    return false;
}

export function notifyRoleCompositionChanged(player: Player, selectedRoles: StoredRole[], total: number): void {
    playUiConfirmForAll();
    world.sendMessage(rawtext([
        trWith(T.roleComposition.appliedNotice, [player.name]),
        text(`\n${SEPARATOR}`),
        text("\n"),
        tr(T.roleComposition.current),
        text("\n"),
        ...buildRoleCompositionParts(selectedRoles, roleCountSettings.toRecord()),
        text("\n\n"),
        tr(T.roleComposition.total),
        text(` ${total}`),
        text(`\n${SEPARATOR}`),
    ]));
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

function buildDiffs(before: Record<string, number>, after: Record<string, number>) {
    const roleIds = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...roleIds]
        .map((roleId) => ({
            roleId,
            addonId: roleRegistry.get(roleId)?.addonId ?? "",
            from: before[roleId] ?? 0,
            to: after[roleId] ?? 0,
        }))
        .filter((diff) => diff.from !== diff.to);
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
