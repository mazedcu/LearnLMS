import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Trash2, X, RefreshCw, Upload, Lightbulb, ImagePlus } from "lucide-react";
import { adminAPI } from "../../../api";
import {
  gapTokens, toggleGapAt, parseGaps, detectVariables, evalFormula, splitEvenly,
} from "./quizModel";

/* ── Small shared pieces ──────────────────────────────────────────────── */

export function PromptField({ value, onChange, placeholder, label = "Question", autoFocus }) {
  return (
    <div className="qs-field">
      <label>{label}</label>
      <textarea className="qs-textarea" rows={2} value={value} placeholder={placeholder}
        autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Chips with type-and-Enter input. */
function TagInput({ values, onChange, placeholder, renderExtra }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...values, ...parts.filter((p) => !values.includes(p))]);
    setDraft("");
  };
  return (
    <div className="qs-tags">
      {values.map((v, i) => (
        <span key={i} className="qs-tag">
          {v}
          {renderExtra?.(i)}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((_, j) => j !== i))}><X size={12} /></button>
        </span>
      ))}
      <input value={draft} placeholder={values.length ? "" : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={add} />
    </div>
  );
}

/* ── Multiple choice ──────────────────────────────────────────────────── */

export function McqEditor({ draft, set }) {
  const refs = useRef([]);
  const [focusIdx, setFocusIdx] = useState(null);
  useEffect(() => { if (focusIdx !== null) { refs.current[focusIdx]?.focus(); setFocusIdx(null); } }, [focusIdx]);

  const opts = draft.options;
  const update = (i, patch) => set({ options: opts.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const toggleCorrect = (i) => {
    if (draft.multiple) update(i, { correct: !opts[i].correct });
    else set({ options: opts.map((o, j) => ({ ...o, correct: j === i })) });
  };
  const insertAfter = (i) => {
    const next = [...opts];
    next.splice(i + 1, 0, { text: "", correct: false });
    set({ options: next });
    setFocusIdx(i + 1);
  };
  const remove = (i) => {
    if (opts.length <= 2) return update(i, { text: "" });
    const wasCorrect = opts[i].correct;
    let next = opts.filter((_, j) => j !== i);
    if (wasCorrect && !draft.multiple && !next.some((o) => o.correct)) next = next.map((o, j) => ({ ...o, correct: j === 0 }));
    set({ options: next });
    setFocusIdx(Math.max(0, i - 1));
  };

  return (
    <>
      <PromptField value={draft.prompt} onChange={(prompt) => set({ prompt })} placeholder="e.g. Which planet is closest to the Sun?" autoFocus={!draft.id} />
      <div className="qs-field">
        <span className="qs-label">Options <span className="text-muted" style={{ fontWeight: 500 }}>— click the circle next to the right answer{draft.multiple ? "s" : ""}</span></span>
        {opts.map((o, i) => (
          <div key={i} className={`qs-opt ${o.correct ? "correct" : ""}`}>
            <button type="button" className={`qs-opt-mark ${draft.multiple ? "square" : ""} ${o.correct ? "on" : ""}`}
              onClick={() => toggleCorrect(i)} aria-label={o.correct ? "Correct answer" : "Mark as correct"} title={o.correct ? "Correct answer" : "Mark as correct"}>
              <Check size={16} strokeWidth={3} />
            </button>
            <input ref={(el) => (refs.current[i] = el)} className="qs-input" value={o.text}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              onChange={(e) => update(i, { text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); insertAfter(i); }
                if (e.key === "Backspace" && !o.text && opts.length > 2) { e.preventDefault(); remove(i); }
              }} />
            <button type="button" className="cb-icon-btn danger" aria-label="Remove option" onClick={() => remove(i)}><Trash2 size={15} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.3rem" }}>
          <button type="button" className="qs-addline" onClick={() => insertAfter(opts.length - 1)}><Plus size={14} /> Add option</button>
          <label className="cb-switch">
            <input type="checkbox" checked={draft.multiple} onChange={(e) => {
              const multiple = e.target.checked;
              let options = opts;
              if (!multiple) { const first = opts.findIndex((o) => o.correct); options = opts.map((o, j) => ({ ...o, correct: j === Math.max(0, first) })); }
              set({ multiple, options });
            }} />
            <span className="cb-switch-track" /> <span>More than one right answer</span>
          </label>
        </div>
        <p className="qs-hint">Tip: press <code>Enter</code> for the next option. Students see the options in this order.</p>
      </div>
    </>
  );
}

/* ── Fill in the blanks / Drag the words ──────────────────────────────── */

export function GapEditor({ draft, set }) {
  const isWords = draft.type === "drag_drop_word";
  const tokens = useMemo(() => gapTokens(draft.gapText), [draft.gapText]);
  const { answers } = useMemo(() => parseGaps(draft.gapText, draft.type), [draft.gapText, draft.type]);
  const gapCount = Object.keys(answers).length;

  return (
    <>
      <div className="qs-field">
        <label>Sentence</label>
        <textarea className="qs-textarea" rows={3} value={draft.gapText} autoFocus={!draft.id}
          placeholder={isWords ? "e.g. The mitochondria is the powerhouse of the cell." : "e.g. The capital of France is Paris."}
          onChange={(e) => set({ gapText: e.target.value })} />
        <p className="qs-hint">
          Write the sentence, then <b>click any word below</b> to turn it into a gap — or type it in square brackets like <code>[Paris]</code>.
          {!isWords && <> Accept several answers with <code>[colour|color]</code>.</>}
        </p>
      </div>

      {draft.gapText.trim() && (
        <div className="qs-field">
          <span className="qs-label">Click words to make gaps {gapCount > 0 && <span className="text-muted" style={{ fontWeight: 500 }}>· {gapCount} gap{gapCount === 1 ? "" : "s"}</span>}</span>
          <div className="qs-sentence">
            {tokens.map((t, i) =>
              t.kind === "space" ? <span key={i}>{t.text}</span> :
              t.kind === "gap" ? (
                <button key={i} type="button" className="qs-gap" title="Click to turn back into a normal word"
                  onClick={() => set({ gapText: toggleGapAt(draft.gapText, t) })}>{t.text}</button>
              ) : (
                <button key={i} type="button" className="qs-word" title="Click to make this a gap"
                  onClick={() => set({ gapText: toggleGapAt(draft.gapText, t) })}>{t.text}</button>
              )
            )}
          </div>
        </div>
      )}

      {isWords && (
        <div className="qs-field">
          <span className="qs-label">Extra words to make it harder <span className="text-muted" style={{ fontWeight: 500 }}>(optional)</span></span>
          <TagInput values={draft.extraWords} onChange={(extraWords) => set({ extraWords })} placeholder="Type a wrong word and press Enter" />
          <p className="qs-hint">Students drag from the gap words plus these.</p>
        </div>
      )}
    </>
  );
}

/* ── Short answer (keywords) ──────────────────────────────────────────── */

export function KeywordEditor({ draft, set }) {
  const words = draft.keywords.map((k) => k.keyword);
  const [sample, setSample] = useState("");
  const weighted = draft.autoWeights ? splitEvenly(draft.keywords.length ? draft.keywords : [], Number(draft.marks) || 1) : draft.keywords;

  const setWords = (list) => {
    const kept = list.map((w) => draft.keywords.find((k) => k.keyword === w) || { keyword: w, weight: 1, case_sensitive: false });
    set({ keywords: kept });
  };

  const test = useMemo(() => {
    if (!sample.trim() || !weighted.length) return null;
    let score = 0;
    let html = sample.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const found = [];
    for (const k of weighted) {
      const hit = k.case_sensitive ? sample.includes(k.keyword) : sample.toLowerCase().includes(k.keyword.toLowerCase());
      if (hit) {
        score += Number(k.weight) || 0;
        found.push(k.keyword);
        const re = new RegExp(k.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), k.case_sensitive ? "g" : "gi");
        html = html.replace(re, (m) => `<mark>${m}</mark>`);
      }
    }
    return { score: Math.min(score, Number(draft.marks) || 1), found, html };
  }, [sample, weighted, draft.marks]);

  return (
    <>
      <PromptField value={draft.prompt} onChange={(prompt) => set({ prompt })} placeholder="e.g. Explain how plants make food." autoFocus={!draft.id} />
      <div className="qs-field">
        <span className="qs-label">Key words the answer should contain</span>
        <TagInput values={words} onChange={setWords} placeholder="Type a key word and press Enter"
          renderExtra={draft.autoWeights ? null : (i) => (
            <input type="number" min="0" step="0.5" title="Marks for this word" value={draft.keywords[i]?.weight ?? 1}
              onChange={(e) => set({ keywords: draft.keywords.map((k, j) => (j === i ? { ...k, weight: e.target.value } : k)) })} />
          )} />
        <label className="cb-switch" style={{ marginTop: "0.5rem" }}>
          <input type="checkbox" checked={!draft.autoWeights} onChange={(e) => set({ autoWeights: !e.target.checked })} />
          <span className="cb-switch-track" />
          <span>Give words different marks <span className="cb-switch-hint">{draft.autoWeights && weighted.length ? `now ${weighted[0].weight} each` : ""}</span></span>
        </label>
        <p className="qs-hint">Part of a word counts too ("cell" also matches "cells"). Capital letters don't matter.</p>
      </div>
      <div className="qs-field">
        <span className="qs-label">Try an answer</span>
        <div className="qs-tester">
          <textarea className="qs-textarea" rows={2} value={sample} placeholder="Type what a student might write…" onChange={(e) => setSample(e.target.value)} />
          {test && (
            <>
              <div className="qs-tester-out" dangerouslySetInnerHTML={{ __html: test.html }} />
              <div className={`qs-live ${test.found.length ? "ok" : "bad"}`}>
                Scores {Math.round(test.score * 100) / 100} / {draft.marks} {test.found.length < weighted.length && `· missing: ${weighted.filter((k) => !test.found.includes(k.keyword)).map((k) => k.keyword).join(", ")}`}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Calculation ──────────────────────────────────────────────────────── */

export function CalcEditor({ draft, set, sample, onNewNumbers }) {
  const names = detectVariables(draft.prompt);
  const vars = draft.variables;
  const setVar = (n, patch) => set({ variables: { ...vars, [n]: { min: 1, max: 10, decimals: 0, ...vars[n], ...patch } } });
  const res = sample ? evalFormula(draft.formula, sample) : null;

  return (
    <>
      <PromptField value={draft.prompt} onChange={(prompt) => set({ prompt })} autoFocus={!draft.id}
        placeholder="e.g. A car travels {{d}} km in {{t}} hours. What is its average speed in km/h?" />
      <div className="qs-tip"><Lightbulb size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Put each changing number in double curly brackets, like <code>{"{{d}}"}</code>. Every student gets different numbers.</span>
      </div>

      {names.length > 0 && (
        <div className="qs-field">
          <span className="qs-label">Number ranges</span>
          <div className="qs-vars">
            {names.map((n) => {
              const v = { min: 1, max: 10, decimals: 0, ...vars[n] };
              return (
                <div key={n} className="qs-var">
                  <span className="qs-var-name">{n}</span>
                  <label>from<input className="qs-input sm" type="number" value={v.min} onChange={(e) => setVar(n, { min: e.target.value })} /></label>
                  <label>to<input className="qs-input sm" type="number" value={v.max} onChange={(e) => setVar(n, { max: e.target.value })} /></label>
                  <label>decimals<input className="qs-input sm" type="number" min="0" max="4" value={v.decimals} onChange={(e) => setVar(n, { decimals: e.target.value })} /></label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sample && names.length > 0 && (
        <div className="qs-sample">
          Example numbers: {Object.entries(sample).map(([k, v]) => <b key={k}>{k} = {v}</b>)}
          <button type="button" className="cb-btn cb-btn-ghost" style={{ padding: "0.2rem 0.5rem", marginLeft: "auto" }} onClick={onNewNumbers}>
            <RefreshCw size={13} /> New numbers
          </button>
        </div>
      )}

      <div className="qs-field">
        <label>Formula for the right answer</label>
        <input className="qs-input qs-formula" value={draft.formula} placeholder={names.length ? `e.g. ${names.join(" / ")}` : "e.g. d / t"}
          onChange={(e) => set({ formula: e.target.value })} />
        {draft.formula.trim() && res && (
          <span className={`qs-live ${res.error ? "bad" : "ok"}`}>{res.error ? res.error : <>= {res.value} with these numbers</>}</span>
        )}
        <p className="qs-hint">Use + − * / and ** for powers. Also sqrt(), round(), pi, sin(), log().</p>
      </div>

      <div className="qs-field">
        <span className="qs-label">Wrong answers students might give <span className="text-muted" style={{ fontWeight: 500 }}>— makes it multiple choice</span></span>
        {draft.distractors.map((d, i) => {
          const r = d.trim() && sample ? evalFormula(d, sample) : null;
          return (
            <div key={i} className="qs-opt">
              <input className="qs-input qs-formula" value={d} placeholder="e.g. d * t  (a common mistake)"
                onChange={(e) => set({ distractors: draft.distractors.map((x, j) => (j === i ? e.target.value : x)) })} />
              {r && <span className={`qs-live ${r.error ? "bad" : ""}`} style={{ marginTop: 0, whiteSpace: "nowrap" }}>{r.error ? "!" : `= ${r.value}`}</span>}
              <button type="button" className="cb-icon-btn danger" aria-label="Remove" onClick={() => set({ distractors: draft.distractors.length > 1 ? draft.distractors.filter((_, j) => j !== i) : [""] })}><Trash2 size={15} /></button>
            </div>
          );
        })}
        <button type="button" className="qs-addline" onClick={() => set({ distractors: [...draft.distractors, ""] })}><Plus size={14} /> Add wrong answer</button>
        <p className="qs-hint">Leave empty and students type the number instead.</p>
      </div>

      <div className="qs-field" style={{ maxWidth: 220 }}>
        <label>Accept answers within</label>
        <input className="qs-input sm" type="number" step="any" min="0" value={draft.tolerance} onChange={(e) => set({ tolerance: e.target.value })} />
        <p className="qs-hint">e.g. 0.01 accepts 3.14 for π.</p>
      </div>
    </>
  );
}

/* ── Label a picture ──────────────────────────────────────────────────── */

export function ImageEditor({ draft, set }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [over, setOver] = useState(false);
  const [selected, setSelected] = useState(null);
  const [drawing, setDrawing] = useState(null); // {x0,y0,x1,y1} in natural px
  const [natural, setNatural] = useState(null); // {w,h}
  const [scale, setScale] = useState(1);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const dragRef = useRef(null); // moving / resizing a zone
  const labelRefs = useRef({});

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const update = () => img.naturalWidth && setScale(img.clientWidth / img.naturalWidth);
    const ro = new ResizeObserver(update);
    ro.observe(img);
    return () => ro.disconnect();
  }, [draft.background_url]);

  const upload = async (file) => {
    if (!file) return;
    setUploadError(""); setUploading(true);
    try {
      const fd = new FormData(); fd.append("image", file);
      const { data } = await adminAPI.uploadQuizImage(fd);
      set({ background_url: data.url });
    } catch (e) {
      setUploadError(e.response?.data?.detail || "Upload failed.");
    } finally { setUploading(false); }
  };

  const toNatural = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: Math.max(0, (e.clientX - r.left) / scale), y: Math.max(0, (e.clientY - r.top) / scale) };
  };
  const nextId = () => { let n = 1; while (draft.zones.some((z) => z.id === `z${n}`)) n++; return `z${n}`; };
  const updateZone = (id, patch) => set({ zones: draft.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) });

  const onPointerDown = (e) => {
    if (e.target.closest(".qs-zone")) return;
    canvasRef.current.setPointerCapture(e.pointerId);
    const p = toNatural(e);
    setDrawing({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    setSelected(null);
  };
  const onPointerMove = (e) => {
    if (drawing) { const p = toNatural(e); setDrawing((d) => ({ ...d, x1: p.x, y1: p.y })); return; }
    const d = dragRef.current;
    if (!d) return;
    const p = toNatural(e);
    const dx = p.x - d.start.x, dy = p.y - d.start.y;
    const maxW = natural?.w ?? Infinity, maxH = natural?.h ?? Infinity;
    if (d.mode === "move") updateZone(d.id, { x: Math.round(Math.min(Math.max(0, d.zone.x + dx), maxW - d.zone.width)), y: Math.round(Math.min(Math.max(0, d.zone.y + dy), maxH - d.zone.height)) });
    else updateZone(d.id, { width: Math.round(Math.max(24, d.zone.width + dx)), height: Math.round(Math.max(24, d.zone.height + dy)) });
  };
  const onPointerUp = () => {
    if (drawing) {
      const x = Math.min(drawing.x0, drawing.x1), y = Math.min(drawing.y0, drawing.y1);
      let w = Math.abs(drawing.x1 - drawing.x0), h = Math.abs(drawing.y1 - drawing.y0);
      if (w < 12 && h < 12) { w = 110; h = 50; } // a tap makes a default-size spot
      const id = nextId();
      set({ zones: [...draft.zones, { id, x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h), label: "", answer: "" }] });
      setSelected(id);
      setDrawing(null);
      setTimeout(() => labelRefs.current[id]?.focus(), 30);
    }
    dragRef.current = null;
  };
  const startZoneDrag = (e, z, mode) => {
    e.stopPropagation();
    canvasRef.current.setPointerCapture(e.pointerId);
    dragRef.current = { id: z.id, mode, start: toNatural(e), zone: { ...z } };
    setSelected(z.id);
  };

  const box = (z) => ({ left: z.x * scale, top: z.y * scale, width: z.width * scale, height: z.height * scale });
  const drawBox = drawing && {
    x: Math.min(drawing.x0, drawing.x1), y: Math.min(drawing.y0, drawing.y1),
    width: Math.abs(drawing.x1 - drawing.x0), height: Math.abs(drawing.y1 - drawing.y0),
  };

  return (
    <>
      <PromptField label="Instruction" value={draft.prompt} onChange={(prompt) => set({ prompt })} placeholder="e.g. Drag each label to the correct part of the heart." />

      <div className="qs-field">
        <span className="qs-label">Picture</span>
        {!draft.background_url ? (
          <div className={`qs-dropimg ${over ? "over" : ""}`} onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files?.[0]); }}>
            {uploading ? <div className="spinner" /> : <ImagePlus size={28} />}
            <strong>{uploading ? "Uploading…" : "Upload a picture"}</strong>
            <span>Click or drop a JPG, PNG, GIF or WebP (up to 8 MB)</span>
          </div>
        ) : (
          <>
            <div ref={canvasRef} className="qs-canvas"
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
              <img ref={imgRef} src={draft.background_url} alt="" draggable={false}
                onLoad={(e) => { setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight }); setScale(e.target.clientWidth / e.target.naturalWidth); }} />
              {draft.zones.map((z, i) => (
                <div key={z.id} className={`qs-zone ${selected === z.id ? "sel" : ""}`} style={box(z)}
                  onPointerDown={(e) => startZoneDrag(e, z, "move")}>
                  <span className="qs-zone-tag">{i + 1}</span>
                  {z.answer && <span className="qs-zone-label">{z.answer}</span>}
                  <span className="qs-zone-handle" onPointerDown={(e) => startZoneDrag(e, z, "resize")} />
                </div>
              ))}
              {drawBox && <div className="qs-zone drawing" style={box(drawBox)} />}
            </div>
            <p className="qs-hint"><b>Drag on the picture to draw a spot</b> (or tap for a standard one). Drag a spot to move it; drag its corner to resize.</p>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
              <button type="button" className="cb-btn cb-btn-ghost" onClick={() => fileRef.current?.click()}><Upload size={14} /> Change picture</button>
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        {uploadError && <p className="cb-error">{uploadError}</p>}
        {!draft.background_url && (
          <details className="qs-hint" style={{ marginTop: "0.5rem" }}>
            <summary style={{ cursor: "pointer" }}>Or use a picture link</summary>
            <input className="qs-input sm" style={{ marginTop: "0.4rem" }} placeholder="https://…" onBlur={(e) => e.target.value.trim() && set({ background_url: e.target.value.trim() })} />
          </details>
        )}
      </div>

      {draft.zones.length > 0 && (
        <div className="qs-field">
          <span className="qs-label">Label for each spot</span>
          <div className="qs-zone-list">
            {draft.zones.map((z, i) => (
              <div key={z.id} className={`qs-zone-row ${selected === z.id ? "sel" : ""}`} onClick={() => setSelected(z.id)}>
                <span className="qs-zone-tag" style={{ position: "static" }}>{i + 1}</span>
                <input ref={(el) => (labelRefs.current[z.id] = el)} className="qs-input sm" value={z.answer} placeholder="What goes here? e.g. Left ventricle"
                  onFocus={() => setSelected(z.id)} onChange={(e) => updateZone(z.id, { answer: e.target.value })} />
                <button type="button" className="cb-icon-btn danger" aria-label="Delete spot" onClick={(e) => { e.stopPropagation(); set({ zones: draft.zones.filter((x) => x.id !== z.id) }); }}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {draft.background_url && (
        <div className="qs-field">
          <span className="qs-label">Decoy labels <span className="text-muted" style={{ fontWeight: 500 }}>(optional — labels that belong nowhere)</span></span>
          <TagInput values={draft.distractors} onChange={(distractors) => set({ distractors })} placeholder="Type a decoy label and press Enter" />
        </div>
      )}
    </>
  );
}
