import { BaseEventManager } from "../../events/BaseEventManager";
import type { SystemManager } from "../../SystemManager";
import { EntityHurtHandler } from "./EntityHurt";

export class SystemEventManager extends BaseEventManager {
    private entityHurt: EntityHurtHandler;
    private constructor(private readonly systemManager: SystemManager) {
        super();
        this.entityHurt = EntityHurtHandler.create(this);
    }

    public static create(systemManager: SystemManager): SystemEventManager {
        return new SystemEventManager(systemManager);
    }

    public override subscribeAll(): void {
        this.entityHurt.subscribe();
    }

    public override unsubscribeAll(): void {
        this.entityHurt.unsubscribe();
    }

    public getSystemManager(): SystemManager {
        return this.systemManager;
    }
}
