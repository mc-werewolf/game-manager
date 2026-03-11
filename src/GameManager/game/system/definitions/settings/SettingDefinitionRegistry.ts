import type { SettingDefinition } from "../../../../data/settings";
import { BaseDefinitionRegistry } from "../BaseDefinitionRegistry";
import type { DefinitionManager } from "../DefinitionManager";
import { SettingDefinitionValidator } from "./SettingDefinitionValidator";

export class SettingDefinitionRegistry extends BaseDefinitionRegistry<SettingDefinition> {
    private readonly _validator = SettingDefinitionValidator.create(this);

    private constructor(definitionManager: DefinitionManager) {
        super(definitionManager, "setting");
    }

    public static create(definitionManager: DefinitionManager) {
        return new SettingDefinitionRegistry(definitionManager);
    }

    protected get validator() {
        return this._validator;
    }

    public getDefinitionManager(): DefinitionManager {
        return this.definitionManager;
    }
}
