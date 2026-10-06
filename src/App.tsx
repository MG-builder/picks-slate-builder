import { useState } from "react";
import type { Config, Slate } from "./types";
import {
  type Draft,
  loadConfig, loadDraft, loadSlates, saveConfig, saveDraft, saveSlates,
} from "./lib/storage";
import { createSlate, runPipeline } from "./lib/generate";
import ReviewScreen from "./screens/Review";
import ConfigScreen from "./screens/Config";
import PublishScreen from "./screens/Publish";
import HistoryScreen from "./screens/History";

type Tab = "setup" | "review" | "publish" | "history";
const TABS: { id: Tab; label: string }[] = [
  { id: "setup", label: "Set up" },
  { id: "review", label: "Review" },
  { id: "publish", label: "Publish" },
  { id: "history", label: "History" },
];

export default function App() {
  const [config, setConfigState] = useState<Config>(loadConfig);
  const [slates, setSlatesState] = useState<Slate[]>(loadSlates);
  const [draft, setDraftState] = useState<Draft | null>(loadDraft);
  const [tab, setTab] = useState<Tab>(() => (loadDraft() ? "review" : "setup"));
  /** Window chosen on the set up screen. */
  const [windowId, setWindowId] = useState(() => loadConfig().windows[0]?.id ?? "");

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

  /** Rebuilds the open slate's window and hook from the current config, as a new slate. */
  const onRegenerate = () => {
    if (!draft) return;
    const win = config.windows.find((w) => w.id === draft.slate.windowId);
    if (!win) {
      setTab("setup");
      return;
    }
    onGenerate(createSlate(win, draft.slate.hook, runPipeline(config, win).selected));
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

  /** Stamps the slate as published, saves it to History and locks it. */
  const onPublish = () => {
    if (!draft) return;
    const slate = { ...draft.slate, publishedAt: new Date().toISOString() };
    setSlates([slate, ...slates.filter((s) => s.id !== slate.id)]);
    setDraft({ slate, readOnly: true, dirty: false });
  };

  const onReopen = () => {
    if (!draft) return;
    if (draft.slate.publishedAt) {
      if (!window.confirm("This slate has been published. Reopen it for editing? It will be marked unpublished.")) return;
      setDraft({ slate: { ...draft.slate, publishedAt: null }, readOnly: false, dirty: true });
      return;
    }
    setDraft({ ...draft, readOnly: false });
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
          {draft
            ? `Current slate: ${draft.slate.id}${draft.slate.publishedAt ? " (published)" : draft.readOnly ? " (read only)" : ""}`
            : "No slate open"}
        </span>
      </header>
      <main>
        {tab === "setup" && (
          <ConfigScreen
            config={config}
            onChange={setConfig}
            windowId={windowId}
            onWindowChange={setWindowId}
            onGenerate={onGenerate}
          />
        )}
        {tab === "review" && (
          <ReviewScreen
            config={config}
            draft={draft}
            onChange={(slate) => draft && setDraft({ ...draft, slate, dirty: true })}
            onSave={onSave}
            onReopen={onReopen}
            onGoGenerate={() => setTab("setup")}
            onRegenerate={onRegenerate}
          />
        )}
        {tab === "publish" && <PublishScreen config={config} draft={draft} onPublish={onPublish} />}
        {tab === "history" && (
          <HistoryScreen config={config} slates={slates} currentId={draft?.slate.id ?? null} onOpen={onOpen} />
        )}
      </main>
    </div>
  );
}
