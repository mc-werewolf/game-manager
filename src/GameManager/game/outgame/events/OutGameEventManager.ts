import { BaseEventManager } from "../../events/BaseEventManager";
import type { OutGameManager } from "../OutGameManager";
import { OutGameItemUseHandler } from "./ItemUse";
import { OutGamePlayerSpawnHandler } from "./PlayerSpawn";

export class OutGameEventManager extends BaseEventManager {
    private readonly itemUse: OutGameItemUseHandler;
    private readonly playerSpawn: OutGamePlayerSpawnHandler;

    private constructor(private readonly outGameManager: OutGameManager) {
        super();
        this.itemUse = OutGameItemUseHandler.create(this);
        this.playerSpawn = OutGamePlayerSpawnHandler.create(this);
    }
    public static create(outGameManager: OutGameManager): OutGameEventManager {
        return new OutGameEventManager(outGameManager);
    }

    public override subscribeAll(): void {
        this.itemUse.subscribe();
        this.playerSpawn.subscribe();
    }

    public override unsubscribeAll(): void {
        this.itemUse.unsubscribe();
        this.playerSpawn.unsubscribe();
    }

    public getOutGameManager(): OutGameManager {
        return this.outGameManager;
    }
}
