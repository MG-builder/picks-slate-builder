import type { Entity } from "../types";

const EPL = "Premier League";
const BRA = "Brasileirao Serie A";

export const seedEntities: Entity[] = [
  // Leagues
  { id: "lg-epl", name: EPL, type: "league", league: EPL, feedId: "SR:tournament:17", countryRelevance: ["all"], eligible: true },
  { id: "lg-bra", name: BRA, type: "league", league: BRA, feedId: "SR:tournament:325", countryRelevance: ["Brazil"], eligible: true },

  // Teams
  { id: "tm-ars", name: "Arsenal", type: "team", league: EPL, feedId: "SR:competitor:42", countryRelevance: ["Nigeria", "Ghana", "Kenya"], eligible: true },
  { id: "tm-che", name: "Chelsea", type: "team", league: EPL, feedId: "SR:competitor:38", countryRelevance: ["Nigeria", "Ghana"], eligible: true },
  { id: "tm-liv", name: "Liverpool", type: "team", league: EPL, feedId: "SR:competitor:44", countryRelevance: ["all"], eligible: true },
  { id: "tm-mci", name: "Manchester City", type: "team", league: EPL, feedId: "SR:competitor:17", countryRelevance: ["all"], eligible: true },
  { id: "tm-mun", name: "Manchester United", type: "team", league: EPL, feedId: "SR:competitor:35", countryRelevance: ["Nigeria", "Kenya"], eligible: true },
  { id: "tm-new", name: "Newcastle United", type: "team", league: EPL, feedId: "SR:competitor:39", countryRelevance: ["Ghana"], eligible: false },
  { id: "tm-fla", name: "Flamengo", type: "team", league: BRA, feedId: "SR:competitor:5981", countryRelevance: ["Brazil"], eligible: true },
  { id: "tm-pal", name: "Palmeiras", type: "team", league: BRA, feedId: "SR:competitor:1963", countryRelevance: ["Brazil"], eligible: true },
  { id: "tm-cor", name: "Corinthians", type: "team", league: BRA, feedId: "SR:competitor:1957", countryRelevance: ["Brazil"], eligible: true },
  { id: "tm-sao", name: "Sao Paulo", type: "team", league: BRA, feedId: "SR:competitor:1981", countryRelevance: ["Brazil"], eligible: true },

  // Players. Leagues other than the two above only matter for pairing: pair mechanics
  // only pair players from the same league, so Kane and Osimhen appear in single-player markets only.
  { id: "pl-haaland", name: "Erling Haaland", type: "player", league: EPL, feedId: "SR:player:901101", countryRelevance: ["all"], eligible: true },
  { id: "pl-isak", name: "Alexander Isak", type: "player", league: EPL, feedId: "SR:player:901102", countryRelevance: ["all"], eligible: true },
  { id: "pl-joaopedro", name: "João Pedro", type: "player", league: EPL, feedId: "SR:player:901103", countryRelevance: ["Brazil", "all"], eligible: true },
  { id: "pl-bruno", name: "Bruno Fernandes", type: "player", league: EPL, feedId: "SR:player:901104", countryRelevance: ["all"], eligible: true },
  { id: "pl-semenyo", name: "Antoine Semenyo", type: "player", league: EPL, feedId: "SR:player:901105", countryRelevance: ["Ghana"], eligible: true },
  { id: "pl-salah", name: "Mohamed Salah", type: "player", league: EPL, feedId: "SR:player:901106", countryRelevance: ["all"], eligible: true },
  { id: "pl-mbappe", name: "Kylian Mbappé", type: "player", league: "La Liga", feedId: "SR:player:903301", countryRelevance: ["all"], eligible: true },
  { id: "pl-yamal", name: "Lamine Yamal", type: "player", league: "La Liga", feedId: "SR:player:903302", countryRelevance: ["all"], eligible: true },
  { id: "pl-raphinha", name: "Raphinha", type: "player", league: "La Liga", feedId: "SR:player:903303", countryRelevance: ["Brazil"], eligible: true },
  { id: "pl-vinicius", name: "Vinícius Júnior", type: "player", league: "La Liga", feedId: "SR:player:903304", countryRelevance: ["Brazil"], eligible: true },
  { id: "pl-kane", name: "Harry Kane", type: "player", league: "Bundesliga", feedId: "SR:player:904401", countryRelevance: ["all"], eligible: true },
  { id: "pl-osimhen", name: "Victor Osimhen", type: "player", league: "Super Lig", feedId: "SR:player:905501", countryRelevance: ["Nigeria"], eligible: true },
];
