import type { SettingDefinition } from "../../../../data/settings";
import { BaseDefinitionValidator } from "../BaseDefinitionValidator";
import type { SettingDefinitionRegistry } from "./SettingDefinitionRegistry";

export class SettingDefinitionValidator extends BaseDefinitionValidator<
    SettingDefinition,
    SettingDefinitionRegistry
> {
    private constructor(registry: SettingDefinitionRegistry) {
        super(registry);
    }
    public static create(SettingDefinitionRegistry: SettingDefinitionRegistry) {
        return new SettingDefinitionValidator(SettingDefinitionRegistry);
    }

    public isDefinition(data: unknown): data is SettingDefinition {
        if (!this.isObject(data)) return false;

        if (typeof data.id !== "string") return false;
        return true;
    }
}
