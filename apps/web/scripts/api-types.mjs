// Generates src/shared/api/api.types.ts from the API's OpenAPI document.
// Run through `pnpm api:types`.
import { readFile, writeFile } from "node:fs/promises";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";
import ts from "typescript";

const SOURCE = new URL("../../api/openapi.json", import.meta.url);
const TARGET = new URL("../src/shared/api/api.types.ts", import.meta.url);

const BLOB = ts.factory.createTypeReferenceNode("Blob");

const ast = await openapiTS(JSON.parse(await readFile(SOURCE, "utf8")), {
  // An uploaded file is a string in OpenAPI and a Blob in the multipart body.
  transform(schema) {
    if (schema.format === "binary" || schema.contentMediaType === "application/octet-stream") {
      return BLOB;
    }
    return undefined;
  },
});

await writeFile(TARGET, COMMENT_HEADER + astToString(ast));
