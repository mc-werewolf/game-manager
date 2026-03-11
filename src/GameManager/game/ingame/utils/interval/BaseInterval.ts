import { system } from "@minecraft/server";

export abstract class BaseInterval {
    private intervalId: number | null = null;
    private readonly subscribers = new Set<() => void>();

    protected constructor(private readonly delay: number) {}

    /** interval開始 */
    public start(): void {
        this.stop();
        this.intervalId = system.runInterval(() => {
            for (const fn of this.subscribers) fn();
        }, this.delay);
    }

    /** interval停止 */
    public stop(): void {
        if (this.intervalId !== null) {
            system.clearRun(this.intervalId);
            this.intervalId = null;
        }
    }

    public restart(): void {
        this.stop();
        this.start();
    }

    /** 登録 */
    public subscribe(fn: () => void, runImmediately = false): void {
        this.subscribers.add(fn);
        if (runImmediately) fn();
    }

    /** 登録解除 */
    public unsubscribe(fn: () => void): void {
        this.subscribers.delete(fn);
    }

    /** 全解除 */
    public clear(): void {
        this.stop();
        this.subscribers.clear();
    }

    /** 現在の登録数（デバッグ用） */
    public get size(): number {
        return this.subscribers.size;
    }

    public get isRunning(): boolean {
        return this.intervalId !== null;
    }
}
