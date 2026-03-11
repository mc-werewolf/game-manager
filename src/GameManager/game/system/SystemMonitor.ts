import { world } from "@minecraft/server";
import type { SystemManager } from "../SystemManager";

export class SystemMonitor {
    private readonly scoreboardName = "SystemMonitor";
    private readonly SAMPLE_TICKS = 100;
    private tickCount = 0;
    private totalMspt = 0;
    private maxMspt = 0;

    private lastTickStart = Date.now();

    private avgMspt = 50;
    private tps = 20;

    private constructor(private readonly systemManager: SystemManager) {}
    public static create(systemManager: SystemManager): SystemMonitor {
        return new SystemMonitor(systemManager);
    }

    public monitor() {
        const now = Date.now();
        const mspt = now - this.lastTickStart;
        this.lastTickStart = now;

        this.tickCount++;
        this.totalMspt += mspt;
        if (mspt > this.maxMspt) this.maxMspt = mspt;

        if (this.tickCount >= this.SAMPLE_TICKS) {
            this.avgMspt = this.totalMspt / this.tickCount;
            this.tps = Math.min(20, 1000 / this.avgMspt);

            this.tickCount = 0;
            this.totalMspt = 0;
            this.maxMspt = 0;
        }

        const players = world.getPlayers();
        const worldState = this.systemManager.getWorldState();
        const gamePhase = this.systemManager.getInGameManager()?.getCurrentPhase();

        this.setScoreboard(1, `TPS: ${this.getTPSLevel(this.tps)}${Number(this.tps.toFixed(1))}§r`);
        this.setScoreboard(
            2,
            `MSPT: ${this.getAvgMsptLevel()}${Number(this.avgMspt.toFixed(1))}§r`,
        );
        this.setScoreboard(
            3,
            `MAX MSPT: ${this.getMaxMsptLevel()}${Number(this.maxMspt.toFixed(1))}§r`,
        );
        this.setScoreboard(
            4,
            worldState === null ? `WorldState: §9null§r` : `WorldState: §b${worldState}§r`,
        );
        this.setScoreboard(
            5,
            gamePhase === undefined ? `Game: §9null§r` : `Game: §b${gamePhase}§r`,
        );
        this.setScoreboard(6, `PlayerCount: §b${players.length}§r`);
    }

    private setScoreboard(score: number, message: string) {
        const objectives =
            world.scoreboard.getObjective(this.scoreboardName) ??
            world.scoreboard.addObjective(this.scoreboardName, `[${this.scoreboardName}]`);
        objectives.getScores().forEach((scoreInfo) => {
            if (scoreInfo.score === score && scoreInfo.participant.displayName !== message) {
                objectives.removeParticipant(scoreInfo.participant);
            }
        });
        objectives.setScore(message, score);
    }

    private getTPSLevel(tps: number): string {
        if (tps >= 19.5) return "§a";
        if (tps >= 15.0) return "§g";
        if (tps >= 10.0) return "§c";
        return "§4";
    }
    private getAvgMsptLevel(): string {
        if (this.avgMspt <= 50) return "§a";
        if (this.avgMspt <= 75) return "§g";
        if (this.avgMspt <= 100) return "§c";
        return "§4";
    }
    private getMaxMsptLevel(): string {
        if (this.maxMspt <= 60) return "§a";
        if (this.maxMspt <= 90) return "§g";
        if (this.maxMspt <= 120) return "§c";
        return "§4";
    }
}
