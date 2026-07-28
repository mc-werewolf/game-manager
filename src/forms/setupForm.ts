import type { Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { router, type CanceledResult } from "@kairo-js/router";
import { T } from "../constants/translate";
import { setupFormActionRegistry } from "../registry/setupFormActionRegistry";
import type { StoredSetupFormAction } from "../types/setupFormAction";
import { rawtext, text, tr } from "../ui/text";
import { openRoleCountForm } from "./roleCountForm";
import { openSettingsForm } from "./settingsForm";

export async function openSetupForm(player: Player): Promise<void> {
    const externalActions = getOrderedSetupFormActions();
    const form = new ActionFormData()
        .title(tr(T.setup.title))
        .body(tr(T.setup.body))
        .button(tr(T.setup.roleSettingsButton))
        .button(tr(T.setup.gameSettingsButton));

    for (const action of externalActions) {
        form.button(formatActionButton(action));
    }

    form.button(tr(T.setup.closeButton));

    const response = await form.show(player);
    if (response.canceled || response.selection === undefined) return;
    const closeSelection = 2 + externalActions.length;
    if (response.selection === closeSelection) return;

    if (response.selection === 0) {
        await openRoleCountForm(player);
        return;
    }

    if (response.selection === 1) {
        await openSettingsForm(player);
        return;
    }

    const action = externalActions[response.selection - 2];
    if (action) {
        await invokeSetupFormAction(player, action);
    }
}

function getOrderedSetupFormActions(): StoredSetupFormAction[] {
    return [...setupFormActionRegistry.getAll().values()].sort((a, b) => {
        const ao = a.order ?? Infinity;
        const bo = b.order ?? Infinity;
        if (ao !== bo) return ao - bo;
        return a.id.localeCompare(b.id);
    });
}

function formatActionButton(action: StoredSetupFormAction) {
    if (!action.description) return tr(action.label);
    return rawtext([
        tr(action.label),
        text("\n§7"),
        tr(action.description),
        text("§r"),
    ]);
}

async function invokeSetupFormAction(player: Player, action: StoredSetupFormAction): Promise<void> {
    const result = await router.request(action.addonId, action.apiName, {
        playerId: player.id,
        playerName: player.name,
    });
    if (isCanceledResult(result)) {
        player.sendMessage(`[game-manager] ${action.id} is unavailable: ${result.reason}`);
    }
}

function isCanceledResult(value: unknown): value is CanceledResult {
    return typeof value === "object" && value !== null && "canceled" in value;
}
