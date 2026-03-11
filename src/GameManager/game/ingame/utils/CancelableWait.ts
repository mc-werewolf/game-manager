import { system } from "@minecraft/server";

export class CancelableWait {
    private cancelled = false;

    public cancel(): void {
        this.cancelled = true;
    }

    public reset(): void {
        this.cancelled = false;
    }

    public async waitTicks(ticks: number): Promise<void> {
        for (let i = 0; i < ticks; i++) {
            if (this.cancelled) return;
            await system.waitTicks(1);
        }
    }
}
