import { world } from "@minecraft/server";

export function playUiConfirmForAll(): void {
    for (const player of world.getPlayers()) {
        player.playSound("random.orb", { volume: 0.7, pitch: 1 });
    }
}
