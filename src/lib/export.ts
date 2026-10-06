import type { Slate } from "../types";
import { type Lookup, entityName, missing, question } from "./format";

const CSV_COLUMNS = [
  "slateId", "slateCreatedAt", "slatePublishedAt", "slateHook",
  "windowId", "windowLabel", "windowKind", "windowOpensAt", "windowClosesAt",
  "marketId", "question",
  "mechanicId", "mechanicName", "questionShape", "mechanicLeagues", "sourceMarket", "windowFloor", "windowCeiling", "tieRule", "metric", "operator",
  "entityId", "entityName", "entityType", "entityLeague", "entityFeedId",
  "otherEntityIds", "otherEntityNames", "otherEntityTypes", "otherEntityLeagues", "otherEntityFeedIds",
  "line", "status", "yesPrice", "noPrice", "approver", "decidedAt",
] as const;

function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function approvedCsv(slate: Slate, lk: Lookup): string {
  const w = lk.window(slate.windowId);
  const rows = slate.markets
    .filter((m) => m.onSlate && m.status === "approved")
    .map((m) => {
      const mech = lk.mechanic(m.mechanicId);
      const a = lk.entity(m.entityId);
      const others = m.otherEntityIds.map((id) => lk.entity(id));
      const joined = (xs: unknown[]) => xs.map((x) => x ?? "").join("; ");
      const row: Record<(typeof CSV_COLUMNS)[number], unknown> = {
        slateId: slate.id,
        slateCreatedAt: slate.createdAt,
        slatePublishedAt: slate.publishedAt,
        slateHook: slate.hook,
        windowId: slate.windowId,
        windowLabel: w?.label ?? missing(slate.windowId),
        windowKind: w?.kind,
        windowOpensAt: w?.opensAt,
        windowClosesAt: w?.closesAt,
        marketId: m.id,
        question: question(lk, m),
        mechanicId: m.mechanicId,
        mechanicName: mech?.name ?? missing(m.mechanicId),
        questionShape: mech?.questionShape,
        mechanicLeagues: mech ? joined(mech.leagues) : "",
        sourceMarket: mech?.sourceMarket,
        windowFloor: mech?.windowFloor,
        windowCeiling: mech?.windowCeiling,
        tieRule: mech?.tieRule,
        metric: mech?.metric,
        operator: mech?.operator,
        entityId: m.entityId,
        entityName: entityName(lk, m.entityId),
        entityType: a?.type,
        entityLeague: a?.league,
        entityFeedId: a?.feedId,
        otherEntityIds: joined(m.otherEntityIds),
        otherEntityNames: joined(m.otherEntityIds.map((id) => entityName(lk, id))),
        otherEntityTypes: joined(others.map((e) => e?.type)),
        otherEntityLeagues: joined(others.map((e) => e?.league)),
        otherEntityFeedIds: joined(others.map((e) => e?.feedId)),
        line: m.line,
        status: m.status,
        yesPrice: m.yesPrice,
        noPrice: m.noPrice,
        approver: m.approver,
        decidedAt: m.decidedAt,
      };
      return CSV_COLUMNS.map((c) => cell(row[c])).join(",");
    });
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}

export function slackSummary(slate: Slate, lk: Lookup): string {
  const w = lk.window(slate.windowId);
  const approved = slate.markets.filter((m) => m.onSlate && m.status === "approved");
  const lines = [
    `*Picks slate: ${w?.label ?? missing(slate.windowId)}*`,
    `Hook: ${slate.hook || "(none)"}`,
    `Markets: ${approved.length}`,
    "",
    ...approved.map(
      (m, i) => `${i + 1}. ${question(lk, m)} | Yes ${m.yesPrice} | No ${m.noPrice} | ${m.approver}`,
    ),
  ];
  return lines.join("\n");
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
