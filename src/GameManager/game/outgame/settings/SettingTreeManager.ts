import type { SettingCategoryNode, SettingNode } from "../../../data/settings";
import type { GameSettingManager } from "./GameSettingManager";

export class SettingTreeManager {
    private constructor(private readonly gameSettingManager: GameSettingManager) {}
    public static create(gameSettingManager: GameSettingManager): SettingTreeManager {
        return new SettingTreeManager(gameSettingManager);
    }

    public addNode(parentId: string, node: SettingNode): boolean {
        const parent = this.findCategoryNode(parentId, this.gameSettingManager.getRoot());
        if (!parent) return false;

        if (parent.children.some((c: SettingNode) => c.id === node.id)) {
            console.warn(
                `[SettingTree] Duplicate ID on same level: '${node.id}' under parent '${parentId}'`,
            );
            return false;
        }

        parent.children.push(node);
        this.sortChildren(parent);

        return true;
    }

    public findNodeUnderParent(parentId: string, id: string): SettingNode | null {
        const parent = this.findCategoryNode(parentId, this.gameSettingManager.getRoot());
        if (!parent) return null;

        return parent.children.find((c: SettingNode) => c.id === id) ?? null;
    }

    private findCategoryNode(id: string, current: SettingNode): SettingCategoryNode | null {
        if (current.id === id && current.type === "category") {
            return current;
        }

        if (current.type === "category") {
            for (const child of current.children) {
                const found = this.findCategoryNode(id, child);
                if (found) return found;
            }
        }

        return null;
    }

    private sortChildren(category: SettingCategoryNode): void {
        category.children.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    }
}
