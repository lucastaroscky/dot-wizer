import { CHIP_TABLES } from "@pontinho/rules";
import type { ChipTable } from "@pontinho/rules";
import { ApiError } from "../../common/errors/api-error.ts";

export function findChipTable({ table }: { table: number }): ChipTable {
  const chipTable = CHIP_TABLES.find(({ id }) => id === table);
  if (!chipTable) {
    throw new ApiError({ code: "tableNotFound" });
  }
  return chipTable;
}
