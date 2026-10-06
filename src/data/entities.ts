import type { Entity } from "../types";

export const EPL = "Premier League";

/**
 * Players from the 2025/26 top 10 scorers and top 10 assisters who are still in the
 * Premier League, plus Isak and Saka for 2026/27 form. Order is priority order: it decides
 * which groups come first when the group cap applies.
 *
 * Tags set the pools each mechanic draws from:
 * - scorer: big-name goalscorers
 * - assister: big-name creators
 * - ga: goal or assist pool
 * - club: teams, for markets that pair a player with their club
 * Untagged players are kept in config so they can be promoted by adding a tag.
 */
const player = (
  id: string,
  name: string,
  team: string,
  tags: string[],
  countryRelevance: string[] = ["all"],
): Entity => ({
  id,
  name,
  type: "player",
  league: EPL,
  team,
  feedId: `SR:player:${id.replace("pl-", "")}`,
  countryRelevance,
  tags,
  eligible: true,
});

export const seedEntities: Entity[] = [
  // Tier 1
  player("pl-haaland", "Erling Haaland", "Manchester City", ["scorer", "assister", "ga"]),
  player("pl-bruno", "Bruno Fernandes", "Manchester United", ["scorer", "assister", "ga"]),
  player("pl-semenyo", "Antoine Semenyo", "Manchester City", ["scorer", "ga"], ["Ghana", "all"]),
  player("pl-joaopedro", "João Pedro", "Chelsea", ["scorer", "ga"], ["Brazil", "all"]),
  player("pl-gyokeres", "Viktor Gyökeres", "Arsenal", ["scorer", "ga"]),
  player("pl-isak", "Alexander Isak", "Liverpool", ["scorer", "ga"]),
  player("pl-cherki", "Rayan Cherki", "Manchester City", ["assister", "ga"]),
  player("pl-szoboszlai", "Dominik Szoboszlai", "Liverpool", ["assister"]),
  player("pl-rogers", "Morgan Rogers", "Chelsea", ["assister", "ga"]),
  player("pl-odegaard", "Martin Ødegaard", "Arsenal", ["assister"]),

  // Tier 2 and 3: in config, not in any pool yet
  player("pl-thiago", "Igor Thiago", "Brentford", [], ["Brazil", "all"]),
  player("pl-gibbswhite", "Morgan Gibbs-White", "Nottingham Forest", []),
  player("pl-welbeck", "Danny Welbeck", "Chelsea", []),
  player("pl-saka", "Bukayo Saka", "Arsenal", [], ["Nigeria", "all"]),
  player("pl-calvertlewin", "Dominic Calvert-Lewin", "Leeds United", []),
  player("pl-kroupi", "Junior Kroupi", "Bournemouth", []),
  player("pl-mateta", "Jean-Philippe Mateta", "Crystal Palace", []),
  player("pl-garner", "James Garner", "Everton", []),
  player("pl-wilson", "Harry Wilson", "Leeds United", []),
  player("pl-neto", "Pedro Neto", "Chelsea", []),
  player("pl-trossard", "Leandro Trossard", "Arsenal", []),

  // Clubs of the tier 1 scorers, for "score and team win"
  ...[
    ["tm-mancity", "Manchester City"],
    ["tm-manutd", "Manchester United"],
    ["tm-chelsea", "Chelsea"],
    ["tm-arsenal", "Arsenal"],
    ["tm-liverpool", "Liverpool"],
  ].map(([id, name]): Entity => ({
    id,
    name,
    type: "team",
    league: EPL,
    team: name,
    feedId: `SR:team:${id.replace("tm-", "")}`,
    countryRelevance: ["all"],
    tags: ["club"],
    eligible: true,
  })),
];
