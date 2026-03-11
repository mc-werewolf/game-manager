import { type Player, type RawMessage } from "@minecraft/server";
import type { GameManager } from "../GameManager";
import { WEREWOLF_GAMEMANAGER_TRANSLATE_IDS } from "../../../../constants/translate";
import { SYSTEMS } from "../../../../constants/systems";
import type { PlayerData } from "./PlayerData";

export class ActionBarManager {
    private constructor(private readonly gameManager: GameManager) {}
    public static create(gameManager: GameManager): ActionBarManager {
        return new ActionBarManager(gameManager);
    }

    public showActionBarToPlayers(players: Player[]) {
        players.forEach((player) => {
            this.showActionBarToPlayer(player);
        });
    }

    private showActionBarToPlayer(player: Player) {
        const actionBarRawMessage: RawMessage = { rawtext: [] };
        if (!actionBarRawMessage.rawtext) return;

        const playerData = this.gameManager.getPlayerData(player.id);
        const playersData = this.gameManager.getPlayersData();
        if (!playerData) return;
        if (!playerData.role) return;

        // 改行用変数
        const lineBreak = { text: "\n" };

        // 役職表示
        const roleName: RawMessage = {
            translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_ACTIONBAR_ROLE_NAME,
            with: {
                rawtext: [
                    { text: playerData.role.color ?? SYSTEMS.COLOR_CODE.RESET },
                    playerData.role.name,
                    { text: SYSTEMS.COLOR_CODE.RESET },
                ],
            },
        };
        actionBarRawMessage.rawtext.push(roleName, lineBreak);

        // スキルクールタイム表示
        const skillCTs: RawMessage[] = [];
        playerData.skillStates.forEach((skillState, skillId) => {
            if (skillState.remainingUses <= 0) return;

            const cooldown =
                skillState.cooldownRemaining > 0
                    ? { text: `${skillState.cooldownRemaining}s` }
                    : {
                          translate:
                              WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_ACTIONBAR_SKILL_READY,
                      };

            skillCTs.push(skillState.name, { text: ": " }, cooldown, lineBreak);
        });

        actionBarRawMessage.rawtext.push(...skillCTs);

        // revealTo 表示
        const revealedPlayers: RawMessage[] = [];
        const revealedPlayerNames: string[] = [];

        playersData.forEach((other) => {
            if (other.player.id === player.id) return;
            if (!other.role) return;

            if (!this.canSeeRole(playerData, other)) return;

            if (revealedPlayers.length === 0) {
                if (other.role.roleGroup)
                    revealedPlayers.push(
                        { text: other.role.roleGroup.color },
                        other.role.roleGroup.name,
                        { text: "§7: " + other.role.roleGroup.color },
                    );
            }

            revealedPlayerNames.push(other.player.name);
        });

        if (revealedPlayers.length > 0) {
            revealedPlayers.push({ text: revealedPlayerNames.join(" ,") });
            actionBarRawMessage.rawtext.push(...revealedPlayers, { text: "\n" });
        }

        // 襲撃CT表示
        if (playerData.tmpArrowCooldown > 0) {
            actionBarRawMessage.rawtext.push(lineBreak, {
                translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_TMP_ARROW_COOLDOWN,
                with: [playerData.tmpArrowCooldown.toString()],
            });
        }

        // 制限時間表示
        actionBarRawMessage.rawtext.push(lineBreak);
        const remainingTicks = this.gameManager.getRemainingTicks();
        const remainingTimeSeconds = Math.ceil(remainingTicks / 20);
        const remainingTimeMessage: RawMessage = {
            translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_ACTIONBAR_REMAINING_TIME,
            with: [remainingTimeSeconds.toString()],
        };
        actionBarRawMessage.rawtext.push(remainingTimeMessage, lineBreak);

        player.onScreenDisplay.setActionBar(actionBarRawMessage);
    }

    private canSeeRole(viewer: PlayerData, target: PlayerData): boolean {
        if (viewer.role === null || target.role === null) return false;
        const reveal = target.role?.revealTo;
        if (!reveal) return false;

        if (reveal.roles?.includes(viewer.role.id)) return true;
        if (reveal.factions?.includes(viewer.role.factionId)) return true;

        if (
            reveal.roleGroups &&
            viewer.role.roleGroup &&
            reveal.roleGroups.includes(viewer.role.roleGroup.id)
        ) {
            return true;
        }

        return false;
    }
}
