import { KairoUtils, type KairoResponse } from "@kairo-js/router";
import type { RoleDefinition } from "../../../../data/roles";
import type { InGameManager } from "../../InGameManager";
import type { PlayerData } from "./PlayerData";
import { PlayersDataManager } from "./PlayersDataManager";

export type WerewolfGameData = {
    remainingTicks: number;
    playersData: PlayerDataDTO[];
};

export type PlayerDataDTO = {
    player: {
        id: string;
        name: string;
    };
    role: RoleDefinition | null;
    isAlive: boolean;
    isLeave: boolean;
    isVictory: boolean;
};

export class WerewolfGameDataManager {
    private _remainingTicks: number = 0;
    private readonly playersDataManager: PlayersDataManager;
    private constructor(private readonly inGameManager: InGameManager) {
        this._remainingTicks = 12000; // 後から設定をいじれるような仕組みを作った時に、ここでそれを使って初期化するようにする
        this.playersDataManager = PlayersDataManager.create(this);
    }
    public static create(inGameManager: InGameManager): WerewolfGameDataManager {
        return new WerewolfGameDataManager(inGameManager);
    }

    public getWerewolfGameDataDTO(): KairoResponse {
        return KairoUtils.buildKairoResponse(this.buildWerewolfGameData());
    }

    public getInGameManager(): InGameManager {
        return this.inGameManager;
    }

    public getPlayersDataManager(): PlayersDataManager {
        return this.playersDataManager;
    }

    public getPlayerData(playerId: string): PlayerData {
        return this.playersDataManager.get(playerId);
    }

    public getPlayersData(): readonly PlayerData[] {
        return this.playersDataManager.getPlayersData();
    }

    public get remainingTicks(): number {
        return this._remainingTicks;
    }

    public updateRemainingTicks(): void {
        if (this._remainingTicks > 0) {
            this._remainingTicks--;
        }
    }

    private buildWerewolfGameData(): WerewolfGameData {
        const playersDataDTO: PlayerDataDTO[] = this.getPlayersData().map((playerData) => ({
            player: {
                id: playerData.player.id,
                name: playerData.player.name,
            },
            role: playerData.role,
            isAlive: playerData.isAlive,
            isLeave: playerData.isLeave,
            isVictory: playerData.isVictory,
        }));

        return {
            remainingTicks: this._remainingTicks,
            playersData: playersDataDTO,
        };
    }
}
