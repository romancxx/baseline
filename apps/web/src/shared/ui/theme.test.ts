// @vitest-environment node
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { compile } from "tailwindcss";
import { beforeAll, describe, expect, it } from "vitest";
import { THEME_TOKENS } from "@/shared/ui/cn";
import { BROWSER_THEME_COLOR } from "@/shared/ui/theme";

const SRC = path.resolve(import.meta.dirname, "../..");
const GLOBALS_CSS = path.join(SRC, "app/globals.css");
const THEME_CSS = path.join(SRC, "shared/ui/theme.css");

// Utilities whose value part comes from the theme; static ones (`flex`, `truncate`) always exist.
const THEMED_UTILITY =
  /^(?:[a-z-]+:)*-?(?:bg|text|border(?:-[trblxy])?|outline|rounded|p[trblxy]?|m[trblxy]?|gap(?:-[xy])?|w|h|size|min-w|max-w|min-h|max-h|opacity|font|leading|tracking)-[a-z0-9.-]+$/;

type Compiler = Awaited<ReturnType<typeof compile>>;

async function compileGlobals(): Promise<Compiler> {
  const require = createRequire(import.meta.url);

  return compile(await readFile(GLOBALS_CSS, "utf8"), {
    base: path.dirname(GLOBALS_CSS),
    loadStylesheet: async (id, base) => {
      const file =
        id === "tailwindcss" ? require.resolve("tailwindcss/index.css") : path.resolve(base, id);
      return { path: file, base: path.dirname(file), content: await readFile(file, "utf8") };
    },
  });
}

/** Utility classes in string literals of the app's source, components and style tables alike. */
async function usedUtilities(): Promise<string[]> {
  const files = (await readdir(SRC, { recursive: true })).filter(
    (file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && !file.endsWith(".d.ts"),
  );
  const found = new Set<string>();

  for (const file of files) {
    const source = await readFile(path.join(SRC, file), "utf8");
    for (const [, literal = ""] of source.matchAll(/"([^"\n]*)"|`([^`]*)`/g)) {
      for (const token of literal.replace(/\$\{[^}]*\}/g, " ").split(/\s+/)) {
        if (THEMED_UTILITY.test(token)) found.add(token);
      }
    }
  }

  return [...found].sort();
}

/** Classes that generate no CSS, each built on its own. */
function unresolved(compiler: Compiler, classes: readonly string[]): string[] {
  let css = compiler.build([]);
  return classes.filter((candidate) => {
    const next = compiler.build([candidate]);
    const missing = next === css;
    css = next;
    return missing;
  });
}

/** Token names declared in `theme.css` under `--<namespace>-<name>`. */
function declaredTokens(css: string, namespace: string): string[] {
  const pattern = new RegExp(`^\\s*--${namespace}-([a-z0-9-]+):`, "gm");
  return [...css.matchAll(pattern)]
    .map(([, name = ""]) => name)
    .filter((name) => !name.includes("--") && !name.startsWith("color-") && name !== "*")
    .sort();
}

describe("theme", () => {
  let compiler: Compiler;
  let themeCss: string;

  beforeAll(async () => {
    compiler = await compileGlobals();
    themeCss = await readFile(THEME_CSS, "utf8");
  });

  it("resolves every utility used in a component, rather than letting a stale class render nothing", async () => {
    const classes = await usedUtilities();

    expect(classes.length).toBeGreaterThan(0);
    expect(unresolved(compiler, classes)).toEqual([]);
  });

  it("resets Tailwind's defaults, so raw palette, scale and radius classes render nothing", () => {
    const defaults = [
      "text-gray-500",
      "bg-white",
      "text-sm",
      "rounded-md",
      "max-w-3xl",
      "leading-snug",
    ];

    expect(unresolved(compiler, defaults)).toEqual(defaults);
  });

  it("has no brand hue or avatar tints, so the six semantic hues are the only colour", () => {
    const removed = ["text-accent", "outline-accent", "bg-warm-tint", "text-cool"];

    expect(unresolved(compiler, removed)).toEqual(removed);
  });

  it("keeps price movement to text colour, so a gain or loss can never be a chip", () => {
    const misuses = ["bg-up", "bg-down", "border-up"];

    expect(unresolved(compiler, misuses)).toEqual(misuses);
  });

  it("keeps width and spacing token names apart, since w-, max-w- and min-w- read spacing first", () => {
    const spacing = declaredTokens(themeCss, "spacing");
    const shared = declaredTokens(themeCss, "container").filter((name) => spacing.includes(name));

    expect(shared).toEqual([]);
  });

  it("keeps the browser theme colour equal to the canvas token", () => {
    expect(themeCss).toContain(`--background-color-canvas: ${BROWSER_THEME_COLOR};`);
  });

  it("registers every non-colour token with cn, so merging never drops one as unknown", () => {
    for (const [namespace, names] of Object.entries(THEME_TOKENS)) {
      expect(declaredTokens(themeCss, namespace), namespace).toEqual([...names].sort());
    }
  });
});
