import { writeFile } from "node:fs/promises";
import { generateOpenApiDocument } from "../src/common/openapi/generate-document.ts";

const document = await generateOpenApiDocument();

await writeFile(new URL("../openapi.json", import.meta.url), `${JSON.stringify(document, null, 2)}\n`);
