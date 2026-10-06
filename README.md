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

## Player markets (current seed)

The seed is the player-markets MVP: Premier League players from last season's top 10 scorers
and top 10 assisters who are still in the league, plus Isak and Saka for current form.
Entity **tags** put players into pools, and each mechanic's **slots** say which pool fills each
position:

| Tag | Pool |
|---|---|
| `scorer` | Haaland, Bruno Fernandes, Semenyo, Joao Pedro, Gyokeres, Isak |
| `assister` | Bruno Fernandes, Cherki, Haaland, Szoboszlai, Rogers, Odegaard |
| `ga` (goal or assist) | Haaland, Bruno Fernandes, Semenyo, Joao Pedro, Cherki, Gyokeres, Isak, Rogers |

Other players are in config without tags; add a tag to bring them into a pool.

| Phase | Mechanic | Slots | Group rule |
|---|---|---|---|
| 1 (live) | Both players to score | scorer, scorer | different-teams |
| 1 (live) | All three players to score | scorer x3 | different-teams |
| 2 | Both / all three to score or assist | ga x2, ga x3 | different-teams |
| 3 | Teammates: A scores, B assists | scorer, assister | same-team |
| 4 (parked) | Both to assist; A scores, B assists across matches; all four to score | | |

Phase 2 waits on an agreed assist data source, phase 3 on same-match (bet builder) pricing.
Phase 4 holds combinations assessed and not recommended, so they can be switched on later
under Config, Rules.

Windows carry the real fixtures for gameweeks 6 and 7 from the official 2026/27 fixture list.
Kick-off times are placeholders.

## Generation pipeline

Two steps, deliberately nothing more:

1. **Candidates**: for each mechanic, take eligible entities whose type the mechanic allows (and
   whose league is in the mechanic's `leagues`, if set), then fill the mechanic's slots from
   that pool. Each slot needs an entity carrying that tag (`*` accepts any). Identical slots
   give unordered groups; different slots give ordered roles, e.g. scorer then assister. Groups
   must pass the mechanic's group rule:
   - `same-league`: all from one league (a group made only of leagues is always allowed)
   - `different-teams`: all on different teams, and no two of those teams play each other in
     the window's fixtures
   - `same-team`: all on the same team

   Each group is repeated per ladder line, if the mechanic has lines. Groups are capped at
   `groupCap` per mechanic, in config order, so entity order sets priority. Generate reports
   both the groups left out by the fixture check and any cut by the cap.
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

- `Mechanic.slots`: one entity tag per entity in the market, replacing a plain entity count.
- `Mechanic.groupRule`: how the entities in a multi-entity market relate (see above).
- `Mechanic.leagues`: optional league restriction. Empty means any league.
- `Entity.team` and `Entity.tags`: club, and the pools the entity belongs to.
- `MarketWindow.fixtures`: "Home v Away" strings for the window, using entity team names.
- `SlateMarket.otherEntityIds`: entities in the second and later slots. `entityId` is still
  the first.
- `RuleConfig.groupCap`: the cap on groups per mechanic, so it is configurable.
- Phase 4 exists for parked mechanics.
- The spec's `Window` type is called `MarketWindow` in code to avoid clashing with the browser's
  global `Window` type.

Config saved before the player-markets rework is replaced with the seed on load, because its
mechanics, entities and windows no longer apply. Old slates are kept and upgraded
(`secondEntityId` becomes `otherEntityIds`); they show `[missing: id]` for anything no longer in
config.

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
Fixtures are typed into config; there is no fixtures feed.
