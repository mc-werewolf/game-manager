import type { Player } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import type { StoredRole } from "../types/role";
import { saveRoleComposition } from "../persistence/gameManagerPersistence";
import { factionRegistry } from "../registry/factionRegistry";
import { roleCountSettings } from "../state/roleCountSettings";
import { rawtext, text, tr } from "../ui/text";

export async function openAddonRoleForm(player: Player, addonId: string, roles: StoredRole[]): Promise<void> {
    const sorted = [...roles].sort(compareRoles);

    const form = new ModalFormData().title(tr(addonId));
    for (const role of sorted) {
        form.slider(rawtext([
            text(getRoleColor(role)),
            tr(role.name),
            text("§r"),
        ]), 0, role.max, {
            valueStep: role.step,
            defaultValue: roleCountSettings.get(role.roleId),
        });
    }

    const response = await form.show(player);
    console.log(`[addonRoleForm] canceled=${response.canceled} reason=${response.cancelationReason}`);
    if (response.canceled || !response.formValues) return;

    for (let i = 0; i < sorted.length; i++) {
        const role = sorted[i];
        const value = response.formValues[i];
        if (role && typeof value === "number") {
            roleCountSettings.set(role.roleId, value);
        }
    }
    saveRoleComposition();
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
