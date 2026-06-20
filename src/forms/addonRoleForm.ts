import type { Player } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import type { StoredRole } from "../types/role";
import { roleCountSettings } from "../state/roleCountSettings";

export async function openAddonRoleForm(player: Player, addonId: string, roles: StoredRole[]): Promise<void> {
    const sorted = [...roles].sort(compareRoles);

    const form = new ModalFormData().title(addonId);
    for (const role of sorted) {
        form.slider(role.name, 0, role.max, {
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
}

function compareRoles(a: StoredRole, b: StoredRole): number {
    const ai = a.index ?? Infinity;
    const bi = b.index ?? Infinity;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
}
