import { SYSTEMS } from "../../../../constants/systems";
import { BaseInterval } from "./BaseInterval";
import type { IntervalManager } from "../IntervalManager";

export class TickInterval extends BaseInterval {
    public constructor(private readonly intervalManager: IntervalManager) {
        super(SYSTEMS.INTERVAL.EVERY_TICK);
    }
}
