import { ItemLockMode, ItemStack, world } from "@minecraft/server";
import { router } from "@kairo-js/router";
import { properties } from "./properties";
import { GAME_START_ITEM, GAME_START_ITEM_SLOT } from "./constants/items";
import { WEREWOLF_GAMERULES } from "./constants/gamerules";

router.init(properties);

router.beforeEvents.startup.subscribe((_ev) => {
    // API・イベント・コマンドの登録はここに追加していく
});

router.afterEvents.addonActivate.subscribe((_ev) => {
    Object.assign(world.gameRules, WEREWOLF_GAMERULES);

    for (const player of world.getPlayers()) {
        const container = player.getComponent("minecraft:inventory")?.container;
        if (!container) continue;

        container.clearAll();

        const item = new ItemStack(GAME_START_ITEM);
        item.lockMode = ItemLockMode.slot;
        container.setItem(GAME_START_ITEM_SLOT, item);
    }

    router.afterEvents.itemUse.subscribe((ev) => {
        if (ev.itemStack.typeId !== GAME_START_ITEM) return;
        // TODO: ゲーム開始処理
    });
});
