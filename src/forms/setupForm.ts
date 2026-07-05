import type { Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { T } from "../constants/translate";
import { tr } from "../ui/text";
import { openRoleCountForm } from "./roleCountForm";
import { openSettingsForm } from "./settingsForm";

export async function openSetupForm(player: Player): Promise<void> {
    const form = new ActionFormData()
        .title(tr(T.setup.title))
        .body(tr(T.setup.body))
        .button(tr(T.setup.roleSettingsButton))
        .button(tr(T.setup.gameSettingsButton))
        .button(tr(T.setup.closeButton));

    const response = await form.show(player);
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 2) return;

    if (response.selection === 0) {
        await openRoleCountForm(player);
        return;
    }

    if (response.selection === 1) {
        await openSettingsForm(player);
    }
}
