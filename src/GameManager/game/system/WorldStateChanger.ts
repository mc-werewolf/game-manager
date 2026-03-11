import type { IngameConstants } from "../ingame/InGameManager";
import { GameWorldState, type SystemManager } from "../SystemManager";

export class WorldStateChanger {
    private isInitialized: boolean = false;
    private constructor(private readonly systemManager: SystemManager) {}
    public static create(systemManager: SystemManager): WorldStateChanger {
        return new WorldStateChanger(systemManager);
    }

    public change(next: GameWorldState): void {
        const current = this.systemManager.getWorldState();
        if (current === next) return;

        let ingameConstants: IngameConstants | null = null;

        switch (next) {
            case GameWorldState.InGame: {
                ingameConstants = {
                    roleComposition: this.systemManager.getAllRoleCounts(),
                    roleDefinitions: this.mapToObject(this.systemManager.getDefinitionsMap("role")),
                    factionDefinitions: this.mapToObject(
                        this.systemManager.getDefinitionsMap("faction"),
                    ),
                    roleGroupDefinitions: this.mapToObject(
                        this.systemManager.getDefinitionsMap("roleGroup"),
                    ),
                    settingDefinitions: this.mapToObject(
                        this.systemManager.getDefinitionsMap("setting"),
                    ),
                };
                this.toInGame();
                break;
            }

            case GameWorldState.OutGame:
                this.toOutGame();
                break;
        }

        if (!this.isInitialized) this.isInitialized = true;
        else this.systemManager.broadcastWorldStateChange(next, ingameConstants);
    }

    private toInGame(): void {
        this.systemManager.getOutGameManager()?.getOutGameEventManager().unsubscribeAll();
        this.systemManager.setOutGameManager(null);

        const InGameManager = this.systemManager.createInGameManager();
        InGameManager.getInGameEventManager().subscribeAll();
        this.systemManager.setInGameManager(InGameManager);

        this.systemManager.setWorldState(GameWorldState.InGame);
    }

    private toOutGame(): void {
        this.systemManager.getInGameManager()?.getInGameEventManager().unsubscribeAll();
        this.systemManager.setInGameManager(null);

        const OutGameManager = this.systemManager.createOutGameManager();
        OutGameManager.getOutGameEventManager().subscribeAll();
        this.systemManager.setOutGameManager(OutGameManager);

        this.systemManager.setWorldState(GameWorldState.OutGame);
    }

    private mapToObject<V>(map: Map<string, V>): Record<string, V> {
        return Object.fromEntries(map);
    }
}
