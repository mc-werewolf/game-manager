import type { Player } from "@minecraft/server";
import type { GameState } from "../types/gameState";
import { getGamePlayerId, getWorldPlayers } from "./playerIdentity";

const COUNTDOWN_EFFECT_DURATION_TICKS = 20 * 60 * 10;
const COUNTDOWN_EFFECTS = [
    { id: "minecraft:invisibility", amplifier: 0 },
    { id: "minecraft:speed", amplifier: 2 },
] as const;

export function applyCountdownEffects(state: GameState): void {
    for (const player of getCountdownEffectPlayers(state)) {
        for (const effect of COUNTDOWN_EFFECTS) {
            try {
                player.addEffect(effect.id, COUNTDOWN_EFFECT_DURATION_TICKS, {
                    amplifier: effect.amplifier,
                    showParticles: false,
                });
            } catch (err) {
                console.warn(`[game-manager] Failed to apply countdown effect "${effect.id}":`, err);
            }
        }
    }
}

export function removeCountdownEffects(state?: GameState): void {
    for (const player of getCountdownEffectPlayers(state)) {
        for (const effect of COUNTDOWN_EFFECTS) {
            try {
                player.removeEffect(effect.id);
            } catch (err) {
                console.warn(`[game-manager] Failed to remove countdown effect "${effect.id}":`, err);
            }
        }
    }
}

function getCountdownEffectPlayers(state: GameState | undefined): Player[] {
    if (state === undefined) return getWorldPlayers();
    return getWorldPlayers().filter((player) => state.players[getGamePlayerId(player)] !== undefined);
}
