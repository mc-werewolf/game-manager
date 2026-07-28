import { system, world, type Player } from "@minecraft/server";
import { router } from "@kairo-js/router";
import { clearPlayerItems } from "./playerItems";
import { getWorldPlayers, type GameStartPlayer } from "./playerIdentity";
import { tr } from "../ui/text";
import { gameStartPresentationStepRegistry } from "../registry/gameStartPresentationStepRegistry";
import type { GameStartPresentationStage } from "../types/gameStartPresentationStep";

const TITLE_KEY = "werewolf-gamemanager.game.start.presentation.title";
const SUBTITLE_KEY = "werewolf-gamemanager.game.start.presentation.subtitle";
const STAGE_TITLE_KEY = "werewolf-gamemanager.stage.title";
const TITLE_RAWTEXT_COMMAND = `titleraw @a title {"rawtext":[{"translate":"${TITLE_KEY}"}]}`;
const SUBTITLE_RAWTEXT_COMMAND = `titleraw @a subtitle {"rawtext":[{"translate":"${SUBTITLE_KEY}"}]}`;
const STAGE_TITLE_RAWTEXT_COMMAND = `titleraw @a title {"rawtext":[{"translate":"${STAGE_TITLE_KEY}"}]}`;
const CAMERA_FADE_DELAY_TICKS = 60;
const CAMERA_FADE_IN_TICKS = 15;
const CAMERA_FADE_HOLD_TICKS = 60;
const CAMERA_FADE_OUT_TICKS = 15;
const STAGE_REVEAL_DELAY_TICKS = 5;
const START_SOUND = "mob.wolf.death";
const CAMERA_FADE_SOUND = "random.anvil_land";
const STAGE_TELEPORT_COMMAND = "tp @a 0 -59 24 facing 0 -59 0";

export function playGameStartPresentation(players: readonly GameStartPlayer[], afterPresentation: () => void): void {
    clearGameStartInventories(players);
    showGameStartTitle();
    playSoundForAll(START_SOUND);
    runPresentationStage("start", { playerCount: players.length });
    scheduleCameraFade(afterPresentation);
}

function clearGameStartInventories(players: readonly GameStartPlayer[]): void {
    const seenPlayers = new Set<Player>();
    for (const player of players) {
        if (!player.player || seenPlayers.has(player.player)) continue;
        seenPlayers.add(player.player);
        clearPlayerItems(player.player);
    }

    runOverworldCommand("clear @a");
}

function showGameStartTitle(): void {
    for (const player of getWorldPlayers()) {
        try {
            player.onScreenDisplay.setTitle(tr(TITLE_KEY), {
                subtitle: tr(SUBTITLE_KEY),
                fadeInDuration: 0,
                stayDuration: 100,
                fadeOutDuration: 20,
            });
        } catch (err) {
            console.warn("[game-manager] Failed to show game start title:", err);
        }
    }

    runOverworldCommand("title @a times 0 100 20");
    runOverworldCommand(SUBTITLE_RAWTEXT_COMMAND);
    runOverworldCommand(TITLE_RAWTEXT_COMMAND);
}

function playSoundForAll(soundId: string): void {
    for (const player of getWorldPlayers()) {
        try {
            player.playSound(soundId);
        } catch (err) {
            console.warn(`[game-manager] Failed to play sound "${soundId}":`, err);
        }
    }
}

function scheduleCameraFade(afterPresentation: () => void): void {
    system.runTimeout(() => {
        runPresentationStage("fadeStart");
        fadeGameStartCamera();
    }, CAMERA_FADE_DELAY_TICKS);

    system.runTimeout(() => {
        showStageTitle();
        playSoundForAll(CAMERA_FADE_SOUND);
        lockPlayerInputs();
        teleportPlayersToStageView();
        runPresentationStage("blackout");
    }, CAMERA_FADE_DELAY_TICKS + CAMERA_FADE_IN_TICKS + STAGE_REVEAL_DELAY_TICKS);

    system.runTimeout(() => {
        runPresentationStage("fadeOut");
    }, CAMERA_FADE_DELAY_TICKS + CAMERA_FADE_IN_TICKS + CAMERA_FADE_HOLD_TICKS);

    system.runTimeout(() => {
        unlockPlayerInputs();
        runPresentationStage("complete").finally(afterPresentation);
    }, CAMERA_FADE_DELAY_TICKS + CAMERA_FADE_IN_TICKS + CAMERA_FADE_HOLD_TICKS + CAMERA_FADE_OUT_TICKS);
}

function showStageTitle(): void {
    for (const player of getWorldPlayers()) {
        try {
            player.onScreenDisplay.setTitle(tr(STAGE_TITLE_KEY), {
                fadeInDuration: 0,
                stayDuration: CAMERA_FADE_HOLD_TICKS - STAGE_REVEAL_DELAY_TICKS,
                fadeOutDuration: CAMERA_FADE_OUT_TICKS,
            });
        } catch (err) {
            console.warn("[game-manager] Failed to show stage title:", err);
        }
    }
    runOverworldCommand(STAGE_TITLE_RAWTEXT_COMMAND);
}

function teleportPlayersToStageView(): void {
    runOverworldCommand(STAGE_TELEPORT_COMMAND);
}

function lockPlayerInputs(): void {
    runOverworldCommand("inputpermission set @a camera disabled");
    runOverworldCommand("inputpermission set @a movement disabled");
}

function unlockPlayerInputs(): void {
    runOverworldCommand("inputpermission set @a movement enabled");
    runOverworldCommand("inputpermission set @a camera enabled");
}

function fadeGameStartCamera(): void {
    runOverworldCommand("camera @a fade time 0.75 3 0.75 color 0 0 0");
}

function runOverworldCommand(command: string): void {
    try {
        world.getDimension("overworld").runCommand(command);
    } catch (err) {
        console.warn(`[game-manager] Failed to run command "${command}":`, err);
    }
}

async function runPresentationStage(stage: GameStartPresentationStage, payload: Record<string, unknown> = {}): Promise<void> {
    const eventPayload = {
        ...payload,
        stage,
        tick: router.currentTick,
    };
    router.emit("werewolf:gameStartPresentationStage", eventPayload);

    for (const step of gameStartPresentationStepRegistry.getByStage(stage)) {
        await router.request(step.addonId, step.apiName, eventPayload, { timeout: step.timeout ?? 20 }).catch((err) => {
            console.warn(`[game-manager] Game start presentation step "${step.id}" failed:`, err);
        });
    }
}
