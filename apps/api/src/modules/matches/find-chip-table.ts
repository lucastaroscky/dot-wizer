import { CHIP_TABLES } from "@pontinho/rules";
import type { ChipTable } from "@pontinho/rules";
import { UnprocessableError } from "../../common/errors/http-errors.ts";
import errors from "../../common/messages/errors.json" with { type: "json" };

export function findChipTable({ table }: { table: number }): ChipTable {
  const chipTable = CHIP_TABLES.find(({ id }) => id === table);
  if (!chipTable) {
    throw new UnprocessableError(errors.matches.tableNotFound);
  }
  return chipTable;
}
