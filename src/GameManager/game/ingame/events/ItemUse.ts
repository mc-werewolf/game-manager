import { ItemUseAfterEvent, ItemUseBeforeEvent, system, world } from "@minecraft/server";
import { BaseEventHandler } from "../../events/BaseEventHandler";
import { ITEM_USE } from "../../../constants/itemuse";
import { SCRIPT_EVENT_COMMAND_IDS } from "../../../constants/scriptevent";
import type { InGameEventManager } from "./InGameEventManager";
import { KAIRO_COMMAND_TARGET_ADDON_IDS, SYSTEMS } from "../../../constants/systems";
import type { GameEventType } from "../../../data/roles";
import { WEREWOLF_GAMEMANAGER_TRANSLATE_IDS } from "../../../constants/translate";
import { KairoUtils } from "@kairo-js/router";
import { MinecraftItemTypes } from "@minecraft/vanilla-data";

export class InGameItemUseHandler extends BaseEventHandler<ItemUseBeforeEvent, ItemUseAfterEvent> {
    private constructor(private readonly inGameEventManager: InGameEventManager) {
        super(inGameEventManager);
    }

    public static create(inGameEventManager: InGameEventManager): InGameItemUseHandler {
        return new InGameItemUseHandler(inGameEventManager);
    }

    protected beforeEvent = world.beforeEvents.itemUse;
    protected afterEvent = world.afterEvents.itemUse;

    protected handleBefore(ev: ItemUseBeforeEvent): void {
        // 使用前処理
    }

    protected async handleAfter(ev: ItemUseAfterEvent): Promise<void> {
        // 使用後処理
        const { itemStack, source } = ev;

        switch (itemStack.typeId) {
            case ITEM_USE.GAME_FORCE_TERMINATOR_ITEM_ID:
                KairoUtils.sendKairoCommand(
                    KAIRO_COMMAND_TARGET_ADDON_IDS.WEREWOLF_GAMEMANAGER,
                    SCRIPT_EVENT_COMMAND_IDS.WEREWOLF_GAME_RESET,
                );
                break;
            case MinecraftItemTypes.Bow: {
                const player = source;
                const playerData = this.inGameEventManager
                    .getInGameManager()
                    .getPlayerData(player.id);
                if (!playerData || !playerData.isAlive) return;
                if (!playerData.role) return;
                if (!playerData.role.skills) return;

                if (playerData.tmpArrowCooldown > 0) {
                    player.playSound(SYSTEMS.ERROR.SOUND_ID, {
                        pitch: SYSTEMS.ERROR.SOUND_PITCH,
                        volume: SYSTEMS.ERROR.SOUND_VOLUME,
                        location: player.location,
                    });
                    player.sendMessage({
                        translate:
                            WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_TMP_ARROW_COOLDOWN_ERROR_MESSAGE,
                        with: [playerData.tmpArrowCooldown.toString()],
                    });
                }

                break;
            }
            case ITEM_USE.SKILL_TRIGGER_ITEM_ID: {
                const player = source;
                const playerData = this.inGameEventManager
                    .getInGameManager()
                    .getPlayerData(player.id);
                if (!playerData || !playerData.isAlive) return;
                if (!playerData.role) return;
                if (!playerData.role.skills) return;
                if (playerData.role.handleGameEvents?.["SkillUse"] === undefined) return;
                const skillId = playerData.role.handleGameEvents?.["SkillUse"].skillId;
                const skillState = playerData.skillStates.get(skillId);
                if (!skillState) return;
                if (skillState.remainingUses === 0) {
                    player.playSound(SYSTEMS.ERROR.SOUND_ID, {
                        pitch: SYSTEMS.ERROR.SOUND_PITCH,
                        volume: SYSTEMS.ERROR.SOUND_VOLUME,
                        location: player.location,
                    });
                    player.sendMessage({
                        translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.SKILL_NO_REMAINING_USES_ERROR,
                    });
                    return;
                }
                if (skillState.cooldownRemaining > 0) {
                    player.playSound(SYSTEMS.ERROR.SOUND_ID, {
                        pitch: SYSTEMS.ERROR.SOUND_PITCH,
                        volume: SYSTEMS.ERROR.SOUND_VOLUME,
                        location: player.location,
                    });
                    player.sendMessage({
                        translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.SKILL_ON_COOLDOWN_ERROR,
                        with: [skillState.cooldownRemaining.toString()],
                    });
                    return;
                }

                const kairoResponse = await KairoUtils.sendKairoCommandAndWaitResponse(
                    playerData.role?.providerAddonId ?? "",
                    SCRIPT_EVENT_COMMAND_IDS.WEREWOLF_INGAME_PLAYER_SKILL_TRIGGER,
                    {
                        playerId: player.id,
                        eventType: "SkillUse" satisfies GameEventType,
                    },
                    this.inGameEventManager.getInGameManager().getWerewolfGameDataManager()
                        .remainingTicks,
                );

                if (kairoResponse.data.success) {
                    skillState.remainingUses -= 1;
                    console.log(skillState.remainingUses);
                    skillState.cooldownRemaining =
                        (playerData.role.skills.find((skill) => skill.id === skillId)
                            ?.cooldown as number) ?? 0;
                    // とりあえず number と見なしているけど、後で設定できるようにしたら string を展開できるようにもする必要がある
                }

                break;
            }
        }
    }
}
