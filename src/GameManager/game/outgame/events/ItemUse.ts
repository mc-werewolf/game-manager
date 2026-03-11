import { ItemUseAfterEvent, ItemUseBeforeEvent, world } from "@minecraft/server";
import { BaseEventHandler } from "../../events/BaseEventHandler";
import type { OutGameEventManager } from "./OutGameEventManager";
import { ITEM_USE } from "../../../constants/itemuse";
import { SCRIPT_EVENT_COMMAND_IDS } from "../../../constants/scriptevent";
import { KAIRO_COMMAND_TARGET_ADDON_IDS } from "../../../constants/systems";
import { KairoUtils } from "@kairo-js/router";

export class OutGameItemUseHandler extends BaseEventHandler<ItemUseBeforeEvent, ItemUseAfterEvent> {
    private constructor(private readonly outGameEventManager: OutGameEventManager) {
        super(outGameEventManager);
    }

    public static create(outGameEventManager: OutGameEventManager): OutGameItemUseHandler {
        return new OutGameItemUseHandler(outGameEventManager);
    }

    protected beforeEvent = world.beforeEvents.itemUse;
    protected afterEvent = world.afterEvents.itemUse;

    protected handleBefore(ev: ItemUseBeforeEvent): void {
        // 使用前処理
    }

    protected handleAfter(ev: ItemUseAfterEvent): void {
        // 使用後処理
        const { itemStack, source } = ev;

        switch (itemStack.typeId) {
            case ITEM_USE.GAME_STARTER_ITEM_ID:
                KairoUtils.sendKairoCommand(
                    KAIRO_COMMAND_TARGET_ADDON_IDS.WEREWOLF_GAMEMANAGER,
                    SCRIPT_EVENT_COMMAND_IDS.WEREWOLF_GAME_START,
                );
                break;
            case ITEM_USE.GAME_SETTINGS_ITEM_ID:
                this.outGameEventManager.getOutGameManager().openSettingsForm(source);
                break;
            default:
                break;
        }
    }
}
