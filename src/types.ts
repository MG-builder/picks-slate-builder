export type EntityType = "player" | "team" | "league";
export type WindowKind = "gameweek" | "fortnight" | "season";
export type Phase = 1 | 2 | 3;
export type MarketStatus = "pending" | "approved" | "rejected";

export const ENTITY_TYPES: EntityType[] = ["player", "team", "league"];
/** Ordered narrowest to widest. A ceiling covers every kind at or before it. */
export const WINDOW_KINDS: WindowKind[] = ["gameweek", "fortnight", "season"];
export const PHASES: Phase[] = [1, 2, 3];

export interface Mechanic {
  id: string;
  name: string;
  /** Uses {a}, {b}, {line} and {window} placeholders. */
  questionShape: string;
  allowedEntityTypes: EntityType[];
  /** 2 for head-to-head or "both" mechanics that take an unordered pair. */
  entityCount: 1 | 2;
  sourceMarket: string;
  windowCeiling: WindowKind;
  tieRule: string;
  phase: Phase;
  lines: number[];
  metric: string;
  operator: string;
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  league: string;
  feedId: string;
  countryRelevance: string[];
  eligible: boolean;
}

/** "Window" in the spec. Renamed to avoid clashing with the DOM's global Window type. */
export interface MarketWindow {
  id: string;
  label: string;
  kind: WindowKind;
  roundIds: string[];
  opensAt: string;
  closesAt: string;
}

export interface RuleConfig {
  slateSize: number;
  livePhases: Phase[];
  /** Maximum unordered pairs generated per two-entity mechanic. */
  pairCap: number;
}

export interface Config {
  mechanics: Mechanic[];
  entities: Entity[];
  windows: MarketWindow[];
  rules: RuleConfig;
}

export interface SlateMarket {
  id: string;
  mechanicId: string;
  entityId: string;
  /** Second entity for two-entity mechanics, otherwise null. */
  secondEntityId: string | null;
  line: number | null;
  windowId: string;
  status: MarketStatus;
  yesPrice: number | null;
  noPrice: number | null;
  approver: string | null;
  decidedAt: string | null;
}

export interface Slate {
  id: string;
  windowId: string;
  createdAt: string;
  hook: string;
  markets: SlateMarket[];
}
