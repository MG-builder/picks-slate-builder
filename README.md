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

## Workflow and screens

Set up, then Review, then Publish.

1. **Set up**: everything that decides the slate, and the Generate button.
   - At the top: the window, **Markets on slate** (the total), an optional hook, and
     **Generate N markets**.
   - A live preview for that window: per ticked mechanic, how many markets are possible, its
     count, how many go on the slate, how many are reserves, how many were removed because the
     teams play each other, and why a mechanic produces nothing (unticked, window ceiling, no
     players fit). A note explains when the counts and the total differ.
   - Below: mechanics (tick **Use**, set **Count**), entities, windows and rules. Changes save
     immediately.
2. **Generate** happens from Set up and opens the new slate in Review.
3. **Review**: the slate, one row per market. Approve or reject per row or in bulk, record Yes and
   No prices and an approver. Approval is blocked with an inline message unless both prices are
   positive numbers and an approver is named. **Swap** replaces a market with any reserve: the
   same mechanic's reserves are listed first, then the other mechanics'. The swapped-out market
   goes back to reserves. The reserves list also has **Add to slate**. Save writes the slate to
   History.
4. **Publish**: checks that nothing on the slate is still pending and at least one market is
   approved, then publishes: stamps the slate, saves it to History and locks it. The CSV of
   published markets and the Slack text are available once published. Rejected markets are left
   out. Reopening a published slate for editing marks it unpublished.
5. **History**: saved slates, newest first, with published status. Opening one shows it read only
   until you choose "Reopen for editing".

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

| Ticked by default | Mechanic | Count | Slots | Group rule |
|---|---|---|---|---|
| Yes | Both players to score | 5 | scorer, scorer | different-teams |
| Yes | All three players to score | 1 | scorer x3 | different-teams |
| No | Both / all three to score or assist | 3 / 1 | ga x2, ga x3 | different-teams |
| No | Teammates: A scores, B assists | 2 | scorer, assister | same-team |
| No | Both to assist; A scores, B assists across matches; all four to score | 2 / 2 / 1 | | |

Which mechanics run when is a product decision for the PRDs, so the app has no phases: a
mechanic is either ticked or not.

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
     the window's fixtures (so the outcomes are independent; e.g. Haaland with Isak is removed
     in a week Liverpool play Man City)
   - `same-team`: all on the same team

   Each group is repeated per ladder line, if the mechanic has lines. Groups are capped at
   `groupCap` per mechanic (slate plus reserves), in config order, so entity order sets
   priority. Generate reports
   both the groups left out by the fixture check and any cut by the cap.
2. **Eligibility filter**: drop a candidate if the mechanic's window ceiling cannot cover the
   selected window (gameweek < fortnight < season), or if the mechanic is unticked.

Then the slate is chosen, in config order: each ticked mechanic gets up to its `count` until
`slateSize` (Markets on slate) is reached. If the counts add up to less than `slateSize`, the
slate is topped up one market at a time from each ticked mechanic in turn (mechanics with a count
of 0 are left out). Everything else is a reserve. Nothing is thrown away: every candidate that passes the filter is in the slate
or in reserves, up to the max candidates per mechanic (`groupCap`).

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
- `Mechanic.enabled` and `Mechanic.count`: the tick box, and how many of that mechanic go on the
  slate. `RuleConfig.slateSize`: the total markets on the slate.
- `SlateMarket.onSlate`: on the slate or a reserve. `Slate.publishedAt`: when it was published.
- The brief's `phase` and `RuleConfig.livePhases` are gone, and `slateSize` now sets the slate
  rather than being a display hint. Config saved with phases
  is converted: a mechanic is ticked if its phase was live, and takes the seed's count.
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
- **Ranking**: candidates appear in config order, not by quality or appeal. The slate is simply
  the first `count` of each mechanic; reorder players in config to change priority.
- **Grouping**: no themed bundles.
- **Resolution rule text**: only the mechanic's short tie rule is shown; no settlement wording is
  generated.
- **Pricing**: prices are recorded decisions. The app never calculates, suggests or sanity checks
  odds beyond "is it a positive number".
- **Settlement**: no results, no grading.
- **Publishing to customers**: Publish locks the slate and gives you the CSV and Slack text;
  nothing leaves the browser except what you copy out yourself.

Country relevance is stored on entities and editable, but is not used by the pipeline.
Fixtures are typed into config; there is no fixtures feed.
