import { SecondInterval } from "./interval/SecondInterval";
import { TickInterval } from "./interval/TickInterval";

export class IntervalManager {
    private readonly tickInterval: TickInterval;
    private readonly secondInterval: SecondInterval;

    private constructor() {
        this.tickInterval = new TickInterval(this);
        this.secondInterval = new SecondInterval(this);
    }
    public static create(): IntervalManager {
        return new IntervalManager();
    }

    /** 全interval開始 */
    public startAll(): void {
        this.tickInterval.start();
        this.secondInterval.start();
    }

    /** 全interval停止＆解除 */
    public clearAll(): void {
        this.tickInterval.clear();
        this.secondInterval.clear();
    }

    public get tick(): TickInterval {
        return this.tickInterval;
    }
    public get second(): SecondInterval {
        return this.secondInterval;
    }
}
