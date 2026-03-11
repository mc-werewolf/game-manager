import { IntervalManager } from "./IntervalManager";

export interface CountdownOptions {
    onNormalTick?: (seconds: number) => void;
    onWarningTick?: (seconds: number) => void;
    onComplete?: () => void;
}

export class CountdownManager {
    private remainingTime = 0;
    private isRunning = false;
    private isCancelled = false;
    private resolveFn: (() => void) | null = null;
    private rejectFn: ((reason?: any) => void) | null = null;

    private readonly intervalManager: IntervalManager;

    private constructor(
        private readonly totalTime: number,
        private readonly verbose = true,
    ) {
        this.remainingTime = totalTime;
        this.intervalManager = IntervalManager.create();
    }

    public static create(totalTime: number, verbose = true): CountdownManager {
        return new CountdownManager(totalTime, verbose);
    }

    public async startAsync(options?: CountdownOptions): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;
        this.isCancelled = false;

        return new Promise<void>((resolve, reject) => {
            this.resolveFn = resolve;
            this.rejectFn = reject;

            this.intervalManager.tick.subscribe(() => {
                if (!this.isRunning) return;
                if (this.isCancelled) {
                    this.stopInternal(reject, new Error("Countdown cancelled"));
                }
            }, true);

            this.intervalManager.second.subscribe(() => {
                if (!this.isRunning || this.isCancelled) return;

                if (this.remainingTime <= 0) {
                    this.complete(options);
                    return;
                }

                this.handleSecond(options);
                this.remainingTime--;
            }, true);

            this.intervalManager.startAll();
        });
    }

    private handleSecond(options?: CountdownOptions): void {
        const s = this.remainingTime;

        if (!this.verbose && s % 10 !== 0 && ![3, 2, 1, 0].includes(s)) {
            return;
        }

        if (s > 3) {
            options?.onNormalTick?.(s);
        } else if (s <= 3 && s >= 1) {
            options?.onWarningTick?.(s);
        }
    }

    private complete(options?: CountdownOptions): void {
        const resolve = this.resolveFn;
        this.cleanup();
        options?.onComplete?.();
        resolve?.();
    }

    public stop(): void {
        if (!this.isRunning) return;
        this.isCancelled = true;
    }

    private stopInternal(reject: (reason?: any) => void, reason: Error): void {
        this.cleanup();
        reject(reason);
    }

    private cleanup(): void {
        this.intervalManager.clearAll();
        this.isRunning = false;
    }

    public getRemainingTime(): number {
        return this.remainingTime;
    }
}
