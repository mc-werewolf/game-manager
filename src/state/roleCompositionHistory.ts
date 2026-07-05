import type { RoleCompositionHistoryRecord } from "../types/roleCompositionHistory";

const MAX_HISTORY_RECORDS = 20;
const records: RoleCompositionHistoryRecord[] = [];

export const roleCompositionHistory = {
    add(record: RoleCompositionHistoryRecord): void {
        records.unshift(record);
        if (records.length > MAX_HISTORY_RECORDS) {
            records.length = MAX_HISTORY_RECORDS;
        }
    },

    getAll(): readonly RoleCompositionHistoryRecord[] {
        return records;
    },

    replaceAll(nextRecords: readonly RoleCompositionHistoryRecord[]): void {
        records.length = 0;
        records.push(...nextRecords.slice(0, MAX_HISTORY_RECORDS));
    },
};
