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

  // Players (invented)
  { id: "pl-okafor", name: "Chinedu Okafor", type: "player", league: EPL, feedId: "SR:player:901101", countryRelevance: ["Nigeria"], eligible: true },
  { id: "pl-mensah", name: "Kwame Mensah", type: "player", league: EPL, feedId: "SR:player:901102", countryRelevance: ["Ghana"], eligible: true },
  { id: "pl-otieno", name: "Daniel Otieno", type: "player", league: EPL, feedId: "SR:player:901103", countryRelevance: ["Kenya"], eligible: true },
  { id: "pl-balogun", name: "Tunde Balogun", type: "player", league: EPL, feedId: "SR:player:901104", countryRelevance: ["Nigeria"], eligible: true },
  { id: "pl-asante", name: "Kofi Asante", type: "player", league: EPL, feedId: "SR:player:901105", countryRelevance: ["Ghana"], eligible: true },
  { id: "pl-moura", name: "Rafael Moura", type: "player", league: EPL, feedId: "SR:player:901106", countryRelevance: ["Brazil", "all"], eligible: true },
  { id: "pl-nwosu", name: "Emeka Nwosu", type: "player", league: EPL, feedId: "SR:player:901107", countryRelevance: ["Nigeria"], eligible: false },
  { id: "pl-ferreira", name: "Lucas Ferreira", type: "player", league: BRA, feedId: "SR:player:902201", countryRelevance: ["Brazil"], eligible: true },
  { id: "pl-rocha", name: "Gabriel Rocha", type: "player", league: BRA, feedId: "SR:player:902202", countryRelevance: ["Brazil"], eligible: true },
  { id: "pl-lima", name: "Thiago Lima", type: "player", league: BRA, feedId: "SR:player:902203", countryRelevance: ["Brazil"], eligible: true },
  { id: "pl-kamau", name: "Brian Kamau", type: "player", league: BRA, feedId: "SR:player:902204", countryRelevance: ["Kenya"], eligible: true },
];
