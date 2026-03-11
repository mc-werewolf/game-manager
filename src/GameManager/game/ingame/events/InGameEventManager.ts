import { BaseEventManager } from "../../events/BaseEventManager";
import type { InGameManager } from "../InGameManager";
import { InGameEntityHurtHandler } from "./EntityHurt";
import { InGameItemUseHandler } from "./ItemUse";
import { InGamePlayerLeaveHandler } from "./PlayerLeave";
import { InGameProjectileHitBlockHandler } from "./ProjectileHitBlock";
import { InGameProjectileHitEntityHandler } from "./ProjectileHitEntity";

export class InGameEventManager extends BaseEventManager {
    private entityHurt: InGameEntityHurtHandler;
    private itemUse: InGameItemUseHandler;
    private playerLeave: InGamePlayerLeaveHandler;
    private projectileHitBlock: InGameProjectileHitBlockHandler;
    private projectileHitEntity: InGameProjectileHitEntityHandler;
    private constructor(private readonly inGameManager: InGameManager) {
        super();
        this.entityHurt = InGameEntityHurtHandler.create(this);
        this.itemUse = InGameItemUseHandler.create(this);
        this.playerLeave = InGamePlayerLeaveHandler.create(this);
        this.projectileHitBlock = InGameProjectileHitBlockHandler.create(this);
        this.projectileHitEntity = InGameProjectileHitEntityHandler.create(this);
    }

    public static create(inGameManager: InGameManager): InGameEventManager {
        return new InGameEventManager(inGameManager);
    }

    public override subscribeAll(): void {
        this.entityHurt.subscribe();
        this.itemUse.subscribe();
        this.playerLeave.subscribe();
        this.projectileHitBlock.subscribe();
        this.projectileHitEntity.subscribe();
    }

    public override unsubscribeAll(): void {
        this.entityHurt.unsubscribe();
        this.itemUse.unsubscribe();
        this.playerLeave.unsubscribe();
        this.projectileHitBlock.unsubscribe();
        this.projectileHitEntity.unsubscribe();
    }

    public getInGameManager(): InGameManager {
        return this.inGameManager;
    }
}
