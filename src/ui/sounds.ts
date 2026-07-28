import { getWorldPlayers } from "../game/playerIdentity";

export function playUiConfirmForAll(): void {
    for (const player of getWorldPlayers()) {
        player.playSound("random.orb", { volume: 0.7, pitch: 1 });
    }
}
