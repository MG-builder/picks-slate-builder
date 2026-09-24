# Picks Slate Builder

Internal prototype for the sportsbook product team. It generates a weekly list of candidate
prediction markets from a config, and lets a trader approve or reject each one and record a
Yes and No price.

Local only: Vite, React and TypeScript, no backend, no network calls, no analytics, no
authentication. All state lives in the browser's localStorage.

## Running it

Requires Node 20 or later.

```bash
npm install
npm run dev
```

Then open http://localhost:5180.

Other scripts:

- `npm run build`: typecheck and build to `dist/`
- `npm test`: unit tests for the generation pipeline
- `npm run typecheck`: TypeScript only

To start again from the seed data, use **Config > Reset to seed data** (keeps saved slates), or
clear the site's localStorage (removes everything).

## Screens

1. **Generate**: pick a window, add an optional hook, press Generate. Shows the candidate count
   before and after the eligibility filter, why candidates were dropped, a per-mechanic
   breakdown, and how far the list exceeds the slate size.
2. **Review**: one row per candidate market. Approve or reject per row or in bulk, record Yes and
   No prices and an approver. Approval is blocked with an inline message unless both prices are
   positive numbers and an approver is named. Decided rows are locked; Undo returns them to
   pending. Save writes the slate to history.
3. **Config**: editable mechanics, entities, windows and rules. Changes save immediately and apply
   to the next generation.
4. **Export**: CSV of approved markets (every slate, market, mechanic, entity and window field),
   and a plain text summary to paste into Slack.
5. **History**: saved slates, newest first. Opening one shows it read only until you choose
   "Reopen for editing".

## Generation pipeline

Two steps, deliberately nothing more:

1. **Candidates**: for each mechanic, every eligible entity whose type the mechanic allows (and
   whose league is in the mechanic's `leagues`, if set), times each ladder line (or once if the
   mechanic has no lines). Mechanics with `entityCount` 2 or 3 use unordered pairs or trios of
   entities from the same league (a group made only of leagues can always be formed), capped at
   `groupCap` per mechanic. When the cap bites, Generate says how many groups were left out.
2. **Eligibility filter**: drop a candidate if the mechanic's window ceiling cannot cover the
   selected window (gameweek < fortnight < season), or if its phase is not in `livePhases`.

`slateSize` is a display hint only. Nothing is ever truncated to fit it.

## Where the data lives

- Seed data: `src/data/` (mechanics, entities, windows, rule config)
- Types: `src/types.ts`
- Pipeline: `src/lib/generate.ts` (tests in `generate.test.ts`)
- localStorage keys: `psb.v1.config`, `psb.v1.slates` (saved history), `psb.v1.draft` (the slate
  currently open in Review, so a refresh does not lose work in progress)

## Additions to the brief's data model

- `Mechanic.entityCount` (1, 2 or 3): marks the mechanics that take a pair or trio of entities.
- `Mechanic.leagues`: optional league restriction, e.g. "All three players to score" is Premier
  League only. Empty means any league.
- `SlateMarket.otherEntityIds`: the further entities for pair or trio mechanics, otherwise empty.
  `entityId` is still the first entity.
- `RuleConfig.groupCap`: the cap on pairs or trios per mechanic, so it is configurable rather
  than hardcoded.

Data saved by earlier versions of the prototype (`pairCap`, `secondEntityId`) is upgraded when
it is loaded.
- The spec's `Window` type is called `MarketWindow` in code to avoid clashing with the browser's
  global `Window` type.

Slates store config ids, not copies. If you delete a mechanic, entity or window that a saved
slate uses, that slate shows `[missing: id]` in its place.

## What this prototype deliberately does not do

- **Dedupe**: overlapping or near-identical candidates are all listed.
- **Rotation**: no memory of what ran in previous weeks.
- **Ranking**: candidates appear in config order, not by quality or appeal.
- **Grouping or assembly**: no themed bundles and no picking a final slate of `slateSize`.
- **Resolution rule text**: only the mechanic's short tie rule is shown; no settlement wording is
  generated.
- **Pricing**: prices are recorded decisions. The app never calculates, suggests or sanity checks
  odds beyond "is it a positive number".
- **Settlement**: no results, no grading.
- **Publishing**: nothing leaves the browser except the CSV and text you copy out yourself.

Country relevance is stored on entities and editable, but is not used by the pipeline.
