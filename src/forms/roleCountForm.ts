import type { Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import type { StoredRole } from "../types/role";
import { roleRegistry } from "../registry/roleRegistry";
import { roleCountSettings } from "../state/roleCountSettings";
import { openAddonRoleForm } from "./addonRoleForm";

export async function openRoleCountForm(player: Player): Promise<void> {
    while (true) {
        const allRoles = [...roleRegistry.getAll().values()];
        const rolesByAddon = groupByAddon(allRoles);
        const addonIds = [...rolesByAddon.keys()];

        const selectedRoles = allRoles
            .filter((r) => roleCountSettings.get(r.roleId) > 0)
            .sort(compareRoles);

        const bodyLines = selectedRoles.length > 0
            ? selectedRoles.map((r) => `§a${r.name}§r  x${roleCountSettings.get(r.roleId)}`).join("\n")
            : "§7（まだ役職が選択されていません）";

        const form = new ActionFormData()
            .title("役職人数の設定")
            .body(bodyLines)
            .button("§l確定")
            .divider();

        for (const addonId of addonIds) {
            form.button(addonId);
        }

        const response = await form.show(player);
        if (response.canceled) return;

        const sel = response.selection!;

        if (sel === 0) return; // 確定

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
