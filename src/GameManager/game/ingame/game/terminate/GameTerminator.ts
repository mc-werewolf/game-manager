import { world } from "@minecraft/server";
import { type InGameManager } from "../../InGameManager";
import { CancelableWait } from "../../utils/CancelableWait";
import { GameResultPresentation } from "./GameResultPresentation";
import type { ResolvedGameOutcome } from "../GameManager";
import { GamePhase } from "../../GamePhase";

export class GameTerminator {
    private readonly gameResultPresentation: GameResultPresentation;
    private readonly waitController = new CancelableWait();
    private _isCancelled = false;

    private constructor(private readonly inGameManager: InGameManager) {
        this.gameResultPresentation = GameResultPresentation.create(this);
    }
    public static create(inGameManager: InGameManager): GameTerminator {
        return new GameTerminator(inGameManager);
    }

    public cancel(): void {
        this._isCancelled = true;
        this.waitController.cancel();
    }

    public async runTerminationAsync(): Promise<void> {
        this.inGameManager.setCurrentPhase(GamePhase.Result);
        this.waitController.reset();
        const players = world.getPlayers();

        await this.gameResultPresentation.runGameResultPresentaionAsync(players);
    }

    public getWaitController(): CancelableWait {
        return this.waitController;
    }

    public get isCancelled(): boolean {
        return this._isCancelled;
    }

    public getInGameManager(): InGameManager {
        return this.inGameManager;
    }

    public getGameResult(): ResolvedGameOutcome | null {
        return this.inGameManager.getGameManager().gameResult;
    }
}
