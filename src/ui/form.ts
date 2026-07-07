import { InputPermissionCategory, type Player } from "@minecraft/server";
import type { ActionFormData, ActionFormResponse } from "@minecraft/server-ui";

export async function showActionForm(player: Player, form: ActionFormData): Promise<ActionFormResponse> {
    const wasCameraEnabled = player.inputPermissions.isPermissionCategoryEnabled(InputPermissionCategory.Camera);
    const wasMovementEnabled = player.inputPermissions.isPermissionCategoryEnabled(InputPermissionCategory.Movement);

    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, false);
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false);
    try {
        return await form.show(player);
    } finally {
        player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, wasMovementEnabled);
        player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, wasCameraEnabled);
    }
}
