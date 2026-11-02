import assert from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { API_ERROR_CODES, API_ERROR_STATUS } from "../src/index.ts";

const DOCS_DIRECTORY = fileURLToPath(new URL("../../../docs/", import.meta.url));
const CODE_COLUMN = "Código da API";
const STATUS_COLUMN = "Status";

interface CitedCode {
  file: string;
  code: string;
  status: string | undefined;
}

function markdownFiles(): string[] {
  return readdirSync(DOCS_DIRECTORY, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".md"));
}

function cellsOf(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function withoutBackticks(cell: string): string {
  return cell.replaceAll("`", "");
}

function isSeparator(cells: string[]): boolean {
  return cells.every((cell) => /^:?-+:?$/.test(cell));
}

function statusOf(header: string[], cells: string[]): string | undefined {
  const column = header.indexOf(STATUS_COLUMN);
  if (column === -1) {
    return undefined;
  }
  return withoutBackticks(cells[column]);
}

function citedCodesIn(file: string): CitedCode[] {
  const lines = readFileSync(join(DOCS_DIRECTORY, file), "utf8").split("\n");
  const cited: CitedCode[] = [];
  let header: string[] | undefined;
  for (const line of lines) {
    if (!line.startsWith("|")) {
      header = undefined;
      continue;
    }
    const cells = cellsOf(line);
    if (cells[0] === CODE_COLUMN) {
      header = cells;
      continue;
    }
    if (header && !isSeparator(cells)) {
      cited.push({ file, code: withoutBackticks(cells[0]), status: statusOf(header, cells) });
    }
  }
  return cited;
}

function citedCodes(): CitedCode[] {
  return markdownFiles().flatMap(citedCodesIn);
}

function problemsOf({ file, code, status }: CitedCode): string[] {
  const known = API_ERROR_CODES.find((candidate) => candidate === code);
  if (!known) {
    return [`${file}: o código ${code} não está na tabela de códigos`];
  }
  if (status !== undefined && status !== String(API_ERROR_STATUS[known])) {
    return [`${file}: ${code} aparece com status ${status}, e a tabela diz ${API_ERROR_STATUS[known]}`];
  }
  return [];
}

describe("docs", () => {
  it("cites error codes, so a parser that finds no table does not pass in silence", () => {
    assert.ok(citedCodes().length > 0);
  });

  it("cites only codes that exist in the table, with the status the table gives", () => {
    assert.deepStrictEqual(citedCodes().flatMap(problemsOf), []);
  });
});
