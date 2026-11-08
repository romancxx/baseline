# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root: the domain vocabulary shared by both apps.
- **ADRs of the app you're working in**: `apps/api/docs/adr/` or `apps/web/docs/adr/`.
  Each folder's `README.md` indexes its records; read the ones that touch the area you're about to work in.

If any of these files don't exist, proceed silently.
Don't flag their absence; don't suggest creating them upfront.
They are created lazily when terms or decisions actually get resolved.

## File structure

```
/
├── GLOSSARY.md
└── apps/
    ├── api/docs/adr/      ← backend decisions
    └── web/docs/adr/      ← frontend decisions
```

There is no root `docs/adr/`: a skill that reads or writes ADRs in `docs/adr/` uses the app's folder instead.

## Writing ADRs

Write an ADR in the folder of the app the decision concerns.
Match that folder's conventions, not `domain-modeling`'s `ADR-FORMAT.md`:

- **Format**: copy the shape of the existing records (numbered title, `Status` and `Date` lines, then sections).
- **API** (`apps/api/docs/adr/`): one record per topic.
  A decision that changes an existing topic updates that record instead of adding a new one.
  A new topic gets the next number and a row in `README.md`'s index.
  Follow the Docs rules in `apps/api/CLAUDE.md`.
- **Web** (`apps/web/docs/adr/`): one record per implementation phase, indexed in its `README.md`.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`.
Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts API ADR-0009 (portfolios), but worth reopening because…_
