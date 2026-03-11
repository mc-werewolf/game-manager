import type { BaseDefinition } from "../../../data/roles";

export abstract class BaseDefinitionValidator<T extends BaseDefinition, R> {
    protected constructor(protected readonly registry: R) {}

    protected isObject(x: unknown): x is Record<string, unknown> {
        return typeof x === "object" && x !== null && !Array.isArray(x);
    }

    public abstract isDefinition(data: unknown): data is T;
}
