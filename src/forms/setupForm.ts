import type { Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { openRoleCountForm } from "./roleCountForm";

export async function openSetupForm(player: Player): Promise<void> {
    const form = new ActionFormData()
        .title("ゲーム設定")
        .body("設定項目を選択してください")
        .button("役職人数の変更")
        .button("閉じる");

    const response = await form.show(player);
    if (response.canceled || response.selection === 1) return;

    if (response.selection === 0) {
        await openRoleCountForm(player);
    }
}
