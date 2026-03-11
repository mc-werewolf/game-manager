import { Player, world } from "@minecraft/server";
import { InitPresentation } from "./InitPresentation";
import { type InGameManager } from "../../InGameManager";
import { CancelableWait } from "../../utils/CancelableWait";
import { RoleAssignmentManager } from "./RoleAssignmentManager";
import { GamePhase } from "../../GamePhase";

export class GameInitializer {
    private readonly initPresentation: InitPresentation;
    private readonly roleAssignmentManager: RoleAssignmentManager;
    private readonly waitController = new CancelableWait();
    private _isCancelled = false;

    private constructor(private readonly inGameManager: InGameManager) {
        this.initPresentation = InitPresentation.create(this);
        this.roleAssignmentManager = RoleAssignmentManager.create(this);
    }

    public static create(inGameManager: InGameManager): GameInitializer {
        return new GameInitializer(inGameManager);
    }

    public cancel(): void {
        this._isCancelled = true;
        this.waitController.cancel();
    }

    public async runInitializationAsync(): Promise<void> {
        this.inGameManager.setCurrentPhase(GamePhase.Initializing);
        this.waitController.reset();
        const players = world.getPlayers();

        await this.initPresentation.runInitPresentationAsync(players);

        this.setPlayersData(players);
        this.roleAssignmentManager.assign(players);
    }

    public getInGameManager(): InGameManager {
        return this.inGameManager;
    }

    public getWaitController(): CancelableWait {
        return this.waitController;
    }

    public get isCancelled(): boolean {
        return this._isCancelled;
    }

    private setPlayersData(players: Player[]): void {
        players.forEach((player) => {
            this.inGameManager.getPlayersDataManager().init(player, "participant");
        });
    }
}
