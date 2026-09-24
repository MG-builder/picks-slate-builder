import type { MarketWindow } from "../types";

const rounds = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}-R${from + i}`);

export const seedWindows: MarketWindow[] = [
  {
    id: "win-gw6",
    label: "Gameweek 6",
    kind: "gameweek",
    roundIds: ["EPL-2026-R6", "BRA-2026-R27"],
    opensAt: "2026-09-25T09:00:00Z",
    closesAt: "2026-09-26T11:30:00Z",
  },
  {
    id: "win-gw7",
    label: "Gameweek 7",
    kind: "gameweek",
    roundIds: ["EPL-2026-R7", "BRA-2026-R28"],
    opensAt: "2026-09-29T09:00:00Z",
    closesAt: "2026-10-03T11:30:00Z",
  },
  {
    id: "win-fn-6-7",
    label: "Fortnight: Gameweeks 6 and 7",
    kind: "fortnight",
    roundIds: ["EPL-2026-R6", "EPL-2026-R7", "BRA-2026-R27", "BRA-2026-R28"],
    opensAt: "2026-09-25T09:00:00Z",
    closesAt: "2026-09-26T11:30:00Z",
  },
  {
    id: "win-season-2627",
    label: "Season 2026/27",
    kind: "season",
    roundIds: [...rounds("EPL-2026", 6, 38), ...rounds("BRA-2026", 27, 38)],
    opensAt: "2026-09-25T09:00:00Z",
    closesAt: "2026-09-26T11:30:00Z",
  },
];
