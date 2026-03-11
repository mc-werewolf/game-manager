import type { FactionDefinition } from "../../../../data/factions";
import { BaseDefinitionRegistry } from "../BaseDefinitionRegistry";
import type { DefinitionManager } from "../DefinitionManager";
import { FactionDefinitionValidator } from "./FactionDefinitionValidator";

export class FactionDefinitionRegistry extends BaseDefinitionRegistry<FactionDefinition> {
    private readonly _validator = FactionDefinitionValidator.create(this);

    private constructor(definitionManager: DefinitionManager) {
        super(definitionManager, "role");
    }

    public static create(definitionManager: DefinitionManager) {
        return new FactionDefinitionRegistry(definitionManager);
    }

    protected get validator() {
        return this._validator;
    }

    public getDefinitionManager(): DefinitionManager {
        return this.definitionManager;
    }
}
