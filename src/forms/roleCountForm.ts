import type { Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { T } from "../constants/translate";
import type { StoredRole } from "../types/role";
import { factionRegistry } from "../registry/factionRegistry";
import { roleRegistry } from "../registry/roleRegistry";
import { roleCountSettings } from "../state/roleCountSettings";
import { roleCompositionHistory } from "../state/roleCompositionHistory";
import { saveRoleCompositionHistory } from "../persistence/gameManagerPersistence";
import { rawtext, text, tr } from "../ui/text";
import { openAddonRoleForm } from "./addonRoleForm";
import {
    createHistoryRecord,
    hasRoleCompositionChanged,
    notifyRoleCompositionChanged,
    openRoleCompositionHistoryForm,
} from "./roleCompositionHistoryForm";
import { openSavedRoleCompositionsForm } from "./savedRoleCompositionsForm";

export async function openRoleCountForm(player: Player): Promise<void> {
    const initialCounts = roleCountSettings.toRecord();

    while (true) {
        const allRoles = [...roleRegistry.getAll().values()];
        const rolesByAddon = groupByAddon(allRoles);
        const addonIds = [...rolesByAddon.keys()];

        const selectedRoles = allRoles
            .filter((r) => roleCountSettings.get(r.roleId) > 0)
            .sort(compareRoles);

        const total = selectedRoles.reduce((sum, role) => sum + roleCountSettings.get(role.roleId), 0);
        const body = rawtext([
            tr(T.roleComposition.current),
            text("\n"),
            ...(selectedRoles.length > 0
                ? selectedRoles.flatMap((role, index) => [
                    ...(index > 0 ? [text("\n")] : []),
                    text(getRoleColor(role)),
                    tr(role.name),
                    text(`§r: ${roleCountSettings.get(role.roleId)}`),
                ])
                : [tr(T.roleComposition.noneRoles)]),
            text("\n\n"),
            tr(T.roleComposition.total),
            text(` ${total}`),
        ]);

        const form = new ActionFormData()
            .title(tr(T.roleComposition.title))
            .body(body)
            .button(rawtext([text("§l"), tr(T.roleComposition.confirm)]))
            .divider();

        for (const addonId of addonIds) {
            form.button(tr(addonId));
        }
        form.divider();
        form.button(tr(T.roleComposition.savedButton));
        form.button(tr(T.roleComposition.historyButton));

        const response = await form.show(player);
        if (response.canceled) return;

        const sel = response.selection!;

        if (sel === 0) {
            const afterCounts = roleCountSettings.toRecord();
            if (hasRoleCompositionChanged(initialCounts, afterCounts)) {
                roleCompositionHistory.add(createHistoryRecord(player, initialCounts, afterCounts));
                saveRoleCompositionHistory();
                notifyRoleCompositionChanged(player, selectedRoles, total);
            }
            return; // 確定
        }

        if (sel === addonIds.length + 1) {
            await openSavedRoleCompositionsForm(player);
            continue;
        }

        if (sel === addonIds.length + 2) {
            await openRoleCompositionHistoryForm(player);
            continue;
        }

        const addonId = addonIds[sel - 1];
        const roles = addonId ? rolesByAddon.get(addonId) : undefined;
        if (!addonId || !roles) continue;
        await openAddonRoleForm(player, addonId, roles);
        // アドオンフォームから戻ったら人数一覧を再表示
    }
}

function groupByAddon(roles: StoredRole[]): Map<string, StoredRole[]> {
    const result = new Map<string, StoredRole[]>();
    for (const role of roles) {
        const list = result.get(role.addonId) ?? [];
        list.push(role);
        result.set(role.addonId, list);
    }
    return result;
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
