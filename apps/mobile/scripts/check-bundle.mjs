import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const OUTPUT_DIR = "dist-check";
const FORBIDDEN = ["/apps/game/", "/apps/api/"];

function sourceMaps(dir) {
  return readdirSync(dir, { recursive: true })
    .filter((file) => file.endsWith(".map"))
    .map((file) => path.join(dir, file));
}

execFileSync("npx", ["expo", "export", "--platform", "ios", "--source-maps", "--output-dir", OUTPUT_DIR], { stdio: "inherit" });

const sources = sourceMaps(OUTPUT_DIR).flatMap((file) => JSON.parse(readFileSync(file, "utf8")).sources);
const leaked = sources.filter((source) => FORBIDDEN.some((folder) => source.includes(folder)));
rmSync(OUTPUT_DIR, { recursive: true, force: true });

if (leaked.length > 0) {
  console.error("Código de servidor dentro do app:", leaked);
  process.exit(1);
}
console.log(`Pacote do app conferido: ${sources.length} arquivos, nenhum de servidor.`);
