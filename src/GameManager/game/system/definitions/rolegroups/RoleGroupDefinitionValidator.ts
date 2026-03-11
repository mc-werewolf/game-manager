import type { RoleGroupDefinition } from "../../../../data/rolegroup";
import { BaseDefinitionValidator } from "../BaseDefinitionValidator";
import type { RoleGroupDefinitionRegistry } from "./RoleGroupDefinitionRegistry";

export class RoleGroupDefinitionValidator extends BaseDefinitionValidator<
    RoleGroupDefinition,
    RoleGroupDefinitionRegistry
> {
    private constructor(registry: RoleGroupDefinitionRegistry) {
        super(registry);
    }
    public static create(RoleGroupDefinitionRegistry: RoleGroupDefinitionRegistry) {
        return new RoleGroupDefinitionValidator(RoleGroupDefinitionRegistry);
    }

    public isDefinition(data: unknown): data is RoleGroupDefinition {
        if (!this.isObject(data)) return false;

        if (typeof data.id !== "string") return false;
        return true;
    }
}
