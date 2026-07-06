import type { StoredRole } from "../types/role";

const roles = new Map<string, StoredRole>();

export const roleRegistry = {
    register(role: StoredRole): void {
        if (roles.has(role.roleId)) {
            throw new Error(`[game-manager] Role "${role.roleId}" is already registered`);
        }
        roles.set(role.roleId, role);
    },

    get(roleId: string): StoredRole | undefined {
        return roles.get(roleId);
    },

    getAll(): ReadonlyMap<string, StoredRole> {
        return roles;
    },

    clear(): void {
        roles.clear();
    },
};
