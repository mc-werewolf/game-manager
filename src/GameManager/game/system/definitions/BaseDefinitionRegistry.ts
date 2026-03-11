import { ConsoleManager, KairoUtils, type KairoResponse } from "@kairo-js/router";
import type { BaseDefinition } from "../../../data/roles";
import type { DefinitionManager, DefinitionType } from "./DefinitionManager";

export interface ValidateResult<T> {
    addonId: string;
    isSuccessful: boolean;
    validatedDefinitions: T[];
}

export abstract class BaseDefinitionRegistry<T extends BaseDefinition> {
    protected readonly registeredIds = new Set<string>();
    protected readonly definitionsByAddon = new Map<string, T[]>();

    protected constructor(
        protected readonly definitionManager: DefinitionManager,
        private readonly definitionName: DefinitionType,
    ) {}

    protected abstract get validator(): {
        isDefinition(data: unknown): data is T;
    };

    public async register(addonId: string, rawDefinitions: unknown[]): Promise<KairoResponse> {
        const result = this.validate(addonId, rawDefinitions);

        if (result.isSuccessful) {
            result.validatedDefinitions.forEach((d) => this.registeredIds.add(d.id));
            this.definitionsByAddon.set(addonId, result.validatedDefinitions);
        }

        this.notifyRegistrationResult(
            result.isSuccessful,
            addonId,
            result.validatedDefinitions.map((d) => d.id),
        );

        return KairoUtils.buildKairoResponse({}, result.isSuccessful);
    }

    protected validate(addonId: string, raw: unknown[]): ValidateResult<T> {
        if (!addonId || !Array.isArray(raw)) {
            return { addonId, isSuccessful: false, validatedDefinitions: [] };
        }

        const validated: T[] = raw
            .map((item) => {
                if (!this.validator.isDefinition(item)) return null;

                if (this.registeredIds.has(item.id)) {
                    return null;
                }

                item.providerAddonId = addonId;
                return item;
            })
            .filter((v): v is T => v !== null);

        return {
            addonId,
            isSuccessful: validated.length > 0,
            validatedDefinitions: validated,
        };
    }

    protected notifyRegistrationResult(
        isSuccessful: boolean,
        addonId: string,
        definitionIds: string[],
    ) {
        if (isSuccessful) {
            ConsoleManager.log(
                `${this.definitionName} definitions registration succeeded from ${addonId}: [ ${definitionIds.join(", ")} ]`,
            );
        } else {
            ConsoleManager.warn(
                `${this.definitionName} definitions registration failed from ${addonId}`,
            );
        }
    }

    public getAll(): T[] {
        return [...this.definitionsByAddon.values()].flat();
    }

    public getMap(): Map<string, T[]> {
        return new Map(this.definitionsByAddon);
    }

    public getByAddon(addonId: string): T[] {
        return this.definitionsByAddon.get(addonId) ?? [];
    }

    public getById(id: string): T | undefined {
        for (const definitions of this.definitionsByAddon.values()) {
            const found = definitions.find((d) => d.id === id);
            if (found) return found;
        }
        return undefined;
    }
}
