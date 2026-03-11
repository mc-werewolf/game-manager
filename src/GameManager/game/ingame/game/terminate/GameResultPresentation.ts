import { EntityComponentTypes, world, type Player } from "@minecraft/server";
import type { GameTerminator } from "./GameTerminator";
import { GAMES, SYSTEMS } from "../../../../constants/systems";
import { WEREWOLF_GAMEMANAGER_TRANSLATE_IDS } from "../../../../constants/translate";
import type { ResolvedGameOutcome } from "../GameManager";

export class GameResultPresentation {
    private constructor(private readonly gameTerminator: GameTerminator) {}
    public static create(gameTerminator: GameTerminator): GameResultPresentation {
        return new GameResultPresentation(gameTerminator);
    }

    public async runGameResultPresentaionAsync(players: Player[]): Promise<void> {
        try {
            await this.runStep(async () => this.showGameTerminatedTitle(players));
            await this.runStep(async () => this.showGameResult(players));
        } catch (e) {
            console.warn(`[GameTerminator] Termination interrupted: ${String(e)}`);
        }
    }

    private async runStep(stepFn: () => Promise<void> | void): Promise<void> {
        if (this.gameTerminator.isCancelled) throw new Error("Initialization cancelled");
        await stepFn();
    }

    private async showGameTerminatedTitle(players: Player[]): Promise<void> {
        world.sendMessage({
            translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_TERMINATION_MESSAGE,
        });
        players.forEach((player) => {
            this.showGameTerminatedTitleForPlayer(player);
            player.getComponent(EntityComponentTypes.Inventory)?.container.clearAll();
            player.playSound(SYSTEMS.GAME_TERMINATION.SOUND_ID, {
                location: player.location,
                pitch: SYSTEMS.GAME_TERMINATION.SOUND_PITCH,
                volume: SYSTEMS.GAME_TERMINATION.SOUND_VOLUME,
            });
        });

        await this.gameTerminator
            .getWaitController()
            .waitTicks(SYSTEMS.GAME_TERMINATION_TITLE.STAY_DURATION);
    }

    private async showGameResult(players: Player[]): Promise<void> {
        const terminator = this.gameTerminator;
        const inGameManager = terminator.getInGameManager();
        const gameResult = terminator.getGameResult();
        if (!gameResult) return;

        players.forEach((player) => {
            const playerData = inGameManager.getPlayerData(player.id);

            this.playResultSound(player, playerData.isVictory);

            const { subtitleId, messageId } = this.getPlayerResultTextIds(
                gameResult,
                playerData.isVictory,
            );

            player.onScreenDisplay.setTitle(gameResult.presentation.title, {
                subtitle: { translate: subtitleId },
                ...GAMES.UI_RESULT_WINNING_FACTION_TITLE_ANIMATION,
            });

            const lineBreak = { text: "\n" };
            player.sendMessage({
                rawtext: [
                    { text: SYSTEMS.SEPARATOR.LINE_ORANGE },
                    lineBreak,
                    gameResult.presentation.message,
                    lineBreak,
                    { translate: messageId },
                    lineBreak,
                    { text: SYSTEMS.SEPARATOR.LINE_ORANGE },
                ],
            });
        });

        this.broadcastPlayersState(players);

        await terminator.getWaitController().waitTicks(SYSTEMS.GAME_SHOW_RESULT.DURATION);
    }

    private playResultSound(player: Player, isVictory: boolean): void {
        const sound = isVictory ? SYSTEMS.GAME_VICTORY.SOUND_ID : SYSTEMS.GAME_DEFEAT.SOUND_ID;
        const pitch = isVictory
            ? SYSTEMS.GAME_VICTORY.SOUND_PITCH
            : SYSTEMS.GAME_DEFEAT.SOUND_PITCH;
        const volume = isVictory
            ? SYSTEMS.GAME_VICTORY.SOUND_VOLUME
            : SYSTEMS.GAME_DEFEAT.SOUND_VOLUME;

        player.playSound(sound, { location: player.location, pitch, volume });
    }

    private getPlayerResultTextIds(
        result: ResolvedGameOutcome,
        isVictory: boolean,
    ): { subtitleId: string; messageId: string } {
        if (result.outcome.type === "draw") {
            return {
                subtitleId: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_RESULT_DRAW,
                messageId: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_RESULT_DRAW_MESSAGE,
            };
        }

        if (isVictory) {
            return {
                subtitleId: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_RESULT_VICTORY,
                messageId: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_RESULT_VICTORY_MESSAGE,
            };
        }

        return {
            subtitleId: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_RESULT_DEFEAT,
            messageId: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_RESULT_DEFEAT_MESSAGE,
        };
    }

    private broadcastPlayersState(players: Player[]): void {
        const lines: { rawtext: any[] }[] = [];
        const terminator = this.gameTerminator;
        const inGameManager = terminator.getInGameManager();

        players
            .sort((a, b) => {
                const aPlayerData = inGameManager.getPlayerData(a.id);
                const bPlayerData = inGameManager.getPlayerData(b.id);
                if (aPlayerData.role === null || bPlayerData.role === null) return 0;
                return inGameManager.compareRoleDefinitions(aPlayerData.role, bPlayerData.role);
            })
            .forEach((player) => {
                const playerData = inGameManager.getPlayerData(player.id);
                const translateId = playerData.isLeave
                    ? WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_RESULT_LEFT
                    : playerData.isAlive
                      ? WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_RESULT_ALIVE
                      : WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_RESULT_DEAD;

                lines.push({
                    rawtext: [
                        { text: playerData.name },
                        { text: SYSTEMS.SEPARATOR.COLON },
                        { text: playerData.role?.color || SYSTEMS.COLOR_CODE.RESET },
                        playerData.role?.name || { text: "Unknown Role" },
                        { text: SYSTEMS.COLOR_CODE.RESET },
                        { text: SYSTEMS.SEPARATOR.SPACE },
                        { translate: translateId },
                    ],
                });
            });

        world.sendMessage({
            rawtext: [
                ...lines.flatMap((line) => [...line.rawtext, { text: "\n" }]),
                /**
                 * プレイヤー名に日本語が含まれている場合にフォントがおかしくなってしまうため、
                 * broadcast では下部に仕切り線を出力しない
                 */
            ],
        });
    }

    private showGameTerminatedTitleForPlayer(player: Player): void {
        player.onScreenDisplay.setTitle(
            {
                translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_TERMINATION_TITLE,
            },
            {
                fadeInDuration: SYSTEMS.GAME_TERMINATION_TITLE.FADEIN_DURATION,
                stayDuration: SYSTEMS.GAME_TERMINATION_TITLE.STAY_DURATION,
                fadeOutDuration: SYSTEMS.GAME_TERMINATION_TITLE.FADEOUT_DURATION,
            },
        );
    }
}
