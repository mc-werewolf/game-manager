import { EntityComponentTypes, ItemLockMode, ItemStack, type Player } from "@minecraft/server";
import type { GameManager } from "../GameManager";
import { ITEM_USE } from "../../../../constants/itemuse";
import { MinecraftItemTypes } from "@minecraft/vanilla-data";

export interface InGameItem {
    typeId: string;
    slot: number;
    amount: number;
    dataValues?: number;
    enchantments?: Record<string, number>;
    holdingEffects?: string[];
}

export class ItemManager {
    private readonly items: {
        typeId: string;
        slot: number;
        lockMode: ItemLockMode;
    }[] = [
        {
            typeId: "minecraft:bow",
            slot: 0,
            lockMode: ItemLockMode.slot,
        },
        //{
        //    typeId: "minecraft:arrow",
        //    slot: 9,
        //    lockMode: ItemLockMode.slot,
        //},
        {
            typeId: ITEM_USE.SKILL_TRIGGER_ITEM_ID,
            slot: 8,
            lockMode: ItemLockMode.slot,
        },
        //{
        //    typeId: ITEM_USE.GAME_FORCE_TERMINATOR_ITEM_ID,
        //    slot: 17,
        //    lockMode: "inventory",
        //},
    ];

    private constructor(private readonly gameManager: GameManager) {}
    public static create(gameManager: GameManager): ItemManager {
        return new ItemManager(gameManager);
    }

    public replaceItemToPlayers(players: Player[]): void {
        players.forEach((player) => {
            this.replaceItemToPlayer(player);
        });
    }

    private replaceItemToPlayer(player: Player): void {
        const playerData = this.gameManager.getPlayerData(player.id);
        if (!playerData) return;

        const inventory = player.getComponent(EntityComponentTypes.Inventory);
        if (!inventory) return;

        for (const item of this.items) {
            if (inventory.container.getItem(item.slot)?.typeId !== item.typeId) {
                const itemStack = new ItemStack(item.typeId);
                itemStack.lockMode = item.lockMode;

                inventory.container.setItem(item.slot, itemStack);
            }
        }

        if (playerData.tmpArrowCooldown > 0) {
            const arrow = inventory.container.getItem(9);
            if (arrow) {
                inventory.container.setItem(9, undefined);
            }
        } else {
            const arrow = inventory.container.getItem(9);
            if (arrow?.typeId !== MinecraftItemTypes.Arrow) {
                const itemStack = new ItemStack(MinecraftItemTypes.Arrow);
                itemStack.lockMode = ItemLockMode.slot;

                inventory.container.setItem(9, itemStack);
            }
        }
    }
}
