import { useState } from "react";
import type { Config, Slate } from "./types";
import {
  type Draft,
  loadConfig, loadDraft, loadSlates, saveConfig, saveDraft, saveSlates,
} from "./lib/storage";
import GenerateScreen from "./screens/Generate";
import ReviewScreen from "./screens/Review";
import ConfigScreen from "./screens/Config";
import ExportScreen from "./screens/Export";
import HistoryScreen from "./screens/History";

type Tab = "generate" | "review" | "config" | "export" | "history";
const TABS: { id: Tab; label: string }[] = [
  { id: "generate", label: "Generate" },
  { id: "review", label: "Review" },
  { id: "config", label: "Config" },
  { id: "export", label: "Export" },
  { id: "history", label: "History" },
];

export default function App() {
  const [config, setConfigState] = useState<Config>(loadConfig);
  const [slates, setSlatesState] = useState<Slate[]>(loadSlates);
  const [draft, setDraftState] = useState<Draft | null>(loadDraft);
  const [tab, setTab] = useState<Tab>(() => (loadDraft() ? "review" : "generate"));

  const setConfig = (c: Config) => {
    setConfigState(c);
    saveConfig(c);
  };
  const setDraft = (d: Draft | null) => {
    setDraftState(d);
    saveDraft(d);
  };
  const setSlates = (s: Slate[]) => {
    setSlatesState(s);
    saveSlates(s);
  };

  const okToReplaceDraft = () =>
    !draft?.dirty || window.confirm("The slate in Review has unsaved changes. Discard them?");

  const onGenerate = (slate: Slate) => {
    if (!okToReplaceDraft()) return;
    setDraft({ slate, readOnly: false, dirty: true });
    setTab("review");
  };

  const onSave = () => {
    if (!draft) return;
    const others = slates.filter((s) => s.id !== draft.slate.id);
    setSlates([draft.slate, ...others]);
    setDraft({ ...draft, dirty: false });
  };

  const onOpen = (slate: Slate) => {
    if (!okToReplaceDraft()) return;
    setDraft({ slate, readOnly: true, dirty: false });
    setTab("review");
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Picks Slate Builder</h1>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "tab active" : "tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "review" && draft?.dirty && <span className="dot" title="Unsaved changes" />}
            </button>
          ))}
        </nav>
        <span className="topbar-meta">
          {draft ? `Current slate: ${draft.slate.id}${draft.readOnly ? " (read only)" : ""}` : "No slate open"}
        </span>
      </header>
      <main>
        {tab === "generate" && <GenerateScreen config={config} onGenerate={onGenerate} />}
        {tab === "review" && (
          <ReviewScreen
            config={config}
            draft={draft}
            onChange={(slate) => draft && setDraft({ ...draft, slate, dirty: true })}
            onSave={onSave}
            onReopen={() => draft && setDraft({ ...draft, readOnly: false })}
            onGoGenerate={() => setTab("generate")}
          />
        )}
        {tab === "config" && <ConfigScreen config={config} onChange={setConfig} />}
        {tab === "export" && <ExportScreen config={config} draft={draft} />}
        {tab === "history" && (
          <HistoryScreen config={config} slates={slates} currentId={draft?.slate.id ?? null} onOpen={onOpen} />
        )}
      </main>
    </div>
  );
}
