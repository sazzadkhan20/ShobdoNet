"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Sense { id: string; synset: string; }
interface LexicalEntry { id: string; writtenForm: string; partOfSpeech: string; senses: Sense[]; }
interface SynsetRelation { relType: string; target: string; }
interface Synset { id: string; ili: string; partOfSpeech: string; lexicalized: string; definition: string; relations: SynsetRelation[]; }
interface SearchResult { entry: LexicalEntry; synsets: Synset[]; }

// ─── Bengali alphabet keys (only for nav grouping, not for adding fake words) ─
const VOWELS    = ["অ","আ","ই","ঈ","উ","ঊ","ঋ","এ","ঐ","ও","ঔ"];
const CONSONANTS = ["ক","খ","গ","ঘ","ঙ","চ","ছ","জ","ঝ","ঞ","ট","ঠ","ড","ঢ","ণ","ত","থ","দ","ধ","ন","প","ফ","ব","ভ","ম","য","র","ল","শ","ষ","স","হ","ড়","ঢ়","য়","ৎ","ং","ঃ","ঁ"];
const ENG_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// ─── Constants ────────────────────────────────────────────────────────────────
const POS_LABELS: Record<string,string> = { n:"Noun", v:"Verb", a:"Adjective", r:"Adverb", s:"Adj. Satellite" };
const POS_COLORS: Record<string,{bg:string;text:string;border:string}> = {
  n:{bg:"rgba(87,97,57,0.18)",  text:"#a8b878",border:"rgba(168,184,120,0.35)"},
  v:{bg:"rgba(139,109,56,0.18)",text:"#d4a85a",border:"rgba(212,168,90,0.35)"},
  a:{bg:"rgba(107,87,57,0.18)", text:"#c49a6c",border:"rgba(196,154,108,0.35)"},
  r:{bg:"rgba(67,87,57,0.18)",  text:"#8db870",border:"rgba(141,184,112,0.35)"},
  s:{bg:"rgba(97,117,67,0.18)", text:"#b8cc88",border:"rgba(184,204,136,0.35)"},
};
const REL_LABELS: Record<string,string> = {
  hypernym:"Hypernym",hyponym:"Hyponym",mero_member:"Member Meronym",
  mero_part:"Part Meronym",mero_substance:"Substance Meronym",
  holo_member:"Member Holonym",holo_part:"Part Holonym",
  holo_substance:"Substance Holonym",antonym:"Antonym",similar:"Similar",
  also:"See Also",attribute:"Attribute",cause:"Cause",entail:"Entails",
  domain_topic:"Domain Topic",domain_region:"Domain Region",exemplifies:"Exemplifies",
};

const WORD_PAGE_DEFAULT  = 15;
const WORD_PAGE_OPTIONS  = [15,20,30,50];
const DICT_PAGE_DEFAULT  = 50;
const DICT_PAGE_OPTIONS  = [50,100,200,250];

type ThemeMode = "dark"|"forest"|"light";
const THEMES: {id:ThemeMode;label:string;icon:string}[] = [
  {id:"dark",  label:"Dark",  icon:"🌑"},
  {id:"forest",label:"Forest",icon:"🌿"},
  {id:"light", label:"Light", icon:"☀️"},
];
type TabId = "word"|"synset"|"dictionary";

// ─── Theme ────────────────────────────────────────────────────────────────────
function TV(mode:ThemeMode):string{
  if(mode==="dark")  return`--bg:#0f110c;--bg2:#151810;--bg3:#1a1e13;--surface:#1e2317;--surface2:#232a1b;--border:#2a3320;--border2:#33401f;--accent:#8fa85a;--accent2:#6b7e3e;--accent-glow:rgba(143,168,90,0.13);--accent-dim:rgba(143,168,90,0.06);--text:#e8ead0;--text2:#a8aa88;--text3:#606848;--olive:#576139;--gold:#c8a84a;--rust:#b87040;--sage:#6a8854;--shadow:0 4px 24px rgba(0,0,0,0.55);--shadow-lg:0 8px 48px rgba(0,0,0,0.7);--header-bg:rgba(15,17,12,0.88);--footer-bg:rgba(15,17,12,0.93);`;
  if(mode==="forest")return`--bg:#192210;--bg2:#1f2914;--bg3:#243018;--surface:#2a381c;--surface2:#304020;--border:#3a5028;--border2:#446030;--accent:#a8c870;--accent2:#88a850;--accent-glow:rgba(168,200,112,0.15);--accent-dim:rgba(168,200,112,0.07);--text:#e0ecc8;--text2:#aac080;--text3:#708858;--olive:#78a050;--gold:#d8b858;--rust:#c88040;--sage:#88b868;--shadow:0 4px 24px rgba(0,0,0,0.42);--shadow-lg:0 8px 48px rgba(0,0,0,0.6);--header-bg:rgba(25,34,16,0.90);--footer-bg:rgba(25,34,16,0.95);`;
  return`--bg:#f4f3ec;--bg2:#eeede3;--bg3:#e5e4d6;--surface:#ffffff;--surface2:#f8f7ef;--border:#d2d0bc;--border2:#c0be9e;--accent:#576139;--accent2:#3e4828;--accent-glow:rgba(87,97,57,0.10);--accent-dim:rgba(87,97,57,0.05);--text:#1c1e0e;--text2:#484e2e;--text3:#848870;--olive:#576139;--gold:#886620;--rust:#884820;--sage:#486830;--shadow:0 4px 24px rgba(0,0,0,0.07);--shadow-lg:0 8px 48px rgba(0,0,0,0.10);--header-bg:rgba(244,243,236,0.90);--footer-bg:rgba(244,243,236,0.96);`;
}

// ─── XML Parser ───────────────────────────────────────────────────────────────
function parseXML(xml:string):{entries:LexicalEntry[];synsets:Map<string,Synset>}{
  const doc = new DOMParser().parseFromString(xml,"text/xml");
  const entries:LexicalEntry[] = [];
  const synsets = new Map<string,Synset>();
  doc.querySelectorAll("LexicalEntry").forEach(el=>{
    const lemma = el.querySelector("Lemma");
    if(!lemma) return;
    const senses:Sense[] = [];
    el.querySelectorAll("Sense").forEach(s=>senses.push({id:s.getAttribute("id")||"",synset:s.getAttribute("synset")||""}));
    entries.push({id:el.getAttribute("id")||"",writtenForm:lemma.getAttribute("writtenForm")||"",partOfSpeech:lemma.getAttribute("partOfSpeech")||"",senses});
  });
  doc.querySelectorAll("Synset").forEach(el=>{
    const def = el.querySelector("Definition");
    const relations:SynsetRelation[] = [];
    el.querySelectorAll("SynsetRelation").forEach(r=>relations.push({relType:r.getAttribute("relType")||"",target:r.getAttribute("target")||""}));
    const id = el.getAttribute("id")||"";
    synsets.set(id,{id,ili:el.getAttribute("ili")||"",partOfSpeech:el.getAttribute("partOfSpeech")||"",lexicalized:el.getAttribute("lexicalized")||"",definition:def?.textContent||"",relations});
  });
  return{entries,synsets};
}

// ─── Search: word (Bengali + English definition) ──────────────────────────────
function searchEntries(q:string,entries:LexicalEntry[],synsetMap:Map<string,Synset>):SearchResult[]{
  if(!q.trim()) return [];
  const lq = q.trim().toLowerCase();
  const results:SearchResult[] = [];
  entries.forEach(entry=>{
    const wordMatch = entry.writtenForm.toLowerCase().includes(lq);
    // Also check English definitions in synsets
    const defMatch = !wordMatch && entry.senses.some(s=>{
      const syn = synsetMap.get(s.synset);
      return syn && syn.definition.toLowerCase().includes(lq);
    });
    if(wordMatch || defMatch){
      const synsets:Synset[] = [];
      entry.senses.forEach(s=>{const syn=synsetMap.get(s.synset);if(syn)synsets.push(syn);});
      results.push({entry,synsets});
    }
  });
  return results;
}

// ─── Search: synset ───────────────────────────────────────────────────────────
function searchSynset(q:string,synsetMap:Map<string,Synset>,entries:LexicalEntry[]):{synset:Synset;words:LexicalEntry[]}|null{
  if(!q.trim()) return null;
  const lq = q.trim().toLowerCase().replace(/^ben-/,"");
  let found:Synset|null = null;
  synsetMap.forEach((syn,id)=>{
    if(found) return;
    const norm = id.toLowerCase();
    if(norm===`ben-${lq}` || norm.includes(lq) || id.toLowerCase()===q.trim().toLowerCase()) found=syn;
  });
  if(!found) return null;
  const sid = (found as Synset).id;
  return{synset:found as Synset,words:entries.filter(e=>e.senses.some(s=>s.synset===sid))};
}

// ─── Shared Pagination ────────────────────────────────────────────────────────
function Pagination({total,page,pageSize,onPage,onPageSize,options,defaultSize}:{
  total:number;page:number;pageSize:number;
  onPage:(p:number)=>void;onPageSize:(s:number)=>void;
  options:number[];defaultSize:number;
}){
  const tp = Math.max(1,Math.ceil(total/pageSize));
  return(
    <div className="pag-bar">
      <button className="pag-btn reset" title="Reset" onClick={()=>{onPageSize(defaultSize);onPage(1);}}>↺</button>
      <div className="pag-size">
        <span className="pag-label">Rows</span>
        <select className="pag-select" value={pageSize} onChange={e=>{onPageSize(Number(e.target.value));onPage(1);}}>
          {options.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <button className="pag-btn nav" disabled={page<=1} onClick={()=>onPage(1)} title="First">«</button>
      <button className="pag-btn nav" disabled={page<=1} onClick={()=>onPage(page-1)} title="Prev">‹</button>
      <span className="pag-info">
        <span className="pag-cur">{page}</span>
        <span className="pag-of">of</span>
        <span className="pag-tot">{tp}</span>
      </span>
      <button className="pag-btn nav" disabled={page>=tp} onClick={()=>onPage(page+1)} title="Next">›</button>
      <button className="pag-btn nav" disabled={page>=tp} onClick={()=>onPage(tp)} title="Last">»</button>
      <span className="pag-count">{total.toLocaleString()} items</span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skel(){
  return(
    <div className="skel-wrap">
      {[...Array(4)].map((_,i)=>(
        <div key={i} className="skel-card" style={{animationDelay:`${i*60}ms`}}>
          <div className="skel-line lg"/><div className="skel-line md"/><div className="skel-line sm"/>
        </div>
      ))}
    </div>
  );
}

// ─── Synset Detail Panel ──────────────────────────────────────────────────────
function SynsetPanel({synset,words,synsetMap,onSynsetClick,onWordClick}:{
  synset:Synset;words:LexicalEntry[];synsetMap:Map<string,Synset>;
  onSynsetClick:(id:string)=>void;onWordClick:(w:string)=>void;
}){
  const sp = POS_COLORS[synset.partOfSpeech]||POS_COLORS["n"];
  return(
    <div className="synset-panel">
      <div className="sp-head">
        <div className="sp-id-row">
          <span className="chip chip-syn">⬡ {synset.id}</span>
          {synset.ili&&<span className="chip chip-ili">⊕ {synset.ili}</span>}
          <span className="pos-badge" style={{background:sp.bg,color:sp.text,borderColor:sp.border}}>{POS_LABELS[synset.partOfSpeech]||synset.partOfSpeech}</span>
          {synset.lexicalized==="true"&&<span className="lex-badge">Lexicalized</span>}
        </div>
      </div>
      {synset.definition&&(
        <div className="def-block">
          <span className="def-q">"</span>
          <p className="def-text">{synset.definition}</p>
        </div>
      )}
      {words.length>0&&(
        <div className="sp-section">
          <div className="sp-sec-label">Connected Words ({words.length})</div>
          <div className="sp-words">
            {words.map(w=>{
              const wp=POS_COLORS[w.partOfSpeech]||POS_COLORS["n"];
              return(
                <button key={w.id} className="word-chip" onClick={()=>onWordClick(w.writtenForm)}>
                  {w.writtenForm}
                  <span className="pos-badge sm" style={{background:wp.bg,color:wp.text,borderColor:wp.border}}>{POS_LABELS[w.partOfSpeech]||w.partOfSpeech}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {synset.relations.length>0&&(
        <div className="sp-section">
          <div className="sp-sec-label">Relations ({synset.relations.length})</div>
          <div className="rels-row">
            {synset.relations.map((rel,ri)=>{
              const rs=synsetMap.get(rel.target);
              return(
                <button key={ri} className="rel-chip clickable" onClick={()=>onSynsetClick(rel.target)} title={rs?.definition||rel.target}>
                  <span className="rel-t">{REL_LABELS[rel.relType]||rel.relType}</span>
                  <span className="rel-a">→</span>
                  <span className="rel-v">{rel.target.replace("ben-syn","#")}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Word Result Card ─────────────────────────────────────────────────────────
function ResultCard({result,index,onSynsetClick,entries,synsetMap,searchQuery}:{
  result:SearchResult;index:number;searchQuery:string;
  onSynsetClick:(id:string)=>void;entries:LexicalEntry[];synsetMap:Map<string,Synset>;
}){
  const[expanded,setExpanded]=useState(false);
  const ps=POS_COLORS[result.entry.partOfSpeech]||POS_COLORS["n"];
  // Highlight if matched via English definition
  const isEngMatch = result.entry.writtenForm.toLowerCase().includes(searchQuery.toLowerCase())===false && searchQuery.trim().length>0;
  return(
    <div className="result-card" style={{animationDelay:`${index*40}ms`}}>
      <div className="card-bar"/>
      <div className="card-body">
        <div className="card-top">
          <div className="card-title-row">
            <span className="written-form">{result.entry.writtenForm}</span>
            <span className="pos-badge" style={{background:ps.bg,color:ps.text,borderColor:ps.border}}>{POS_LABELS[result.entry.partOfSpeech]||result.entry.partOfSpeech}</span>
            {isEngMatch&&<span className="eng-match-badge">matched via definition</span>}
          </div>
          <div className="meta-row">
            <span className="meta-pill"><span className="meta-k">Entry</span><span className="meta-v">{result.entry.id}</span></span>
            <span className="meta-pill"><span className="meta-k">Senses</span><span className="meta-v">{result.entry.senses.length}</span></span>
          </div>
        </div>
        {result.synsets.length>0&&(
          <div className="synsets-list">
            {result.synsets.slice(0,expanded?undefined:1).map(syn=>{
              const sense=result.entry.senses.find(s=>s.synset===syn.id);
              const sp2=POS_COLORS[syn.partOfSpeech]||POS_COLORS["n"];
              const siblings=entries.filter(e=>e.id!==result.entry.id&&e.senses.some(s=>s.synset===syn.id));
              return(
                <div key={syn.id} className="synset-block">
                  <div className="syn-id-row">
                    <div className="chip-group">
                      <button className="chip chip-syn clickable-chip" onClick={()=>onSynsetClick(syn.id)} title="Explore this synset">⬡ {syn.id} <span className="chip-go">↗</span></button>
                      {sense&&<span className="chip chip-sen">◈ {sense.id}</span>}
                      {syn.ili&&<span className="chip chip-ili">⊕ {syn.ili}</span>}
                    </div>
                    <div className="syn-badges">
                      <span className="pos-badge sm" style={{background:sp2.bg,color:sp2.text,borderColor:sp2.border}}>{POS_LABELS[syn.partOfSpeech]||syn.partOfSpeech}</span>
                      {syn.lexicalized==="true"&&<span className="lex-badge">Lexicalized</span>}
                    </div>
                  </div>
                  {syn.definition&&(
                    <div className="def-block">
                      <span className="def-q">"</span>
                      <p className="def-text">{syn.definition}</p>
                    </div>
                  )}
                  {siblings.length>0&&(
                    <div className="siblings-row">
                      <span className="sib-label">Also in synset:</span>
                      {siblings.slice(0,6).map(w=><span key={w.id} className="sib-chip">{w.writtenForm}</span>)}
                      {siblings.length>6&&<span className="sib-chip more">+{siblings.length-6}</span>}
                    </div>
                  )}
                  {syn.relations.length>0&&(
                    <div className="rels-row">
                      {syn.relations.slice(0,5).map((rel,ri)=>(
                        <button key={ri} className="rel-chip clickable" onClick={()=>onSynsetClick(rel.target)}>
                          <span className="rel-t">{REL_LABELS[rel.relType]||rel.relType}</span>
                          <span className="rel-a">→</span>
                          <span className="rel-v">{rel.target.replace("ben-syn","#")}</span>
                        </button>
                      ))}
                      {syn.relations.length>5&&<span className="rel-chip more">+{syn.relations.length-5}</span>}
                    </div>
                  )}
                </div>
              );
            })}
            {result.synsets.length>1&&(
              <button className="expand-btn" onClick={()=>setExpanded(!expanded)}>
                {expanded?"▲ Collapse":`▼ Show all ${result.synsets.length} synsets`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DICTIONARY BROWSER (paginated, XML words only) ───────────────────────────
function DictionaryBrowser({entries,synsetMap,onWordClick,onSynsetClick}:{
  entries:LexicalEntry[];synsetMap:Map<string,Synset>;
  onWordClick:(w:string)=>void;onSynsetClick:(id:string)=>void;
}){
  const[activeLetter,setActiveLetter]=useState<string|null>(null);
  const[page,setPage]=useState(1);
  const[pageSize,setPageSize]=useState(DICT_PAGE_DEFAULT);
  const[expandedId,setExpandedId]=useState<string|null>(null);
  const contentRef=useRef<HTMLDivElement>(null);

  // Sort ALL entries once
  const sortedEntries=useMemo(()=>[...entries].sort((a,b)=>a.writtenForm.localeCompare(b.writtenForm,"bn")),[entries]);

  // Group by first character (only characters that exist in XML)
  const grouped=useMemo(()=>{
    const map=new Map<string,LexicalEntry[]>();
    sortedEntries.forEach(e=>{
      if(!e.writtenForm) return;
      const k=e.writtenForm[0];
      if(!map.has(k)) map.set(k,[]);
      map.get(k)!.push(e);
    });
    return map;
  },[sortedEntries]);

  // All letters that actually have words in XML
  const allLetterOrder=[...VOWELS,...CONSONANTS,...ENG_LETTERS];
  const activeLetters=useMemo(()=>allLetterOrder.filter(l=>grouped.has(l)),[grouped]);
  // Letters not in the predefined lists but exist in data
  const extraLetters=useMemo(()=>[...grouped.keys()].filter(k=>!allLetterOrder.includes(k)).sort(),[grouped]);
  const displayLetters=useMemo(()=>[...activeLetters,...extraLetters],[activeLetters,extraLetters]);

  // Filter entries by active letter, or all if none selected
  const filteredEntries=useMemo(()=>
    activeLetter ? (grouped.get(activeLetter)||[]) : sortedEntries
  ,[activeLetter,grouped,sortedEntries]);

  const totalPages=Math.max(1,Math.ceil(filteredEntries.length/pageSize));
  const pageEntries=useMemo(()=>{
    const s=(page-1)*pageSize;
    return filteredEntries.slice(s,s+pageSize);
  },[filteredEntries,page,pageSize]);

  const selectLetter=(l:string|null)=>{
    setActiveLetter(l);
    setPage(1);
    setExpandedId(null);
    contentRef.current?.scrollIntoView({behavior:"smooth",block:"start"});
  };

  return(
    <div className="dict-wrapper">
      {/* Alphabet Nav */}
      <div className="dict-nav">
        <div className="dict-nav-inner">
          <div className="alpha-sec">
            <span className="alpha-lbl">স্বরবর্ণ</span>
            <div className="alpha-grp">
              {VOWELS.map(l=>(
                <button key={l} className={`al-btn ${grouped.has(l)?"has":"no"} ${activeLetter===l?"act":""}`}
                  onClick={()=>grouped.has(l)&&selectLetter(l)} disabled={!grouped.has(l)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="alpha-sec">
            <span className="alpha-lbl">ব্যঞ্জনবর্ণ</span>
            <div className="alpha-grp">
              {CONSONANTS.map(l=>(
                <button key={l} className={`al-btn ${grouped.has(l)?"has":"no"} ${activeLetter===l?"act":""}`}
                  onClick={()=>grouped.has(l)&&selectLetter(l)} disabled={!grouped.has(l)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="alpha-sec">
            <span className="alpha-lbl">English</span>
            <div className="alpha-grp">
              {ENG_LETTERS.map(l=>(
                <button key={l} className={`al-btn eng ${grouped.has(l)?"has":"no"} ${activeLetter===l?"act":""}`}
                  onClick={()=>grouped.has(l)&&selectLetter(l)} disabled={!grouped.has(l)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="dict-nav-footer">
            <button className={`al-all-btn ${activeLetter===null?"act":""}`} onClick={()=>selectLetter(null)}>
              All Letters
            </button>
            <span className="dict-stats">
              {displayLetters.length} letters with data &nbsp;·&nbsp; {entries.length.toLocaleString()} total words
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="dict-content">
        {/* Current filter heading */}
        <div className="dict-content-hdr">
          {activeLetter?(
            <div className="dict-cur-letter">
              <span className="dict-cur-glyph">{activeLetter}</span>
              <div>
                <div className="dict-cur-count">{filteredEntries.length.toLocaleString()} words starting with "{activeLetter}"</div>
                <div className="dict-cur-page">Showing {(page-1)*pageSize+1}–{Math.min(page*pageSize,filteredEntries.length)} of {filteredEntries.length}</div>
              </div>
            </div>
          ):(
            <div className="dict-cur-letter">
              <span className="dict-cur-glyph" style={{fontSize:"1.4rem"}}>A–ঔ</span>
              <div>
                <div className="dict-cur-count">All {entries.length.toLocaleString()} words</div>
                <div className="dict-cur-page">Showing {(page-1)*pageSize+1}–{Math.min(page*pageSize,filteredEntries.length)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Word list */}
        <div className="dict-list">
          {pageEntries.map((entry,i)=>{
            const isOpen=expandedId===entry.id;
            const ep=POS_COLORS[entry.partOfSpeech]||POS_COLORS["n"];
            return(
              <div key={entry.id} className={`dw-card ${isOpen?"open":""}`}>
                <button className="dw-btn" onClick={()=>setExpandedId(isOpen?null:entry.id)}>
                  <span className="dw-index">{(page-1)*pageSize+i+1}</span>
                  <span className="dw-word">{entry.writtenForm}</span>
                  <span className="pos-badge sm" style={{background:ep.bg,color:ep.text,borderColor:ep.border}}>{POS_LABELS[entry.partOfSpeech]||entry.partOfSpeech}</span>
                  <span className="dw-senses">{entry.senses.length} sense{entry.senses.length!==1?"s":""}</span>
                  <span className="dw-arrow">{isOpen?"▲":"▼"}</span>
                </button>
                {isOpen&&(
                  <div className="dw-detail">
                    <div className="dw-actions">
                      <button className="dw-action" onClick={()=>onWordClick(entry.writtenForm)}>
                        🔍 Search this word
                      </button>
                    </div>
                    {entry.senses.map(sense=>{
                      const syn=synsetMap.get(sense.synset);
                      if(!syn) return null;
                      const sp2=POS_COLORS[syn.partOfSpeech]||POS_COLORS["n"];
                      const siblings=entries.filter(e=>e.id!==entry.id&&e.senses.some(s=>s.synset===syn.id));
                      return(
                        <div key={sense.id} className="dw-synset">
                          <div className="dw-syn-ids">
                            <button className="chip chip-syn clickable-chip" onClick={()=>onSynsetClick(syn.id)}>
                              ⬡ {syn.id} <span className="chip-go">↗</span>
                            </button>
                            <span className="chip chip-sen">◈ {sense.id}</span>
                            {syn.ili&&<span className="chip chip-ili">⊕ {syn.ili}</span>}
                            <span className="pos-badge sm" style={{background:sp2.bg,color:sp2.text,borderColor:sp2.border}}>{POS_LABELS[syn.partOfSpeech]||syn.partOfSpeech}</span>
                            {syn.lexicalized==="true"&&<span className="lex-badge">Lexicalized</span>}
                          </div>
                          {syn.definition&&(
                            <div className="def-block" style={{margin:"8px 0"}}>
                              <span className="def-q">"</span>
                              <p className="def-text">{syn.definition}</p>
                            </div>
                          )}
                          {siblings.length>0&&(
                            <div className="siblings-row">
                              <span className="sib-label">Also in synset:</span>
                              {siblings.slice(0,5).map(w=>(
                                <button key={w.id} className="sib-chip clickable" onClick={()=>onWordClick(w.writtenForm)}>{w.writtenForm}</button>
                              ))}
                              {siblings.length>5&&<span className="sib-chip more">+{siblings.length-5}</span>}
                            </div>
                          )}
                          {syn.relations.length>0&&(
                            <div className="rels-row" style={{marginTop:8}}>
                              {syn.relations.slice(0,5).map((rel,ri)=>(
                                <button key={ri} className="rel-chip clickable" onClick={()=>onSynsetClick(rel.target)}>
                                  <span className="rel-t">{REL_LABELS[rel.relType]||rel.relType}</span>
                                  <span className="rel-a">→</span>
                                  <span className="rel-v">{rel.target.replace("ben-syn","#")}</span>
                                </button>
                              ))}
                              {syn.relations.length>5&&<span className="rel-chip more">+{syn.relations.length-5}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Dictionary Pagination */}
        <Pagination
          total={filteredEntries.length} page={page} pageSize={pageSize}
          onPage={p=>{setPage(p);setExpandedId(null);contentRef.current?.scrollIntoView({behavior:"smooth",block:"start"});}}
          onPageSize={s=>{setPageSize(s);setPage(1);setExpandedId(null);}}
          options={DICT_PAGE_OPTIONS} defaultSize={DICT_PAGE_DEFAULT}
        />
      </div>
    </div>
  );
}

// ─── Synset Modal ─────────────────────────────────────────────────────────────
function SynsetModal({item,history,onClose,onBack,onSynsetClick,onWordClick,entries,synsetMap}:{
  item:{synset:Synset;words:LexicalEntry[]};
  history:{synset:Synset;words:LexicalEntry[]}[];
  onClose:()=>void;onBack:()=>void;
  onSynsetClick:(id:string)=>void;onWordClick:(w:string)=>void;
  entries:LexicalEntry[];synsetMap:Map<string,Synset>;
}){
  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal-box">
        <div className="modal-hdr">
          <div className="modal-nav">
            {history.length>0&&<button className="modal-back" onClick={onBack}>← Back</button>}
            <span className="modal-title">Synset Explorer</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <SynsetPanel synset={item.synset} words={item.words} synsetMap={synsetMap} onSynsetClick={onSynsetClick} onWordClick={onWordClick}/>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home(){
  const[theme,setTheme]=useState<ThemeMode>("light");
  const[xmlLoaded,setXmlLoaded]=useState(false);
  const[xmlLoading,setXmlLoading]=useState(false);
  const[xmlError,setXmlError]=useState("");
  const[entries,setEntries]=useState<LexicalEntry[]>([]);
  const[synsetMap,setSynsetMap]=useState<Map<string,Synset>>(new Map());
  const[activeTab,setActiveTab]=useState<TabId>("word");

  // Word search
  const[wordQ,setWordQ]=useState("");
  const[debWordQ,setDebWordQ]=useState("");
  const[wordPage,setWordPage]=useState(1);
  const[wordPageSize,setWordPageSize]=useState(WORD_PAGE_DEFAULT);
  const[wordBusy,setWordBusy]=useState(false);
  const wordRef=useRef<HTMLInputElement>(null);
  const synRef=useRef<HTMLInputElement>(null);
  const resultsRef=useRef<HTMLDivElement>(null);
  const[synQ,setSynQ]=useState("");
  const[debSynQ,setDebSynQ]=useState("");
  const[synBusy,setSynBusy]=useState(false);

  // Synset modal
  const[modal,setModal]=useState<{synset:Synset;words:LexicalEntry[]}|null>(null);
  const[modalHist,setModalHist]=useState<{synset:Synset;words:LexicalEntry[]}[]>([]);

  useEffect(()=>{
    setXmlLoading(true);
    fetch("/ben.xml")
      .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text();})
      .then(t=>{const{entries:e,synsets:s}=parseXML(t);setEntries(e);setSynsetMap(s);setXmlLoaded(true);})
      .catch(e=>setXmlError(e.message))
      .finally(()=>setXmlLoading(false));
  },[]);

  // Debounce word
  useEffect(()=>{
    if(!wordQ){setDebWordQ("");return;}
    setWordBusy(true);
    const t=setTimeout(()=>{
      setDebWordQ(wordQ);setWordPage(1);setWordBusy(false);
      setTimeout(()=>resultsRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),50);
    },350);
    return()=>clearTimeout(t);
  },[wordQ]);

  // Debounce synset
  useEffect(()=>{
    if(!synQ){setDebSynQ("");return;}
    setSynBusy(true);
    const t=setTimeout(()=>{setDebSynQ(synQ);setSynBusy(false);},350);
    return()=>clearTimeout(t);
  },[synQ]);

  const wordResults=useMemo(()=>searchEntries(debWordQ,entries,synsetMap),[debWordQ,entries,synsetMap]);
  const pagedWords=useMemo(()=>wordResults.slice((wordPage-1)*wordPageSize,wordPage*wordPageSize),[wordResults,wordPage,wordPageSize]);
  const synResult=useMemo(()=>debSynQ?searchSynset(debSynQ,synsetMap,entries):null,[debSynQ,synsetMap,entries]);

  // Open synset modal
  const openSynset=useCallback((id:string)=>{
    const syn=synsetMap.get(id);
    if(!syn)return;
    const words=entries.filter(e=>e.senses.some(s=>s.synset===id));
    setModal(prev=>{
      if(prev)setModalHist(h=>[...h,prev]);
      return{synset:syn,words};
    });
  },[synsetMap,entries]);

  const synsetBack=useCallback(()=>{
    setModalHist(h=>{
      if(!h.length){setModal(null);return h;}
      setModal(h[h.length-1]);
      return h.slice(0,-1);
    });
  },[]);

  // Navigate from dictionary → word search tab
  const goWord=useCallback((w:string)=>{
    setWordQ(w);setDebWordQ(w);setWordPage(1);
    setActiveTab("word");setModal(null);setModalHist([]);
  },[]);

  // Navigate from dictionary → synset search tab
  const goSynset=useCallback((id:string)=>{
    setSynQ(id);setDebSynQ(id);
    setActiveTab("synset");setModal(null);setModalHist([]);
  },[]);

  const clearWord=useCallback(()=>{setWordQ("");setDebWordQ("");setWordPage(1);wordRef.current?.focus();},[]);
  const clearSyn=useCallback(()=>{setSynQ("");setDebSynQ("");synRef.current?.focus();},[]);

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        :root{
          ${TV(theme)}
          --radius:12px;--radius-sm:8px;--radius-xs:5px;
          --font-d:'Cinzel',serif;--font-b:'Noto Sans Bengali',sans-serif;--font-m:'JetBrains Mono',monospace;
          --tr:0.2s cubic-bezier(0.4,0,0.2,1);
        }
        html,body{min-height:100vh;background:var(--bg);color:var(--text);font-family:var(--font-b);overflow-x:hidden;transition:background .3s,color .3s;}
        body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.028;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:180px;}
        .pw{position:relative;min-height:100vh;z-index:1;}

        /* HEADER */
        .hdr{position:sticky;top:0;z-index:100;background:var(--header-bg);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);padding:0 clamp(16px,4vw,56px);}
        .hdr-inner{max-width:1240px;margin:0 auto;height:64px;display:flex;align-items:center;justify-content:space-between;gap:16px;}
        .logo{display:flex;align-items:center;gap:10px;text-decoration:none;}
        .logo-gem{width:40px;height:40px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,var(--olive),var(--sage));border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-family:var(--font-b);font-size:21px;font-weight:700;color:var(--bg);box-shadow:0 2px 12px var(--accent-glow);transition:transform var(--tr);}
        .logo:hover .logo-gem{transform:scale(1.07);}
        .logo-texts{display:flex;flex-direction:column;gap:1px;}
        .logo-name{font-family:var(--font-d);font-size:1.18rem;font-weight:700;letter-spacing:2px;color:var(--accent);line-height:1;}
        .logo-sub{font-family:var(--font-m);font-size:.56rem;letter-spacing:2px;text-transform:uppercase;color:var(--text3);display:none;}
        @media(min-width:540px){.logo-sub{display:block;}}
        .hdr-r{display:flex;align-items:center;gap:10px;}
        .db-pill{display:none;align-items:center;gap:6px;background:var(--accent-dim);border:1px solid var(--border2);border-radius:20px;padding:4px 12px;font-family:var(--font-m);font-size:.66rem;color:var(--text2);}
        @media(min-width:700px){.db-pill{display:flex;}}
        .ldot{width:6px;height:6px;border-radius:50%;background:var(--sage);animation:lp 2.2s ease-in-out infinite;}
        @keyframes lp{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.28;transform:scale(.8)}}
        .theme-sw{display:flex;align-items:center;gap:2px;background:var(--surface);border:1px solid var(--border2);border-radius:9px;padding:3px;}
        .t-btn{padding:4px 9px;border-radius:6px;border:none;cursor:pointer;font-size:.68rem;font-family:var(--font-m);background:transparent;color:var(--text3);display:flex;align-items:center;gap:4px;transition:all var(--tr);white-space:nowrap;}
        .t-btn.on{background:var(--accent);color:var(--bg);box-shadow:0 1px 8px var(--accent-glow);}
        .t-btn:not(.on):hover{color:var(--accent);background:var(--accent-dim);}
        .t-lbl{display:none;}@media(min-width:580px){.t-lbl{display:inline;}}

        /* TABS */
        .tabs-wrap{max-width:1240px;margin:0 auto;padding:12px clamp(16px,4vw,56px) 0;}
        .tabs-row{display:flex;gap:2px;border-bottom:2px solid var(--border);}
        .tab-btn{padding:8px 16px;border:none;background:none;cursor:pointer;font-family:var(--font-d);font-size:.78rem;letter-spacing:1px;color:var(--text3);border-bottom:2px solid transparent;margin-bottom:-2px;transition:all var(--tr);display:flex;align-items:center;gap:6px;white-space:nowrap;}
        .tab-btn.on{color:var(--accent);border-bottom-color:var(--accent);}
        .tab-btn:hover:not(.on){color:var(--text2);}

        /* HERO */
        html{scroll-padding-top:130px;}
        .hero{max-width:1240px;margin:0 auto;padding:clamp(22px,4vw,44px) clamp(16px,4vw,56px) 18px;transition:padding .25s ease;}
        .hero-compact{padding:14px clamp(16px,4vw,56px) 14px;}
        .eyebrow{font-family:var(--font-m);font-size:.68rem;letter-spacing:3.5px;text-transform:uppercase;color:var(--text3);margin-bottom:8px;display:flex;align-items:center;gap:8px;}
        .eline{display:block;width:28px;height:1px;background:var(--accent2);}
        .hero-h1{font-family:var(--font-d);font-size:clamp(1.7rem,4.5vw,3rem);font-weight:700;line-height:1.1;color:var(--text);margin-bottom:8px;}
        .hero-compact .hero-h1{font-size:clamp(1.1rem,2.5vw,1.6rem);margin-bottom:6px;}
        .hero-h1 .hi{color:var(--accent);}
        .hero-sub{color:var(--text2);font-size:clamp(.82rem,1.6vw,.94rem);line-height:1.65;margin-bottom:clamp(18px,3vw,28px);}
        .err-bar{background:rgba(184,112,64,.1);border:1px solid rgba(184,112,64,.3);color:var(--rust);padding:9px 14px;border-radius:var(--radius-sm);font-family:var(--font-m);font-size:.76rem;margin-bottom:14px;}
        .tip-box{background:var(--accent-dim);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:10px 14px;font-family:var(--font-m);font-size:.7rem;color:var(--text2);margin-bottom:14px;line-height:1.8;}
        .tip-box code{background:var(--bg3);padding:1px 5px;border-radius:3px;color:var(--accent);}

        /* SEARCH BOX */
        .s-wrap{max-width:720px;}
        .s-box{display:flex;align-items:center;gap:12px;background:var(--surface);border:1.5px solid var(--border2);border-radius:var(--radius);padding:14px 18px;box-shadow:var(--shadow);transition:border-color var(--tr),box-shadow var(--tr);}
        .s-box:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow),var(--shadow);}
        .s-ico{color:var(--text3);font-size:17px;flex-shrink:0;transition:color var(--tr);}
        .s-box:focus-within .s-ico{color:var(--accent);}
        .s-inp{flex:1;background:none;border:none;outline:none;font-family:var(--font-b);font-size:1.02rem;color:var(--text);caret-color:var(--accent);}
        .s-inp::placeholder{color:var(--text3);}
        .s-spin{width:17px;height:17px;flex-shrink:0;border:2px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin .65s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .s-clr{background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer;padding:4px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all var(--tr);opacity:0;pointer-events:none;}
        .s-clr.on{opacity:1;pointer-events:all;}
        .s-clr:hover{color:var(--accent);background:var(--accent-dim);}
        .s-hints{display:flex;flex-wrap:wrap;gap:12px;margin-top:9px;font-family:var(--font-m);font-size:.68rem;color:var(--text3);}

        /* RESULTS */
        .res-sec{max-width:1240px;margin:0 auto;padding:16px clamp(16px,4vw,56px) 100px;}
        .res-hdr{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border);}
        .res-count{font-family:var(--font-d);font-size:.9rem;color:var(--text2);}
        .res-count strong{color:var(--accent);}

        /* RESULT CARD */
        .result-card{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;animation:ri .34s ease both;transition:border-color var(--tr),box-shadow var(--tr),transform var(--tr);}
        .result-card:hover{border-color:var(--border2);box-shadow:0 5px 28px var(--accent-glow);transform:translateY(-1px);}
        @keyframes ri{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .card-bar{position:absolute;top:0;left:0;bottom:0;width:4px;background:linear-gradient(180deg,var(--accent),var(--olive),var(--sage));border-radius:var(--radius) 0 0 var(--radius);}
        .card-body{padding:18px 20px 16px 36px;}
        .card-top{margin-bottom:12px;overflow:visible;}
        .card-title-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;overflow:visible;}
        .written-form{font-family:var(--font-b);font-size:clamp(1.3rem,3.2vw,1.9rem);font-weight:700;color:var(--text);line-height:1.5;display:inline-block;}
        .pos-badge{font-family:var(--font-m);font-size:.68rem;padding:2px 9px;border-radius:20px;border:1px solid;font-weight:500;}
        .pos-badge.sm{font-size:.6rem;padding:2px 6px;}
        .eng-match-badge{font-family:var(--font-m);font-size:.6rem;padding:2px 8px;border-radius:20px;background:rgba(200,168,74,.12);color:var(--gold);border:1px solid rgba(200,168,74,.3);}
        .meta-row{display:flex;flex-wrap:wrap;gap:7px;}
        .meta-pill{display:flex;align-items:center;gap:4px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-xs);padding:2px 7px;}
        .meta-k{font-family:var(--font-m);font-size:.56rem;text-transform:uppercase;letter-spacing:1px;color:var(--text3);}
        .meta-v{font-family:var(--font-m);font-size:.67rem;color:var(--text2);}
        .synsets-list{display:flex;flex-direction:column;gap:9px;}
        .synset-block{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 14px;position:relative;overflow:hidden;}
        .synset-block::before{content:'';position:absolute;top:0;left:16px;right:16px;height:1px;background:linear-gradient(90deg,transparent,var(--accent2),transparent);opacity:.2;}
        .syn-id-row{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:7px;margin-bottom:9px;}
        .chip-group{display:flex;flex-wrap:wrap;gap:5px;}
        .chip{font-family:var(--font-m);font-size:.62rem;padding:2px 7px;border-radius:var(--radius-xs);display:inline-flex;align-items:center;gap:3px;}
        .chip-syn{background:rgba(87,97,57,.15);color:var(--accent);border:1px solid rgba(143,168,90,.25);}
        .chip-sen{background:rgba(139,109,56,.15);color:var(--gold);border:1px solid rgba(200,168,74,.25);}
        .chip-ili{background:rgba(67,87,57,.15);color:var(--sage);border:1px solid rgba(106,136,84,.25);}
        .clickable-chip{cursor:pointer;transition:all var(--tr);}
        .clickable-chip:hover{background:var(--accent-glow)!important;border-color:var(--accent)!important;transform:translateY(-1px);}
        .chip-go{opacity:.6;font-size:.58rem;}
        .syn-badges{display:flex;gap:5px;align-items:center;flex-wrap:wrap;}
        .lex-badge{font-family:var(--font-m);font-size:.58rem;padding:2px 6px;border-radius:20px;background:rgba(200,168,74,.12);color:var(--gold);border:1px solid rgba(200,168,74,.28);}
        .def-block{display:flex;gap:8px;align-items:flex-start;background:var(--bg3);border-left:3px solid var(--accent2);border-radius:0 var(--radius-xs) var(--radius-xs) 0;padding:9px 11px;margin-bottom:9px;}
        .def-q{font-size:1.8rem;line-height:1;color:var(--accent);opacity:.3;font-family:Georgia,serif;flex-shrink:0;margin-top:-4px;}
        .def-text{font-size:.84rem;color:var(--text2);line-height:1.65;font-style:italic;}
        .rels-row{display:flex;flex-wrap:wrap;gap:5px;}
        .rel-chip{font-family:var(--font-m);font-size:.6rem;padding:2px 7px;border-radius:var(--radius-xs);background:var(--surface2);border:1px solid var(--border2);display:inline-flex;align-items:center;gap:3px;}
        .rel-chip.clickable{cursor:pointer;transition:all var(--tr);}
        .rel-chip.clickable:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-dim);}
        .rel-t{color:var(--text3);text-transform:uppercase;font-size:.54rem;letter-spacing:.5px;}
        .rel-a{color:var(--border2);}
        .rel-v{color:var(--text2);}
        .rel-chip.more{color:var(--text3);font-style:italic;}
        .siblings-row{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-bottom:7px;}
        .sib-label{font-family:var(--font-m);font-size:.58rem;text-transform:uppercase;letter-spacing:1px;color:var(--text3);}
        .sib-chip{background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius-xs);padding:2px 7px;font-family:var(--font-b);font-size:.78rem;color:var(--text2);}
        .sib-chip.clickable{cursor:pointer;transition:all var(--tr);}
        .sib-chip.clickable:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-dim);}
        .sib-chip.more{color:var(--text3);font-style:italic;}
        .expand-btn{background:none;border:1px dashed var(--border2);border-radius:var(--radius-sm);color:var(--accent);font-size:.75rem;padding:7px;cursor:pointer;width:100%;font-family:var(--font-m);transition:all var(--tr);margin-top:4px;}
        .expand-btn:hover{background:var(--accent-dim);border-color:var(--accent);}

        /* SYNSET PANEL */
        .synset-panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:clamp(16px,2.8vw,26px);position:relative;overflow:hidden;}
        .synset-panel::before{content:'';position:absolute;top:0;left:0;bottom:0;width:3px;background:linear-gradient(180deg,var(--accent),var(--sage));}
        .sp-head{margin-bottom:12px;padding-left:12px;}
        .sp-id-row{display:flex;flex-wrap:wrap;gap:7px;align-items:center;}
        .sp-section{margin-top:14px;padding-left:12px;}
        .sp-sec-label{font-family:var(--font-m);font-size:.62rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--text3);margin-bottom:8px;}
        .sp-words{display:flex;flex-wrap:wrap;gap:7px;}
        .word-chip{background:var(--accent-dim);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:5px 11px;cursor:pointer;font-family:var(--font-b);font-size:.92rem;color:var(--text);display:flex;align-items:center;gap:7px;transition:all var(--tr);}
        .word-chip:hover{border-color:var(--accent);background:var(--accent-glow);color:var(--accent);}

        /* SYNSET SEARCH result */
        .syn-res-wrap{max-width:1240px;margin:0 auto;padding:16px clamp(16px,4vw,56px) 100px;}

        /* STATE */
        .state-box{text-align:center;padding:60px 24px;}
        .state-g{font-size:3rem;opacity:.32;margin-bottom:14px;}
        .state-t{font-family:var(--font-d);font-size:1.15rem;font-weight:600;color:var(--text2);margin-bottom:8px;}
        .state-b{font-size:.84rem;color:var(--text3);line-height:1.7;}

        /* SKELETON */
        .skel-wrap{display:flex;flex-direction:column;gap:12px;}
        .skel-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px 22px;animation:fi .3s ease both;}
        @keyframes fi{from{opacity:0}to{opacity:1}}
        .skel-line{height:10px;border-radius:5px;margin-bottom:9px;background:linear-gradient(90deg,var(--surface2) 25%,var(--bg3) 50%,var(--surface2) 75%);background-size:200% 100%;animation:sh 1.6s infinite;}
        .skel-line.lg{height:20px;width:48%;}
        .skel-line.md{width:33%;}
        .skel-line.sm{width:18%;}
        @keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}

        /* PAGINATION */
        .pag-bar{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:9px;margin-top:24px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:13px 18px;}
        .pag-btn{width:34px;height:34px;border-radius:var(--radius-sm);border:1px solid var(--border2);background:var(--surface2);color:var(--text);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--tr);}
        .pag-btn.nav{font-size:1.3rem;font-weight:300;}
        .pag-btn.reset{font-size:1.1rem;}
        .pag-btn:hover:not(:disabled){border-color:var(--accent);color:var(--accent);background:var(--accent-dim);}
        .pag-btn:disabled{opacity:.24;cursor:not-allowed;}
        .pag-size{display:flex;align-items:center;gap:5px;}
        .pag-label{font-family:var(--font-m);font-size:.61rem;color:var(--text3);text-transform:uppercase;letter-spacing:1px;}
        .pag-select{background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font-m);font-size:.78rem;padding:5px 9px;cursor:pointer;outline:none;transition:all var(--tr);}
        .pag-select:focus{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-glow);}
        .pag-info{display:flex;align-items:center;gap:4px;font-family:var(--font-d);font-size:.88rem;}
        .pag-cur{color:var(--accent);font-size:1.05rem;font-weight:700;}
        .pag-of{color:var(--text3);font-size:.7rem;}
        .pag-tot{color:var(--text2);font-weight:600;}
        .pag-count{font-family:var(--font-m);font-size:.65rem;color:var(--text3);padding:2px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:20px;}

        /* DICTIONARY */
        .dict-wrapper{max-width:1240px;margin:0 auto;padding:0 clamp(16px,4vw,56px) 100px;}
        .dict-nav{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:22px;position:sticky;top:66px;z-index:50;backdrop-filter:blur(14px);}
        .dict-nav-inner{padding:clamp(12px,2vw,20px);}
        .alpha-sec{margin-bottom:12px;}
        .alpha-lbl{font-family:var(--font-m);font-size:.58rem;text-transform:uppercase;letter-spacing:2px;color:var(--text3);display:block;margin-bottom:7px;}
        .alpha-grp{display:flex;flex-wrap:wrap;gap:4px;}
        .al-btn{min-width:32px;height:32px;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text3);font-family:var(--font-b);font-size:.95rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--tr);padding:0 5px;}
        .al-btn.eng{min-width:26px;height:26px;font-size:.74rem;font-family:var(--font-m);}
        .al-btn.has{color:var(--text);border-color:var(--border2);background:var(--bg3);}
        .al-btn.has:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-dim);}
        .al-btn.act{background:var(--accent)!important;color:var(--bg)!important;border-color:var(--accent)!important;box-shadow:0 2px 10px var(--accent-glow);}
        .al-btn.no{opacity:.28;cursor:not-allowed;}
        .al-all-btn{font-family:var(--font-m);font-size:.68rem;padding:5px 12px;border-radius:8px;border:1px solid var(--border2);background:var(--surface2);color:var(--text2);cursor:pointer;transition:all var(--tr);}
        .al-all-btn.act{background:var(--accent);color:var(--bg);border-color:var(--accent);}
        .al-all-btn:not(.act):hover{border-color:var(--accent);color:var(--accent);}
        .dict-nav-footer{display:flex;align-items:center;gap:12px;margin-top:10px;flex-wrap:wrap;}
        .dict-stats{font-family:var(--font-m);font-size:.63rem;color:var(--text3);}
        .dict-content-hdr{display:flex;align-items:center;gap:14px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border);}
        .dict-cur-letter{display:flex;align-items:center;gap:14px;}
        .dict-cur-glyph{font-family:var(--font-b);font-size:2.4rem;font-weight:700;color:var(--accent);line-height:1;flex-shrink:0;}
        .dict-cur-count{font-family:var(--font-d);font-size:.9rem;color:var(--text);}
        .dict-cur-page{font-family:var(--font-m);font-size:.66rem;color:var(--text3);margin-top:2px;}
        .dict-list{display:flex;flex-direction:column;gap:5px;}
        .dw-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;transition:border-color var(--tr),box-shadow var(--tr);}
        .dw-card.open{border-color:var(--accent);box-shadow:0 3px 18px var(--accent-glow);}
        .dw-btn{width:100%;background:none;border:none;padding:9px 14px;cursor:pointer;display:flex;align-items:center;gap:9px;text-align:left;transition:background var(--tr);}
        .dw-btn:hover{background:var(--accent-dim);}
        .dw-index{font-family:var(--font-m);font-size:.6rem;color:var(--text3);min-width:32px;text-align:right;flex-shrink:0;}
        .dw-word{font-family:var(--font-b);font-size:1.02rem;font-weight:600;color:var(--text);flex:1;}
        .dw-senses{font-family:var(--font-m);font-size:.6rem;color:var(--text3);white-space:nowrap;}
        .dw-arrow{font-size:.65rem;color:var(--text3);margin-left:4px;}
        .dw-detail{border-top:1px solid var(--border);padding:13px 14px;background:var(--bg2);display:flex;flex-direction:column;gap:10px;}
        .dw-actions{display:flex;gap:7px;flex-wrap:wrap;}
        .dw-action{background:var(--accent-dim);border:1px solid var(--border2);border-radius:var(--radius-sm);color:var(--accent);font-family:var(--font-m);font-size:.7rem;padding:5px 11px;cursor:pointer;transition:all var(--tr);}
        .dw-action:hover{background:var(--accent);color:var(--bg);}
        .dw-synset{background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:11px 13px;}
        .dw-syn-ids{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-bottom:7px;}

        /* MODAL */
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.52);backdrop-filter:blur(4px);z-index:500;display:flex;align-items:center;justify-content:center;padding:18px;}
        .modal-box{background:var(--surface);border:1px solid var(--border2);border-radius:14px;width:100%;max-width:660px;max-height:88vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--shadow-lg);}
        .modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;border-bottom:1px solid var(--border);flex-shrink:0;}
        .modal-nav{display:flex;align-items:center;gap:8px;}
        .modal-back{background:none;border:1px solid var(--border2);border-radius:7px;color:var(--text2);padding:4px 9px;cursor:pointer;font-family:var(--font-m);font-size:.7rem;transition:all var(--tr);}
        .modal-back:hover{border-color:var(--accent);color:var(--accent);}
        .modal-title{font-family:var(--font-d);font-size:.82rem;letter-spacing:1px;color:var(--text2);}
        .modal-close{background:none;border:1px solid var(--border2);border-radius:7px;color:var(--text3);width:30px;height:30px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;transition:all var(--tr);}
        .modal-close:hover{border-color:var(--rust);color:var(--rust);}
        .modal-body{overflow-y:auto;padding:18px;flex:1;}

        /* XML LOADING */
        .xml-ov{position:fixed;inset:0;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;z-index:9999;}
        .xml-lw{position:relative;width:88px;height:88px;display:flex;align-items:center;justify-content:center;}
        .xml-gem{width:70px;height:70px;border-radius:17px;background:linear-gradient(135deg,var(--olive),var(--sage));display:flex;align-items:center;justify-content:center;font-family:var(--font-b);font-size:34px;font-weight:700;color:var(--bg);box-shadow:0 0 36px var(--accent-glow);}
        .xml-ring{position:absolute;inset:0;border:2px solid var(--border2);border-top-color:var(--accent);border-right-color:var(--sage);border-radius:50%;animation:spin 1.3s linear infinite;}
        .xml-t{font-family:var(--font-d);font-size:1.25rem;color:var(--text2);letter-spacing:3px;}
        .xml-p{width:190px;height:2px;background:var(--border2);border-radius:2px;overflow:hidden;}
        .xml-pb{height:100%;width:44%;background:linear-gradient(90deg,var(--accent2),var(--accent));border-radius:2px;animation:sw 1.5s ease-in-out infinite;}
        @keyframes sw{0%{margin-left:-44%;width:44%;}50%{margin-left:56%;width:44%;}100%{margin-left:100%;width:44%;}}
        .xml-s{font-family:var(--font-m);font-size:.68rem;color:var(--text3);letter-spacing:1.5px;animation:bk 1.8s ease-in-out infinite;}
        @keyframes bk{0%,100%{opacity:1}50%{opacity:.18}}

        /* FOOTER */
        .site-footer{position:fixed;bottom:0;left:0;right:0;border-top:1px solid var(--border);background:var(--footer-bg);backdrop-filter:blur(12px);padding:8px clamp(16px,4vw,56px);display:flex;align-items:center;justify-content:center;gap:16px;font-family:var(--font-m);font-size:.65rem;color:var(--text3);z-index:50;}
        .fdot{opacity:.3;}
        .f-acc{color:var(--accent);font-weight:600;}

        @media(max-width:480px){
          .pag-bar{gap:6px;padding:10px;}
          .pag-select{padding:4px 6px;}
          .modal-box{max-height:94vh;}
        }
      `}</style>

      <div className="pw">
        {/* XML Loading */}
        {xmlLoading&&(
          <div className="xml-ov">
            <div className="xml-lw"><div className="xml-gem">শ</div><div className="xml-ring"/></div>
            <div className="xml-t">ShobdoNet</div>
            <div className="xml-p"><div className="xml-pb"/></div>
            <div className="xml-s">Loading Bengali Lexicon…</div>
          </div>
        )}

        {/* Synset Modal */}
        {modal&&(
          <SynsetModal
            item={modal} history={modalHist}
            onClose={()=>{setModal(null);setModalHist([]);}}
            onBack={synsetBack}
            onSynsetClick={openSynset}
            onWordClick={goWord}
            entries={entries} synsetMap={synsetMap}
          />
        )}

        {/* HEADER */}
        <header className="hdr">
          <div className="hdr-inner">
            <a className="logo" href="#">
              <div className="logo-gem">শ</div>
              <div className="logo-texts">
                <span className="logo-name">ShobdoNet</span>
                <span className="logo-sub">Bengali · Lexical · Search</span>
              </div>
            </a>
            <div className="hdr-r">
              {xmlLoaded&&(
                <div className="db-pill">
                  <span className="ldot"/>
                  {entries.length.toLocaleString()} entries &nbsp;·&nbsp; {synsetMap.size.toLocaleString()} synsets
                </div>
              )}
              <div className="theme-sw">
                {THEMES.map(t=>(
                  <button key={t.id} className={`t-btn ${theme===t.id?"on":""}`} onClick={()=>setTheme(t.id)} title={t.label}>
                    {t.icon}<span className="t-lbl">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* TABS */}
        <div className="tabs-wrap">
          <div className="tabs-row">
            {([
              {id:"word"      as TabId,icon:"🔍",label:"Word Search"},
              {id:"synset"    as TabId,icon:"⬡", label:"Synset Search"},
              {id:"dictionary"as TabId,icon:"📖",label:"Dictionary"},
            ]).map(tab=>(
              <button key={tab.id} className={`tab-btn ${activeTab===tab.id?"on":""}`} onClick={()=>setActiveTab(tab.id)}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── WORD SEARCH ── */}
        {activeTab==="word"&&(
          <>
            <section className={`hero ${debWordQ||wordBusy?"hero-compact":""}`}>
              <div className="eyebrow"><span className="eline"/>Word Search</div>
              <h1 className="hero-h1">খুঁজুন <span className="hi">বাংলা শব্দ</span></h1>
              {!debWordQ&&!wordBusy&&<p className="hero-sub">Search Bengali words or English keywords. Synset chips are clickable — explore connected words and relations.</p>}
              {xmlError&&<div className="err-bar">⚠ {xmlError} — Place ben.xml in /public/</div>}
              <div className="s-wrap">
                <div className="s-box">
                  <span className="s-ico">⌕</span>
                  <input ref={wordRef} className="s-inp" type="text"
                    placeholder="বাংলা শব্দ বা English keyword… (e.g. নিরাপদ / snake / tree)"
                    value={wordQ} onChange={e=>setWordQ(e.target.value)} autoFocus/>
                  {wordBusy&&<div className="s-spin"/>}
                  <button className={`s-clr ${wordQ?"on":""}`} onClick={clearWord}>✕</button>
                </div>
                <div className="s-hints">
                  <span>⚡ Real-time</span>
                  <span>🔤 Bengali or English</span>
                  <span>🔗 Click any Synset ID ↗</span>
                </div>
              </div>
            </section>
            <section className="res-sec" ref={resultsRef}>
              {wordBusy?<Skel/>
              :debWordQ&&wordResults.length===0?(
                <div className="state-box"><div className="state-g">🔎</div><div className="state-t">No Results</div><div className="state-b">No match for &ldquo;<strong>{debWordQ}</strong>&rdquo;. Try a different word or keyword.</div></div>
              ):debWordQ&&wordResults.length>0?(
                <>
                  <div className="res-hdr"><div className="res-count">Found <strong>{wordResults.length.toLocaleString()}</strong> results for &ldquo;{debWordQ}&rdquo;</div></div>
                  {pagedWords.map((r,i)=>(
                    <ResultCard key={r.entry.id} result={r} index={i} searchQuery={debWordQ} onSynsetClick={openSynset} entries={entries} synsetMap={synsetMap}/>
                  ))}
                  <Pagination total={wordResults.length} page={wordPage} pageSize={wordPageSize}
                    onPage={setWordPage} onPageSize={s=>{setWordPageSize(s);setWordPage(1);}}
                    options={WORD_PAGE_OPTIONS} defaultSize={WORD_PAGE_DEFAULT}/>
                </>
              ):(
                <div className="state-box"><div className="state-g">📖</div><div className="state-t">Start Searching</div><div className="state-b">Type any Bengali word or English keyword above.</div></div>
              )}
            </section>
          </>
        )}

        {/* ── SYNSET SEARCH ── */}
        {activeTab==="synset"&&(
          <>
            <section className="hero">
              <div className="eyebrow"><span className="eline"/>Synset Search</div>
              <h1 className="hero-h1">Search by <span className="hi">Synset ID</span></h1>
              <p className="hero-sub">Find any synset by full or partial ID. All relation chips are clickable.</p>
              {/* <div className="tip-box">
                Try: <code>ben-syn1761353</code> &nbsp;or&nbsp; <code>syn1761353</code> &nbsp;or just&nbsp; <code>1761353</code>
              </div> */}
              <div className="s-wrap">
                <div className="s-box">
                  <span className="s-ico">⬡</span>
                  <input ref={synRef} className="s-inp" type="text"
                    placeholder="e.g. ben-syn1761353 or 1761353…"
                    value={synQ} onChange={e=>setSynQ(e.target.value)} autoFocus/>
                  {synBusy&&<div className="s-spin"/>}
                  <button className={`s-clr ${synQ?"on":""}`} onClick={clearSyn}>✕</button>
                </div>
                <div className="s-hints"><span>⬡ Full ID</span><span>⬡ Partial</span><span>⬡ Number only</span></div>
              </div>
            </section>
            <div className="syn-res-wrap">
              {synBusy?<Skel/>
              :debSynQ&&!synResult?(
                <div className="state-box"><div className="state-g">⬡</div><div className="state-t">Synset Not Found</div><div className="state-b">No synset matches &ldquo;<strong>{debSynQ}</strong>&rdquo;.</div></div>
              ):synResult?(
                <>
                  <div className="res-hdr"><div className="res-count">Synset found — <strong>{synResult.words.length}</strong> connected word{synResult.words.length!==1?"s":""}</div></div>
                  <SynsetPanel synset={synResult.synset} words={synResult.words} synsetMap={synsetMap} onSynsetClick={openSynset} onWordClick={goWord}/>
                </>
              ):(
                <div className="state-box"><div className="state-g">⬡</div><div className="state-t">Search a Synset</div><div className="state-b">Enter a synset ID to view its definition, connected words, and relations.</div></div>
              )}
            </div>
          </>
        )}

        {/* ── DICTIONARY ── */}
        {activeTab==="dictionary"&&(
          <>
            <section className="hero" style={{paddingBottom:10}}>
              <div className="eyebrow"><span className="eline"/>Dictionary Browser</div>
              <h1 className="hero-h1">Browse <span className="hi">by Letter</span></h1>
              <p className="hero-sub">
                All {entries.length.toLocaleString()} words from the XML file, sorted alphabetically.
                Click a letter to filter. Click any word to expand. Synsets &amp; relations are clickable.
              </p>
            </section>
            {xmlLoaded
              ? <DictionaryBrowser entries={entries} synsetMap={synsetMap} onWordClick={goWord} onSynsetClick={goSynset}/>
              : <div className="dict-wrapper"><div className="state-box"><div className="state-g">📖</div><div className="state-t">Loading…</div></div></div>
            }
          </>
        )}

        {/* FOOTER */}
        <footer className="site-footer">
          <span className="f-acc">ShobdoNet</span>
          <span className="fdot">·</span>
          <span>Bengali WordNet</span>
          <span className="fdot">·</span>
          <span>UKC Lexicon v1.0</span>
        </footer>
      </div>
    </>
  );
}