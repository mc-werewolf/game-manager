import {
    EntityComponentTypes,
    EquipmentSlot,
    GameMode,
    HudElement,
    HudVisibility,
    ItemLockMode,
    ItemStack,
    type Player,
} from "@minecraft/server";
import type { OutGameManager } from "./OutGameManager";
import { ITEM_USE } from "../../constants/itemuse";
import { SYSTEMS } from "../../constants/systems";

export class PlayerInitializer {
    private readonly items: {
        typeId: string;
        slot: number;
        lockMode: ItemLockMode;
    }[] = [
        {
            typeId: ITEM_USE.PERSONAL_SETTINGS_ITEM_ID,
            slot: SYSTEMS.OUT_GAME_ITEM_SLOT_INDEX.PERSONAL_SETTINGS,
            lockMode: ItemLockMode.slot,
        },
        {
            typeId: ITEM_USE.GAME_SPECTATE_ITEM_ID,
            slot: SYSTEMS.OUT_GAME_ITEM_SLOT_INDEX.GAME_SPECTATE,
            lockMode: ItemLockMode.inventory,
        },
    ];

    private readonly hostItems: {
        typeId: string;
        slot: number;
        lockMode: ItemLockMode;
    }[] = [
        {
            typeId: ITEM_USE.GAME_STARTER_ITEM_ID,
            slot: SYSTEMS.OUT_GAME_ITEM_SLOT_INDEX.GAME_STARTER,
            lockMode: ItemLockMode.slot,
        },
        {
            typeId: ITEM_USE.GAME_SETTINGS_ITEM_ID,
            slot: SYSTEMS.OUT_GAME_ITEM_SLOT_INDEX.GAME_SETTINGS,
            lockMode: ItemLockMode.slot,
        },
    ];
    private constructor(private readonly outGameManager: OutGameManager) {}
    public static create(outGameManager: OutGameManager) {
        return new PlayerInitializer(outGameManager);
    }

    public initializePlayer(player: Player, isHost: boolean): void {
        // ゲームモード
        player.setGameMode(GameMode.Adventure);
        player.nameTag = player.name;

        // Hud
        player.onScreenDisplay.setHudVisibility(HudVisibility.Hide, [
            HudElement.PaperDoll,
            HudElement.Armor,
            HudElement.ToolTips,
            HudElement.ProgressBar,
            HudElement.Hunger,
            HudElement.AirBubbles,
            HudElement.HorseHealth,
            HudElement.StatusEffects,
        ]);

        player.onScreenDisplay.setHudVisibility(HudVisibility.Reset, [
            HudElement.Crosshair,
            HudElement.Health,
            HudElement.Hotbar,
            HudElement.ItemText,
            HudElement.TouchControls,
        ]);

        // インベントリ関連
        const inventory = player.getComponent(EntityComponentTypes.Inventory);
        if (!inventory) return;

        const equipment = player.getComponent(EntityComponentTypes.Equippable);
        if (!equipment) return;

        inventory.container.clearAll();
        equipment.setEquipment(EquipmentSlot.Chest);
        equipment.setEquipment(EquipmentSlot.Feet);
        equipment.setEquipment(EquipmentSlot.Head);
        equipment.setEquipment(EquipmentSlot.Legs);
        equipment.setEquipment(EquipmentSlot.Offhand);

        for (const item of this.items) {
            if (inventory.container.getItem(item.slot)?.typeId !== item.typeId) {
                const itemStack = new ItemStack(item.typeId);
                itemStack.lockMode = item.lockMode;

                inventory.container.setItem(item.slot, itemStack);
            }
        }

        if (isHost) {
            for (const item of this.hostItems) {
                if (inventory.container.getItem(item.slot)?.typeId !== item.typeId) {
                    const itemStack = new ItemStack(item.typeId);
                    itemStack.lockMode = item.lockMode;

                    inventory.container.setItem(item.slot, itemStack);
                }
            }
        }
    }
}
