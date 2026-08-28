import { world } from "@minecraft/server";
import type { SystemManager } from "../game/SystemManager";
export class HostManager {
    private constructor(private readonly systemManager: SystemManager) {}
    public static create(systemManager: SystemManager): HostManager {
        return new HostManager(systemManager);
    }
    public determineHost(): void {
        const players = world.getAllPlayers();
        if (!players[0]) return;
        const target = players[0];
        // この target に host であるしるしを付けたい
    }
}
