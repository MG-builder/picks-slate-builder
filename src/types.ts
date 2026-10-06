export type EntityType = "player" | "team" | "league";
export type WindowKind = "gameweek" | "fortnight" | "season";
export type Phase = 1 | 2 | 3 | 4;
export type MarketStatus = "pending" | "approved" | "rejected";

export const ENTITY_TYPES: EntityType[] = ["player", "team", "league"];
/** Ordered narrowest to widest. A ceiling covers every kind at or before it. */
export const WINDOW_KINDS: WindowKind[] = ["gameweek", "fortnight", "season"];
export const PHASES: Phase[] = [1, 2, 3, 4];

/**
 * How the entities in a multi-entity market relate to each other.
 * - same-league: all from one league (a group made only of leagues is always allowed)
 * - different-teams: all on different teams, and no two of those teams play each other in the window
 * - same-team: all on the same team
 */
export type GroupRule = "same-league" | "different-teams" | "same-team";
export const GROUP_RULES: GroupRule[] = ["same-league", "different-teams", "same-team"];

/** Slot tag that accepts any entity. */
export const ANY_TAG = "*";

export interface Mechanic {
  id: string;
  name: string;
  /** Uses {a} to {d} (one per slot), {all}, {line} and {window} placeholders. */
  questionShape: string;
  allowedEntityTypes: EntityType[];
  /**
   * One entry per entity in the market. Each is an entity tag the entity must carry
   * ("*" for any), e.g. ["scorer", "scorer"] or ["scorer", "assister"].
   * Identical slots make unordered groups; different slots give each entity a role.
   */
  slots: string[];
  groupRule: GroupRule;
  /** Restricts candidates to entities in these leagues. Empty means any league. */
  leagues: string[];
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
  /** Club for players; the team's own name for teams; empty for leagues. */
  team: string;
  feedId: string;
  countryRelevance: string[];
  /** Pools this entity belongs to, matched against mechanic slots, e.g. "scorer", "assister". */
  tags: string[];
  eligible: boolean;
}

/** "Window" in the spec. Renamed to avoid clashing with the DOM's global Window type. */
export interface MarketWindow {
  id: string;
  label: string;
  kind: WindowKind;
  roundIds: string[];
  /** "Home v Away", using the same team names as entities. Used by the different-teams rule. */
  fixtures: string[];
  opensAt: string;
  closesAt: string;
}

export interface RuleConfig {
  slateSize: number;
  livePhases: Phase[];
  /** Maximum groups generated per multi-entity mechanic. */
  groupCap: number;
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
  /** Entities in the second and later slots, otherwise empty. */
  otherEntityIds: string[];
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
