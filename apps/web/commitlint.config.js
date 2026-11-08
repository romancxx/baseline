/**
 * Conventional Commits, enforced on the `commit-msg` hook.
 *
 * The scope list is deliberately closed and mirrors the folder structure: if a commit
 * doesn't fit an existing scope, either it is touching too much or a new slice is being
 * born — both are worth a moment's thought before the commit lands.
 */

/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        // feature slices
        "auth",
        "instruments",
        "news",
        "portfolio",
        // cross-cutting
        "shared",
        "app",
        "config",
        "db",
        "deps",
        "ci",
        "docs",
      ],
    ],
    "scope-empty": [1, "never"],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
    "header-max-length": [2, "always", 100],
  },
};
