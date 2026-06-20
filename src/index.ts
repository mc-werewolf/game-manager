import { type Player, ItemLockMode, ItemStack, world } from "@minecraft/server";
import { router } from "@kairo-js/router";
import { properties } from "./properties";
import { GAME_START_ITEM, GAME_START_ITEM_SLOT, GAME_SETUP_ITEM, GAME_SETUP_ITEM_SLOT } from "./constants/items";
import { WEREWOLF_GAMERULES } from "./constants/gamerules";
import { handleRegisterFaction } from "./api/registerFaction";
import { handleRegisterRole } from "./api/registerRole";
import { openSetupForm } from "./forms/setupForm";

router.init(properties);

router.beforeEvents.startup.subscribe((ev) => {
    ev.addonApi.register("game:registerFaction", handleRegisterFaction);
    ev.addonApi.register("game:registerRole", handleRegisterRole);
});

router.afterEvents.addonActivate.subscribe((_ev) => {
    Object.assign(world.gameRules, WEREWOLF_GAMERULES);

    for (const player of world.getPlayers()) {
        giveSetupItems(player);
    }

    router.afterEvents.itemUse.subscribe((ev) => {
        if (ev.itemStack.typeId === GAME_SETUP_ITEM) {
            openSetupForm(ev.source);
            return;
        }
        if (ev.itemStack.typeId === GAME_START_ITEM) {
            // TODO: ゲーム開始処理
        }
    });
});

function giveSetupItems(player: Player): void {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    container.clearAll();

    const setupItem = new ItemStack(GAME_SETUP_ITEM);
    setupItem.lockMode = ItemLockMode.slot;
    container.setItem(GAME_SETUP_ITEM_SLOT, setupItem);

    const startItem = new ItemStack(GAME_START_ITEM);
    startItem.lockMode = ItemLockMode.slot;
    container.setItem(GAME_START_ITEM_SLOT, startItem);
}
