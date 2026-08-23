import type { Player, PlayerSoundOptions, SoundInstance, WorldSoundOptions } from "@minecraft/server";
import { getWorldPlayers } from "../game/playerIdentity";

export function playPlayerSound(
    player: Player,
    soundId: string,
    soundOptions?: PlayerSoundOptions,
    context = "sound",
): SoundInstance | undefined {
    try {
        return player.playSound(soundId, soundOptions);
    } catch (err) {
        console.warn(`[game-manager] Failed to play ${context} "${soundId}" for "${player.name}":`, err);
        return undefined;
    }
}

export function playSoundForAll(soundId: string, soundOptions?: PlayerSoundOptions, context = "sound"): SoundInstance[] {
    const sounds: SoundInstance[] = [];
    for (const player of getWorldPlayers()) {
        const sound = playPlayerSound(player, soundId, soundOptions, context);
        if (sound) sounds.push(sound);
    }
    return sounds;
}

export function playSoundAtPlayerLocation(
    player: Player,
    soundId: string,
    soundOptions?: WorldSoundOptions,
    context = "positional sound",
): SoundInstance | undefined {
    try {
        return player.dimension.playSound(soundId, player.location, soundOptions);
    } catch (err) {
        console.warn(`[game-manager] Failed to play ${context} "${soundId}" at "${player.name}":`, err);
        return undefined;
    }
}

export function playUiConfirmForAll(): void {
    playSoundForAll("random.orb", { volume: 0.7, pitch: 1 }, "UI confirm sound");
}
