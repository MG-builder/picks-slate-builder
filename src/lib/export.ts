import type { Slate } from "../types";
import { type Lookup, entityName, missing, question } from "./format";

const CSV_COLUMNS = [
  "slateId", "slateCreatedAt", "slateHook",
  "windowId", "windowLabel", "windowKind", "windowOpensAt", "windowClosesAt",
  "marketId", "question",
  "mechanicId", "mechanicName", "questionShape", "sourceMarket", "windowCeiling", "phase", "tieRule", "metric", "operator",
  "entityId", "entityName", "entityType", "entityLeague", "entityFeedId",
  "secondEntityId", "secondEntityName", "secondEntityType", "secondEntityLeague", "secondEntityFeedId",
  "line", "status", "yesPrice", "noPrice", "approver", "decidedAt",
] as const;

function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function approvedCsv(slate: Slate, lk: Lookup): string {
  const w = lk.window(slate.windowId);
  const rows = slate.markets
    .filter((m) => m.status === "approved")
    .map((m) => {
      const mech = lk.mechanic(m.mechanicId);
      const a = lk.entity(m.entityId);
      const b = lk.entity(m.secondEntityId);
      const row: Record<(typeof CSV_COLUMNS)[number], unknown> = {
        slateId: slate.id,
        slateCreatedAt: slate.createdAt,
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
        sourceMarket: mech?.sourceMarket,
        windowCeiling: mech?.windowCeiling,
        phase: mech?.phase,
        tieRule: mech?.tieRule,
        metric: mech?.metric,
        operator: mech?.operator,
        entityId: m.entityId,
        entityName: entityName(lk, m.entityId),
        entityType: a?.type,
        entityLeague: a?.league,
        entityFeedId: a?.feedId,
        secondEntityId: m.secondEntityId,
        secondEntityName: entityName(lk, m.secondEntityId),
        secondEntityType: b?.type,
        secondEntityLeague: b?.league,
        secondEntityFeedId: b?.feedId,
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
  const approved = slate.markets.filter((m) => m.status === "approved");
  const lines = [
    `*Picks slate: ${w?.label ?? missing(slate.windowId)}*`,
    `Hook: ${slate.hook || "(none)"}`,
    `Approved: ${approved.length} of ${slate.markets.length} candidates`,
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
