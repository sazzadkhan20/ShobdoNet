"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Sense { id: string; synset: string; }
interface LexicalEntry { id: string; writtenForm: string; partOfSpeech: string; senses: Sense[]; }
interface SynsetRelation { relType: string; target: string; }
interface Synset { id: string; ili: string; partOfSpeech: string; lexicalized: string; definition: string; relations: SynsetRelation[]; }
interface SearchResult { entry: LexicalEntry; synsets: Synset[]; }

// ─── Constants ────────────────────────────────────────────────────────────────
const POS_LABELS: Record<string, string> = {
  n: "Noun", v: "Verb", a: "Adjective", r: "Adverb", s: "Adj. Satellite",
};
const POS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  n: { bg: "rgba(87,97,57,0.18)",  text: "#a8b878", border: "rgba(168,184,120,0.35)" },
  v: { bg: "rgba(139,109,56,0.18)",text: "#d4a85a", border: "rgba(212,168,90,0.35)"  },
  a: { bg: "rgba(107,87,57,0.18)", text: "#c49a6c", border: "rgba(196,154,108,0.35)" },
  r: { bg: "rgba(67,87,57,0.18)",  text: "#8db870", border: "rgba(141,184,112,0.35)" },
  s: { bg: "rgba(97,117,67,0.18)", text: "#b8cc88", border: "rgba(184,204,136,0.35)" },
};
const REL_LABELS: Record<string, string> = {
  hypernym: "Hypernym", hyponym: "Hyponym", mero_member: "Member Meronym",
  mero_part: "Part Meronym", mero_substance: "Substance Meronym",
  holo_member: "Member Holonym", holo_part: "Part Holonym",
  holo_substance: "Substance Holonym", antonym: "Antonym", similar: "Similar",
  also: "See Also", attribute: "Attribute", cause: "Cause", entail: "Entails",
  domain_topic: "Domain Topic", domain_region: "Domain Region", exemplifies: "Exemplifies",
};

const DEFAULT_PAGE_SIZE = 15;
const PAGE_SIZE_OPTIONS = [15, 20, 30, 50];

type ThemeMode = "dark" | "forest" | "light";
const THEMES: { id: ThemeMode; label: string; icon: string }[] = [
  { id: "light",  label: "Light",  icon: "☀️" },
  { id: "dark",   label: "Dark",   icon: "🌑" },
  { id: "forest", label: "Forest", icon: "🌿" },
];

// ─── Theme Variables ──────────────────────────────────────────────────────────
function getThemeVars(mode: ThemeMode): string {
  if (mode === "dark") return `
    --bg:#0f110c; --bg2:#151810; --bg3:#1a1e13;
    --surface:#1e2317; --surface2:#232a1b;
    --border:#2a3320; --border2:#33401f;
    --accent:#8fa85a; --accent2:#6b7e3e;
    --accent-glow:rgba(143,168,90,0.13); --accent-dim:rgba(143,168,90,0.06);
    --text:#e8ead0; --text2:#a8aa88; --text3:#606848;
    --olive:#576139; --gold:#c8a84a; --rust:#b87040; --sage:#6a8854;
    --shadow:0 4px 24px rgba(0,0,0,0.55); --shadow-lg:0 8px 48px rgba(0,0,0,0.7);
    --header-bg:rgba(15,17,12,0.88); --footer-bg:rgba(15,17,12,0.93);
  `;
  if (mode === "forest") return `
    --bg:#192210; --bg2:#1f2914; --bg3:#243018;
    --surface:#2a381c; --surface2:#304020;
    --border:#3a5028; --border2:#446030;
    --accent:#a8c870; --accent2:#88a850;
    --accent-glow:rgba(168,200,112,0.15); --accent-dim:rgba(168,200,112,0.07);
    --text:#e0ecc8; --text2:#aac080; --text3:#708858;
    --olive:#78a050; --gold:#d8b858; --rust:#c88040; --sage:#88b868;
    --shadow:0 4px 24px rgba(0,0,0,0.42); --shadow-lg:0 8px 48px rgba(0,0,0,0.6);
    --header-bg:rgba(25,34,16,0.90); --footer-bg:rgba(25,34,16,0.95);
  `;
  return `
    --bg:#f4f3ec; --bg2:#eeede3; --bg3:#e5e4d6;
    --surface:#ffffff; --surface2:#f8f7ef;
    --border:#d2d0bc; --border2:#c0be9e;
    --accent:#576139; --accent2:#3e4828;
    --accent-glow:rgba(87,97,57,0.10); --accent-dim:rgba(87,97,57,0.05);
    --text:#1c1e0e; --text2:#484e2e; --text3:#848870;
    --olive:#576139; --gold:#886620; --rust:#884820; --sage:#486830;
    --shadow:0 4px 24px rgba(0,0,0,0.07); --shadow-lg:0 8px 48px rgba(0,0,0,0.10);
    --header-bg:rgba(244,243,236,0.90); --footer-bg:rgba(244,243,236,0.96);
  `;
}

// ─── XML Parser ───────────────────────────────────────────────────────────────
function parseXML(xmlText: string): { entries: LexicalEntry[]; synsets: Map<string, Synset> } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const entries: LexicalEntry[] = [];
  const synsets = new Map<string, Synset>();

  doc.querySelectorAll("LexicalEntry").forEach((el) => {
    const lemma = el.querySelector("Lemma");
    if (!lemma) return;
    const senses: Sense[] = [];
    el.querySelectorAll("Sense").forEach((s) => {
      senses.push({ id: s.getAttribute("id") || "", synset: s.getAttribute("synset") || "" });
    });
    entries.push({
      id: el.getAttribute("id") || "",
      writtenForm: lemma.getAttribute("writtenForm") || "",
      partOfSpeech: lemma.getAttribute("partOfSpeech") || "",
      senses,
    });
  });

  doc.querySelectorAll("Synset").forEach((el) => {
    const def = el.querySelector("Definition");
    const relations: SynsetRelation[] = [];
    el.querySelectorAll("SynsetRelation").forEach((r) => {
      relations.push({ relType: r.getAttribute("relType") || "", target: r.getAttribute("target") || "" });
    });
    const id = el.getAttribute("id") || "";
    synsets.set(id, {
      id,
      ili: el.getAttribute("ili") || "",
      partOfSpeech: el.getAttribute("partOfSpeech") || "",
      lexicalized: el.getAttribute("lexicalized") || "",
      definition: def?.textContent || "",
      relations,
    });
  });

  return { entries, synsets };
}

function searchEntries(query: string, entries: LexicalEntry[], synsetMap: Map<string, Synset>): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  const results: SearchResult[] = [];
  entries.forEach((entry) => {
    if (entry.writtenForm.toLowerCase().includes(q)) {
      const synsets: Synset[] = [];
      entry.senses.forEach((sense) => { const syn = synsetMap.get(sense.synset); if (syn) synsets.push(syn); });
      results.push({ entry, synsets });
    }
  });
  return results;
}

// ─── Result Card ──────────────────────────────────────────────────────────────
function ResultCard({ result, index }: { result: SearchResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const posStyle = POS_COLORS[result.entry.partOfSpeech] || POS_COLORS["n"];

  return (
    <div className="result-card" style={{ animationDelay: `${index * 45}ms` }}>
      <div className="card-bar" />
      <div className="card-body">
        {/* Title Row */}
        <div className="card-top">
          <div className="card-title-row">
            <span className="written-form">{result.entry.writtenForm}</span>
            <span className="pos-badge" style={{ background: posStyle.bg, color: posStyle.text, borderColor: posStyle.border }}>
              {POS_LABELS[result.entry.partOfSpeech] || result.entry.partOfSpeech}
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-pill"><span className="meta-k">Entry</span><span className="meta-v">{result.entry.id}</span></span>
            <span className="meta-pill"><span className="meta-k">Senses</span><span className="meta-v">{result.entry.senses.length}</span></span>
          </div>
        </div>

        {/* Synsets */}
        {result.synsets.length > 0 && (
          <div className="synsets-list">
            {result.synsets.slice(0, expanded ? undefined : 1).map((syn) => {
              const sense = result.entry.senses.find((s) => s.synset === syn.id);
              const sp = POS_COLORS[syn.partOfSpeech] || POS_COLORS["n"];
              return (
                <div key={syn.id} className="synset-block">
                  {/* IDs */}
                  <div className="syn-id-row">
                    <div className="chip-group">
                      <span className="chip chip-syn">⬡ {syn.id}</span>
                      {sense && <span className="chip chip-sen">◈ {sense.id}</span>}
                      {syn.ili && <span className="chip chip-ili">⊕ {syn.ili}</span>}
                    </div>
                    <div className="syn-badges">
                      <span className="pos-badge sm" style={{ background: sp.bg, color: sp.text, borderColor: sp.border }}>
                        {POS_LABELS[syn.partOfSpeech] || syn.partOfSpeech}
                      </span>
                      {syn.lexicalized === "true" && <span className="lex-badge">Lexicalized</span>}
                    </div>
                  </div>
                  {/* Definition */}
                  {syn.definition && (
                    <div className="def-block">
                      <span className="def-q">"</span>
                      <p className="def-text">{syn.definition}</p>
                    </div>
                  )}
                  {/* Relations */}
                  {syn.relations.length > 0 && (
                    <div className="rels-row">
                      {syn.relations.slice(0, 5).map((rel, ri) => (
                        <span key={ri} className="rel-chip">
                          <span className="rel-t">{REL_LABELS[rel.relType] || rel.relType}</span>
                          <span className="rel-a">→</span>
                          <span className="rel-v">{rel.target.replace("ben-syn", "#")}</span>
                        </span>
                      ))}
                      {syn.relations.length > 5 && (
                        <span className="rel-chip more">+{syn.relations.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {result.synsets.length > 1 && (
              <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
                {expanded ? "▲ Collapse" : `▼ Show all ${result.synsets.length} synsets`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ total, page, pageSize, onPage, onPageSize }: {
  total: number; page: number; pageSize: number;
  onPage: (p: number) => void; onPageSize: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pag-bar">
      {/* Reset */}
      <button className="pag-btn reset" title="Reset page size" onClick={() => { onPageSize(DEFAULT_PAGE_SIZE); onPage(1); }}>↺</button>

      {/* Page size */}
      <div className="pag-size">
        <span className="pag-label">Rows</span>
        <select className="pag-select" value={pageSize} onChange={(e) => { onPageSize(Number(e.target.value)); onPage(1); }}>
          {PAGE_SIZE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* First page */}
      <button className="pag-btn nav" disabled={page <= 1} onClick={() => onPage(1)} title="First page">«</button>
      {/* Prev */}
      <button className="pag-btn nav" disabled={page <= 1} onClick={() => onPage(page - 1)} title="Previous page">‹</button>

      {/* Indicator */}
      <span className="pag-info">
        <span className="pag-cur">{page}</span>
        <span className="pag-of">of</span>
        <span className="pag-tot">{totalPages}</span>
      </span>

      {/* Next */}
      <button className="pag-btn nav" disabled={page >= totalPages} onClick={() => onPage(page + 1)} title="Next page">›</button>
      {/* Last page */}
      <button className="pag-btn nav" disabled={page >= totalPages} onClick={() => onPage(totalPages)} title="Last page">»</button>

      <span className="pag-count">{total.toLocaleString()} results</span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="skel-wrap">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skel-card" style={{ animationDelay: `${i * 70}ms` }}>
          <div className="skel-line lg" /><div className="skel-line md" /><div className="skel-line sm" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [xmlLoaded, setXmlLoaded] = useState(false);
  const [xmlLoading, setXmlLoading] = useState(false);
  const [xmlError, setXmlError] = useState("");
  const [entries, setEntries] = useState<LexicalEntry[]>([]);
  const [synsetMap, setSynsetMap] = useState<Map<string, Synset>>(new Map());
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setXmlLoading(true);
    fetch("/ben.xml")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((text) => { const { entries: e, synsets: s } = parseXML(text); setEntries(e); setSynsetMap(s); setXmlLoaded(true); })
      .catch((err) => setXmlError(err.message))
      .finally(() => setXmlLoading(false));
  }, []);

  useEffect(() => {
    if (!query) { setDebouncedQuery(""); return; }
    setIsSearching(true);
    const t = setTimeout(() => { setDebouncedQuery(query); setPage(1); setIsSearching(false); }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const allResults = useMemo(() => searchEntries(debouncedQuery, entries, synsetMap), [debouncedQuery, entries, synsetMap]);
  const paginatedResults = useMemo(() => { const s = (page - 1) * pageSize; return allResults.slice(s, s + pageSize); }, [allResults, page, pageSize]);
  const handleClear = useCallback(() => { setQuery(""); setDebouncedQuery(""); setPage(1); inputRef.current?.focus(); }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          ${getThemeVars(theme)}
          --radius:12px; --radius-sm:8px; --radius-xs:5px;
          --font-display:'Cinzel',serif;
          --font-body:'Noto Sans Bengali',sans-serif;
          --font-mono:'JetBrains Mono',monospace;
          --transition:0.22s cubic-bezier(0.4,0,0.2,1);
        }

        html, body {
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-body);
          overflow-x: hidden;
          transition: background 0.3s, color 0.3s;
        }

        /* Subtle organic texture */
        body::before {
          content: '';
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 180px;
        }

        /* ── Layout ── */
        .pw { position: relative; min-height: 100vh; z-index: 1; }

        /* ── HEADER ── */
        .hdr {
          position: sticky; top: 0; z-index: 100;
          background: var(--header-bg); backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          padding: 0 clamp(16px,4vw,56px);
        }
        .hdr-inner {
          max-width: 1240px; margin: 0 auto;
          height: 66px; display: flex; align-items: center;
          justify-content: space-between; gap: 16px;
        }

        .logo { display: flex; align-items: center; gap: 11px; text-decoration: none; }
        .logo-gem {
          width: 42px; height: 42px; border-radius: 11px; flex-shrink: 0;
          background: linear-gradient(135deg, var(--olive) 0%, var(--sage) 100%);
          border: 1px solid var(--border2);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-body); font-size: 22px; font-weight: 700; color: var(--bg);
          box-shadow: 0 2px 14px var(--accent-glow);
          transition: transform var(--transition), box-shadow var(--transition);
        }
        .logo:hover .logo-gem { transform: scale(1.06); box-shadow: 0 4px 20px var(--accent-glow); }
        .logo-texts { display: flex; flex-direction: column; gap: 1px; }
        .logo-name {
          font-family: var(--font-display); font-size: 1.22rem; font-weight: 700;
          letter-spacing: 2px; color: var(--accent); line-height: 1;
        }
        .logo-sub {
          font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 2px;
          text-transform: uppercase; color: var(--text3);
          display: none;
        }
        @media(min-width:560px){ .logo-sub { display: block; } }

        .hdr-right { display: flex; align-items: center; gap: 12px; }

        .db-pill {
          display: none; align-items: center; gap: 7px;
          background: var(--accent-dim); border: 1px solid var(--border2);
          border-radius: 20px; padding: 5px 13px;
          font-family: var(--font-mono); font-size: 0.67rem; color: var(--text2);
        }
        @media(min-width:720px){ .db-pill { display: flex; } }
        .live-dot {
          width: 6px; height: 6px; border-radius: 50%; background: var(--sage);
          animation: livepulse 2.2s ease-in-out infinite;
        }
        @keyframes livepulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.8)} }

        /* Theme switcher */
        .theme-sw {
          display: flex; align-items: center; gap: 2px;
          background: var(--surface); border: 1px solid var(--border2);
          border-radius: 10px; padding: 3px;
        }
        .t-btn {
          padding: 5px 10px; border-radius: 7px; border: none; cursor: pointer;
          font-size: 0.7rem; font-family: var(--font-mono); letter-spacing: 0.3px;
          background: transparent; color: var(--text3);
          display: flex; align-items: center; gap: 5px;
          transition: all var(--transition); white-space: nowrap;
        }
        .t-btn.on { background: var(--accent); color: var(--bg); box-shadow: 0 1px 8px var(--accent-glow); }
        .t-btn:not(.on):hover { color: var(--accent); background: var(--accent-dim); }
        .t-lbl { display: none; }
        @media(min-width:600px){ .t-lbl { display: inline; } }

        /* ── HERO ── */
        .hero {
          max-width: 1240px; margin: 0 auto;
          padding: clamp(38px,7vw,90px) clamp(16px,4vw,56px) 32px;
        }

        .hero-eyebrow {
          font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 3.5px;
          text-transform: uppercase; color: var(--text3);
          margin-bottom: 14px; display: flex; align-items: center; gap: 10px;
        }
        .eyebrow-line { display: block; width: 32px; height: 1px; background: var(--accent2); }

        .hero-h1 {
          font-family: var(--font-display);
          font-size: clamp(2rem,5.5vw,3.9rem);
          font-weight: 700; line-height: 1.08; letter-spacing: 0.5px;
          color: var(--text); margin-bottom: 14px;
        }
        .hero-h1 .hi {
          color: var(--accent);
          text-shadow: 0 0 40px var(--accent-glow);
        }

        .hero-sub {
          color: var(--text2); font-size: clamp(0.84rem,1.8vw,0.97rem);
          line-height: 1.65; margin-bottom: clamp(28px,5vw,50px);
        }

        /* ── SEARCH ── */
        .s-wrap { max-width: 740px; }
        .s-box {
          display: flex; align-items: center; gap: 14px;
          background: var(--surface); border: 1.5px solid var(--border2);
          border-radius: var(--radius); padding: 15px 20px;
          box-shadow: var(--shadow);
          transition: border-color var(--transition), box-shadow var(--transition);
        }
        .s-box:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-glow), var(--shadow);
        }
        .s-ico { color: var(--text3); font-size: 18px; flex-shrink: 0; transition: color var(--transition); }
        .s-box:focus-within .s-ico { color: var(--accent); }
        .s-inp {
          flex: 1; background: none; border: none; outline: none;
          font-family: var(--font-body); font-size: 1.05rem;
          color: var(--text); caret-color: var(--accent);
        }
        .s-inp::placeholder { color: var(--text3); }
        .s-spin {
          width: 18px; height: 18px; flex-shrink: 0;
          border: 2px solid var(--border2); border-top-color: var(--accent);
          border-radius: 50%; animation: spin 0.65s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .s-clr {
          background: none; border: none; color: var(--text3); font-size: 15px;
          cursor: pointer; padding: 4px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          transition: all var(--transition); opacity: 0; pointer-events: none;
        }
        .s-clr.on { opacity: 1; pointer-events: all; }
        .s-clr:hover { color: var(--accent); background: var(--accent-dim); }

        .s-hints {
          display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px;
          font-family: var(--font-mono); font-size: 0.7rem; color: var(--text3);
        }

        /* ── RESULTS ── */
        .results-sec {
          max-width: 1240px; margin: 0 auto;
          padding: 0 clamp(16px,4vw,56px) 100px;
        }

        .res-hdr {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 8px;
          margin-bottom: 20px; padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
        }
        .res-count { font-family: var(--font-display); font-size: 0.93rem; color: var(--text2); }
        .res-count strong { color: var(--accent); }

        /* ── CARD ── */
        .result-card {
          position: relative;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); margin-bottom: 14px; overflow: hidden;
          animation: riseIn 0.36s ease both;
          transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition);
        }
        .result-card:hover {
          border-color: var(--border2);
          box-shadow: 0 6px 30px var(--accent-glow);
          transform: translateY(-2px);
        }
        @keyframes riseIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }

        .card-bar {
          position: absolute; top: 0; left: 0; bottom: 0; width: 3px;
          background: linear-gradient(180deg, var(--accent) 0%, var(--olive) 50%, var(--sage) 100%);
        }
        .card-body {
          padding: clamp(14px,2.5vw,22px) clamp(14px,2.5vw,22px) clamp(14px,2.5vw,22px) calc(clamp(14px,2.5vw,22px) + 13px);
        }

        .card-top { margin-bottom: 14px; }
        .card-title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
        .written-form {
          font-family: var(--font-body); font-size: clamp(1.3rem,3.5vw,1.9rem);
          font-weight: 700; color: var(--text); line-height: 1;
        }
        .pos-badge {
          font-family: var(--font-mono); font-size: 0.69rem;
          padding: 3px 10px; border-radius: 20px; border: 1px solid; font-weight: 500;
        }
        .pos-badge.sm { font-size: 0.61rem; padding: 2px 7px; }

        .meta-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .meta-pill {
          display: flex; align-items: center; gap: 5px;
          background: var(--bg3); border: 1px solid var(--border);
          border-radius: var(--radius-xs); padding: 2px 8px;
        }
        .meta-k { font-family: var(--font-mono); font-size: 0.58rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text3); }
        .meta-v { font-family: var(--font-mono); font-size: 0.69rem; color: var(--text2); }

        /* ── SYNSET BLOCK ── */
        .synsets-list { display: flex; flex-direction: column; gap: 10px; }
        .synset-block {
          background: var(--bg2); border: 1px solid var(--border);
          border-radius: var(--radius-sm); padding: 13px 15px; position: relative; overflow: hidden;
        }
        .synset-block::before {
          content: ''; position: absolute; top: 0; left: 16px; right: 16px; height: 1px;
          background: linear-gradient(90deg, transparent, var(--accent2), transparent);
          opacity: 0.22;
        }

        .syn-id-row {
          display: flex; align-items: flex-start; justify-content: space-between;
          flex-wrap: wrap; gap: 8px; margin-bottom: 10px;
        }
        .chip-group { display: flex; flex-wrap: wrap; gap: 5px; }
        .chip {
          font-family: var(--font-mono); font-size: 0.64rem;
          padding: 2px 7px; border-radius: var(--radius-xs);
          display: inline-flex; align-items: center; gap: 3px;
        }
        .chip-syn { background: rgba(87,97,57,0.15); color: var(--accent); border: 1px solid rgba(143,168,90,0.25); }
        .chip-sen { background: rgba(139,109,56,0.15); color: var(--gold);   border: 1px solid rgba(200,168,74,0.25); }
        .chip-ili { background: rgba(67,87,57,0.15);   color: var(--sage);   border: 1px solid rgba(106,136,84,0.25); }

        .syn-badges { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
        .lex-badge {
          font-family: var(--font-mono); font-size: 0.59rem;
          padding: 2px 7px; border-radius: 20px;
          background: rgba(200,168,74,0.12); color: var(--gold);
          border: 1px solid rgba(200,168,74,0.28);
        }

        .def-block {
          display: flex; gap: 8px; align-items: flex-start;
          background: var(--bg3); border-left: 3px solid var(--accent2);
          border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
          padding: 10px 12px; margin-bottom: 10px;
        }
        .def-q { font-size: 2rem; line-height: 1; color: var(--accent); opacity: 0.35; font-family: Georgia,serif; flex-shrink: 0; margin-top: -5px; }
        .def-text { font-size: 0.86rem; color: var(--text2); line-height: 1.65; font-style: italic; }

        .rels-row { display: flex; flex-wrap: wrap; gap: 5px; }
        .rel-chip {
          font-family: var(--font-mono); font-size: 0.62rem;
          padding: 3px 8px; border-radius: var(--radius-xs);
          background: var(--surface2); border: 1px solid var(--border2);
          display: inline-flex; align-items: center; gap: 4px;
        }
        .rel-t { color: var(--text3); text-transform: uppercase; font-size: 0.56rem; letter-spacing: 0.5px; }
        .rel-a { color: var(--border2); }
        .rel-v { color: var(--text2); }
        .rel-chip.more { color: var(--text3); font-style: italic; }

        .expand-btn {
          background: none; border: 1px dashed var(--border2);
          border-radius: var(--radius-sm); color: var(--accent);
          font-size: 0.76rem; padding: 8px; cursor: pointer; width: 100%;
          font-family: var(--font-mono); transition: all var(--transition); margin-top: 4px;
        }
        .expand-btn:hover { background: var(--accent-dim); border-color: var(--accent); }

        /* ── STATE BOXES ── */
        .state-box { text-align: center; padding: 72px 24px; }
        .state-glyph { font-size: 3.5rem; opacity: 0.35; margin-bottom: 16px; }
        .state-title { font-family: var(--font-display); font-size: 1.2rem; font-weight: 600; color: var(--text2); margin-bottom: 10px; }
        .state-body { font-size: 0.86rem; color: var(--text3); line-height: 1.7; }

        /* ── SKELETON ── */
        .skel-wrap { display: flex; flex-direction: column; gap: 14px; }
        .skel-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 22px 24px;
          animation: fadeIn 0.3s ease both;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .skel-line {
          height: 11px; border-radius: 6px; margin-bottom: 10px;
          background: linear-gradient(90deg, var(--surface2) 25%, var(--bg3) 50%, var(--surface2) 75%);
          background-size: 200% 100%; animation: shimmer 1.6s infinite;
        }
        .skel-line.lg { height: 22px; width: 50%; }
        .skel-line.md { width: 35%; }
        .skel-line.sm { width: 20%; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        /* ── PAGINATION ── */
        .pag-bar {
          display: flex; align-items: center; justify-content: center;
          flex-wrap: wrap; gap: 10px; margin-top: 28px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 14px 20px;
        }
        .pag-btn {
          width: 36px; height: 36px; border-radius: var(--radius-sm);
          border: 1px solid var(--border2); background: var(--surface2);
          color: var(--text); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all var(--transition);
        }
        .pag-btn.nav { font-size: 1.5rem; font-weight: 300; }
        .pag-btn.reset { font-size: 1.2rem; }
        .pag-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
        .pag-btn:disabled { opacity: 0.25; cursor: not-allowed; }

        .pag-size { display: flex; align-items: center; gap: 6px; }
        .pag-label { font-family: var(--font-mono); font-size: 0.63rem; color: var(--text3); text-transform: uppercase; letter-spacing: 1px; }
        .pag-select {
          background: var(--surface2); border: 1px solid var(--border2); border-radius: var(--radius-sm);
          color: var(--text); font-family: var(--font-mono); font-size: 0.8rem;
          padding: 6px 10px; cursor: pointer; outline: none; transition: all var(--transition);
        }
        .pag-select:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }

        .pag-info { display: flex; align-items: center; gap: 5px; font-family: var(--font-display); font-size: 0.9rem; }
        .pag-cur  { color: var(--accent); font-size: 1.1rem; font-weight: 700; }
        .pag-of   { color: var(--text3); font-size: 0.72rem; }
        .pag-tot  { color: var(--text2); font-weight: 600; }
        .pag-count {
          font-family: var(--font-mono); font-size: 0.67rem; color: var(--text3);
          padding: 3px 9px; background: var(--bg3); border: 1px solid var(--border);
          border-radius: 20px;
        }

        /* ── XML LOADING ── */
        .xml-overlay {
          position: fixed; inset: 0; background: var(--bg);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 20px; z-index: 9999;
        }
        .xml-logo-wrap { position: relative; width: 90px; height: 90px; display: flex; align-items: center; justify-content: center; }
        .xml-gem {
          width: 72px; height: 72px; border-radius: 18px;
          background: linear-gradient(135deg, var(--olive), var(--sage));
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-body); font-size: 36px; font-weight: 700; color: var(--bg);
          box-shadow: 0 0 40px var(--accent-glow);
        }
        .xml-ring {
          position: absolute; inset: 0;
          border: 2px solid var(--border2); border-top-color: var(--accent);
          border-right-color: var(--sage);
          border-radius: 50%; animation: spin 1.3s linear infinite;
        }
        .xml-title { font-family: var(--font-display); font-size: 1.3rem; color: var(--text2); letter-spacing: 3px; }
        .xml-prog { width: 200px; height: 2px; background: var(--border2); border-radius: 2px; overflow: hidden; }
        .xml-prog-bar {
          height: 100%; width: 45%;
          background: linear-gradient(90deg, var(--accent2), var(--accent));
          border-radius: 2px;
          animation: sweep 1.5s ease-in-out infinite;
        }
        @keyframes sweep {
          0%   { margin-left:-45%; width:45%; }
          50%  { margin-left:55%; width:45%; }
          100% { margin-left:100%; width:45%; }
        }
        .xml-sub { font-family: var(--font-mono); font-size: 0.7rem; color: var(--text3); letter-spacing: 1.5px; animation: blink 1.8s ease-in-out infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }

        /* ── ERROR ── */
        .err-bar {
          background: rgba(184,112,64,0.1); border: 1px solid rgba(184,112,64,0.3);
          color: var(--rust); padding: 10px 16px; border-radius: var(--radius-sm);
          font-family: var(--font-mono); font-size: 0.78rem; margin-bottom: 16px;
        }

        /* ── FOOTER ── */
        .site-footer {
          position: fixed; bottom: 0; left: 0; right: 0;
          border-top: 1px solid var(--border); background: var(--footer-bg);
          backdrop-filter: blur(12px); padding: 9px clamp(16px,4vw,56px);
          display: flex; align-items: center; justify-content: center;
          gap: 18px; font-family: var(--font-mono); font-size: 0.67rem;
          color: var(--text3); z-index: 50;
        }
        .fdot { opacity: 0.3; }
        .f-accent { color: var(--accent); font-weight: 600; }

        @media(max-width:480px){
          .pag-bar { gap: 7px; padding: 11px; }
          .pag-select { padding: 5px 7px; }
        }
      `}</style>

      <div className="pw">
        {/* XML Loading */}
        {xmlLoading && (
          <div className="xml-overlay">
            <div className="xml-logo-wrap">
              <div className="xml-gem">শ</div>
              <div className="xml-ring" />
            </div>
            <div className="xml-title">ShobdoNet</div>
            <div className="xml-prog"><div className="xml-prog-bar" /></div>
            <div className="xml-sub">Loading Bengali Lexicon…</div>
          </div>
        )}

        {/* ── HEADER ── */}
        <header className="hdr">
          <div className="hdr-inner">
            <a className="logo" href="#">
              <div className="logo-gem">শ</div>
              <div className="logo-texts">
                <span className="logo-name">ShobdoNet</span>
                <span className="logo-sub">Bengali · Lexical · Search</span>
              </div>
            </a>
            <div className="hdr-right">
              {xmlLoaded && (
                <div className="db-pill">
                  <span className="live-dot" />
                  {entries.length.toLocaleString()} entries &nbsp;·&nbsp; {synsetMap.size.toLocaleString()} synsets
                </div>
              )}
              <div className="theme-sw">
                {THEMES.map((t) => (
                  <button key={t.id} className={`t-btn ${theme === t.id ? "on" : ""}`} onClick={() => setTheme(t.id)} title={t.label}>
                    {t.icon} <span className="t-lbl">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* ── HERO ── */}
        <section className="hero">
          <div className="hero-eyebrow">
            <span className="eyebrow-line" />
            Bengali WordNet Search
          </div>
          <h1 className="hero-h1">
            খুঁজুন <span className="hi">বাংলা শব্দ</span><br />
            Find Bengali Words
          </h1>
          <p className="hero-sub">
            Real-time search across {entries.length > 0 ? entries.length.toLocaleString() : "…"} lexical entries
            {" "}and {synsetMap.size > 0 ? synsetMap.size.toLocaleString() : "…"} synsets from the UKC Bengali WordNet.
          </p>

          {xmlError && <div className="err-bar">⚠ Failed to load XML: {xmlError} — Place ben.xml in /public/</div>}

          <div className="s-wrap">
            <div className="s-box">
              <span className="s-ico">⌕</span>
              <input
                ref={inputRef}
                className="s-inp"
                type="text"
                placeholder="বাংলা শব্দ লিখুন… (e.g. নিরাপদ, গঙ্গরা)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              {isSearching && <div className="s-spin" />}
              <button className={`s-clr ${query ? "on" : ""}`} onClick={handleClear} title="Clear">✕</button>
            </div>
            <div className="s-hints">
              <span>⚡ Real-time</span>
              <span>📚 WordNet</span>
              <span>🔗 Synset-linked</span>
              <span>📖 Definitions</span>
            </div>
          </div>
        </section>

        {/* ── RESULTS ── */}
        <section className="results-sec">
          {isSearching ? (
            <LoadingSkeleton />
          ) : debouncedQuery && allResults.length === 0 ? (
            <div className="state-box">
              <div className="state-glyph">🔎</div>
              <div className="state-title">No Results Found</div>
              <div className="state-body">
                No entries match &ldquo;<strong>{debouncedQuery}</strong>&rdquo; in the Bengali lexicon.<br />
                Try a different spelling or a related word.
              </div>
            </div>
          ) : debouncedQuery && allResults.length > 0 ? (
            <>
              <div className="res-hdr">
                <div className="res-count">
                  Found <strong>{allResults.length.toLocaleString()}</strong> results for &ldquo;{debouncedQuery}&rdquo;
                </div>
              </div>
              {paginatedResults.map((result, i) => (
                <ResultCard key={result.entry.id} result={result} index={i} />
              ))}
              <Pagination
                total={allResults.length}
                page={page}
                pageSize={pageSize}
                onPage={setPage}
                onPageSize={(s) => { setPageSize(s); setPage(1); }}
              />
            </>
          ) : !xmlLoading ? (
            <div className="state-box">
              <div className="state-glyph">📖</div>
              <div className="state-title">Start Searching</div>
              <div className="state-body">
                Type any Bengali word in the search bar above to explore<br />
                synsets, definitions, and lexical relationships.
              </div>
            </div>
          ) : null}
        </section>

        {/* ── FOOTER ── */}
        <footer className="site-footer">
          <span className="f-accent">ShobdoNet</span>
          <span className="fdot">·</span>
          <span>Bengali WordNet</span>
          <span className="fdot">·</span>
          <span>UKC Lexicon v1.0</span>
        </footer>
      </div>
    </>
  );
}