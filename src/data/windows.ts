import type { MarketWindow } from "../types";

/** Fixtures from the official 2026/27 Premier League fixture list. Kick-off times are placeholders. */
const gw6 = [
  "Arsenal v Leeds United",
  "Aston Villa v Brentford",
  "Chelsea v Bournemouth",
  "Coventry City v Newcastle United",
  "Crystal Palace v Nottingham Forest",
  "Hull City v Everton",
  "Ipswich Town v Fulham",
  "Liverpool v Manchester City",
  "Manchester United v Tottenham Hotspur",
  "Sunderland v Brighton & Hove Albion",
];

const gw7 = [
  "Bournemouth v Sunderland",
  "Brentford v Liverpool",
  "Brighton & Hove Albion v Crystal Palace",
  "Everton v Chelsea",
  "Fulham v Hull City",
  "Leeds United v Manchester United",
  "Manchester City v Ipswich Town",
  "Newcastle United v Aston Villa",
  "Nottingham Forest v Arsenal",
  "Tottenham Hotspur v Coventry City",
];

export const seedWindows: MarketWindow[] = [
  {
    id: "win-gw6",
    label: "Gameweek 6",
    kind: "gameweek",
    roundIds: ["EPL-2026-R6"],
    fixtures: gw6,
    opensAt: "2026-10-06T09:00:00Z",
    closesAt: "2026-10-10T11:30:00Z",
  },
  {
    id: "win-gw7",
    label: "Gameweek 7",
    kind: "gameweek",
    roundIds: ["EPL-2026-R7"],
    fixtures: gw7,
    opensAt: "2026-10-12T09:00:00Z",
    closesAt: "2026-10-17T11:30:00Z",
  },
  {
    id: "win-fn-6-7",
    label: "Fortnight: Gameweeks 6 and 7",
    kind: "fortnight",
    roundIds: ["EPL-2026-R6", "EPL-2026-R7"],
    fixtures: [...gw6, ...gw7],
    opensAt: "2026-10-06T09:00:00Z",
    closesAt: "2026-10-10T11:30:00Z",
  },
];
