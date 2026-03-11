import type { RoleGroupDefinition } from "../../../../data/rolegroup";
import { BaseDefinitionRegistry } from "../BaseDefinitionRegistry";
import type { DefinitionManager } from "../DefinitionManager";
import { RoleGroupDefinitionValidator } from "./RoleGroupDefinitionValidator";

export class RoleGroupDefinitionRegistry extends BaseDefinitionRegistry<RoleGroupDefinition> {
    private readonly _validator = RoleGroupDefinitionValidator.create(this);

    private constructor(definitionManager: DefinitionManager) {
        super(definitionManager, "roleGroup");
    }

    public static create(definitionManager: DefinitionManager) {
        return new RoleGroupDefinitionRegistry(definitionManager);
    }

    protected get validator() {
        return this._validator;
    }

    public getDefinitionManager(): DefinitionManager {
        return this.definitionManager;
    }
}
