import {
    HudElement,
    HudVisibility,
    InputPermissionCategory,
    Player,
    world,
} from "@minecraft/server";
import { CountdownManager } from "../utils/CountdownManager";
import { type InGameManager } from "../InGameManager";
import { DEFAULT_SETTINGS } from "../../../constants/settings";
import { WEREWOLF_GAMEMANAGER_TRANSLATE_IDS } from "../../../constants/translate";
import { SYSTEMS } from "../../../constants/systems";
import { MinecraftEffectTypes } from "@minecraft/vanilla-data";
import { GamePhase } from "../GamePhase";

export class GamePreparationManager {
    private readonly countdownManager: CountdownManager;
    private constructor(private readonly inGameManager: InGameManager) {
        this.countdownManager = CountdownManager.create(
            DEFAULT_SETTINGS.GAME_PREPARATION_TIME,
            DEFAULT_SETTINGS.VERBOSE_COUNTDOWN,
        );
    }
    public static create(inGameManager: InGameManager): GamePreparationManager {
        return new GamePreparationManager(inGameManager);
    }

    public async runPreparationAsync(): Promise<void> {
        this.inGameManager.setCurrentPhase(GamePhase.Preparing);
        const players = world.getPlayers();

        players.forEach((player) => {
            player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, true);
            player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
            player.onScreenDisplay.setHudVisibility(HudVisibility.Reset, [
                HudElement.Crosshair,
                HudElement.Hotbar,
                HudElement.Health,
            ]);

            player.addEffect(
                MinecraftEffectTypes.Invisibility,
                DEFAULT_SETTINGS.GAME_PREPARATION_TIME * SYSTEMS.INTERVAL.EVERY_SECOND,
                {
                    amplifier: 255,
                    showParticles: false,
                },
            );

            player.addEffect(
                MinecraftEffectTypes.Speed,
                DEFAULT_SETTINGS.GAME_PREPARATION_TIME * SYSTEMS.INTERVAL.EVERY_SECOND,
                {
                    amplifier: 2,
                    showParticles: false,
                },
            );

            this.showRoleToPlayer(player, DEFAULT_SETTINGS.GAME_PREPARATION_TIME);
        });

        try {
            await this.countdownManager.startAsync({
                onNormalTick: (seconds) => {
                    world.sendMessage({
                        translate:
                            WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_PREPARATION_COUNTDOWN_MESSAGE,
                        with: [seconds.toString()],
                    });
                    players.forEach((player) => {
                        player.playSound(SYSTEMS.GAME_PREPARATION_COUNTDOWN.SOUND_ID, {
                            location: player.location,
                            pitch: SYSTEMS.GAME_PREPARATION_COUNTDOWN.SOUND_PITCH,
                            volume: SYSTEMS.GAME_PREPARATION_COUNTDOWN.SOUND_VOLUME,
                        });
                    });
                },
                onWarningTick: (seconds) => {
                    world.sendMessage({
                        translate:
                            WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_PREPARATION_COUNTDOWN_WARNING_MESSAGE,
                        with: [seconds.toString()],
                    });
                    players.forEach((player) => {
                        player.playSound(SYSTEMS.GAME_PREPARATION_COUNTDOWN.WARNING_SOUND_ID, {
                            location: player.location,
                            pitch: SYSTEMS.GAME_PREPARATION_COUNTDOWN.WARNING_SOUND_PITCH,
                            volume: SYSTEMS.GAME_PREPARATION_COUNTDOWN.WARNING_SOUND_VOLUME,
                        });
                    });
                },
                onComplete: () => {
                    world.sendMessage({
                        translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_START_MESSAGE,
                    });
                    players.forEach((player) => {
                        player.playSound(SYSTEMS.GAME_START.SOUND_ID, {
                            location: player.location,
                            pitch: SYSTEMS.GAME_START.SOUND_PITCH,
                            volume: SYSTEMS.GAME_START.SOUND_VOLUME,
                        });
                    });
                },
            });
        } catch (err) {
            console.warn("[GamePreparationManager] Countdown stopped:", err);
            return;
        }

        players.forEach((player) => {
            player.onScreenDisplay.setHudVisibility(HudVisibility.Reset, [
                HudElement.Hotbar,
                HudElement.ItemText,
            ]);
        });
    }

    public stopPreparation(): void {
        this.countdownManager.stop();
    }

    private showRoleToPlayer(player: Player, seconds: number): void {
        const playerData = this.inGameManager.getPlayerData(player.id);
        if (!playerData) return;
        if (!playerData.role) return;

        player.onScreenDisplay.setTitle(
            {
                translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_SHOW_YOUR_ROLE_TITLE,
                with: {
                    rawtext: [
                        { text: playerData.role.color ?? SYSTEMS.COLOR_CODE.RESET },
                        playerData.role.name,
                        { text: SYSTEMS.COLOR_CODE.RESET },
                    ],
                },
            },
            {
                subtitle: {
                    translate:
                        WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_PREPARATION_COUNTDOWN,
                    with: [seconds.toString()],
                },
                fadeInDuration: SYSTEMS.YOUR_ROLE_TITLE.FADEIN_DURATION,
                stayDuration: SYSTEMS.SHOW_GAME_TITLE.STAY_DURATION,
                fadeOutDuration: SYSTEMS.SHOW_GAME_TITLE.FADEOUT_DURATION,
            },
        );

        player.sendMessage({
            rawtext: [
                {
                    text: SYSTEMS.SEPARATOR.LINE_ORANGE + "\n",
                },
                {
                    translate:
                        WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_GAME_SHOW_YOUR_ROLE_MESSAGE,
                    with: {
                        rawtext: [
                            { text: playerData.role.color ?? SYSTEMS.COLOR_CODE.RESET },
                            playerData.role.name,
                            { text: SYSTEMS.COLOR_CODE.RESET },
                        ],
                    },
                },
                {
                    text: "\n" + (playerData.role.color ?? SYSTEMS.COLOR_CODE.RESET),
                },
                playerData.role.description,
                { text: SYSTEMS.COLOR_CODE.RESET },
                {
                    text: "\n" + SYSTEMS.SEPARATOR.LINE_ORANGE,
                },
            ],
        });
    }
}
