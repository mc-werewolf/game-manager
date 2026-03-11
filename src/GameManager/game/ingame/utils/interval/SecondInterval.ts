import { SYSTEMS } from "../../../../constants/systems";
import { BaseInterval } from "./BaseInterval";
import type { IntervalManager } from "../IntervalManager";

export class SecondInterval extends BaseInterval {
    public constructor(private readonly intervalManager: IntervalManager) {
        super(SYSTEMS.INTERVAL.EVERY_SECOND);
    }
}
