// @vitest-environment node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = import.meta.dirname;

/**
 * The whole of a page file: one screen imported from a feature's `server.ts`, and a default
 * export that returns it, passing `params` and `searchParams` through when the route has them.
 */
const PAGE_SHAPE =
  /^import \{ (\w+Screen) \} from "@\/features\/[a-z-]+\/server";\n\nexport default function \w+Page\((?:\{ (?:params, searchParams|params|searchParams) \}: PageProps<"[^"]+">)?\) \{\n {2}return <\1(?: params=\{params\})?(?: searchParams=\{searchParams\})? \/>;\n\}\n$/;

async function pageFiles(): Promise<string[]> {
  const files = await readdir(APP, { recursive: true });
  return files.filter((file) => path.basename(file) === "page.tsx").sort();
}

describe("app pages", () => {
  it("finds the pages to check", async () => {
    expect(await pageFiles()).not.toHaveLength(0);
  });

  it("only return the screen they render, rather than loading data or laying out markup", async () => {
    for (const file of await pageFiles()) {
      const source = await readFile(path.join(APP, file), "utf8");
      expect(source, file).toMatch(PAGE_SHAPE);
    }
  });
});
