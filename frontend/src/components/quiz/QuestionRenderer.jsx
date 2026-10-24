import { useState, useMemo, useRef, useEffect } from "react";
import { generateVariables, interpolatePrompt } from "./calcVariables";

/**
 * Canonical student-facing question renderer.
 *
 * Type identifiers match the backend `Question.Type` enum exactly:
 *   mcq · fill_blanks · keyword_match · calculated_mcq ·
 *   drag_drop_word · drag_drop_image
 *
 * Legacy identifiers (`qa_keywords`, `drag_drop_picture`) are accepted as
 * aliases so historical content keeps rendering.
 */

// ─── MCQ ─────────────────────────────────────────────────────────────────────

export function MCQQuestion({ question, onAnswer, savedAnswer }) {
  const options = question.content.options || [];
  const isMultiple = !!question.content.is_multiple;
  const [selected, setSelected] = useState(
    savedAnswer?.answer ?? (isMultiple ? [] : null)
  );

  const toggle = (opt) => {
    let next;
    if (isMultiple) {
      next = selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt];
    } else {
      next = opt;
    }
    setSelected(next);
    onAnswer({ answer: next });
  };

  return (
    <div className="options-grid">
      {options.map((opt, i) => {
        const isSelected = isMultiple ? selected.includes(opt) : selected === opt;
        return (
          <div
            key={i}
            className={`option-item ${isSelected ? "selected" : ""}`}
            onClick={() => toggle(opt)}
          >
            <div className="radio-circle">{isSelected && <div className="inner-dot" />}</div>
            <span>{opt}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Fill in the Blanks ──────────────────────────────────────────────────────
// Accepts both `[blank1]` and `{{blank1}}` placeholder syntax for compatibility.

const BLANK_SPLIT_RE = /(\[blank\d+\]|\{\{blank\d+\}\})/g;
const BLANK_MATCH_RE = /^(?:\[(blank\d+)\]|\{\{(blank\d+)\}\})$/;

export function FillBlanksQuestion({ question, onAnswer, savedAnswer }) {
  const [blanks, setBlanks] = useState(savedAnswer?.blanks || {});

  const handleChange = (key, val) => {
    const next = { ...blanks, [key]: val };
    setBlanks(next);
    onAnswer({ blanks: next });
  };

  const parts = (question.prompt || "").split(BLANK_SPLIT_RE);

  return (
    <div className="fill-blanks-container" style={{ lineHeight: "2.5" }}>
      {parts.map((part, i) => {
        const m = part.match(BLANK_MATCH_RE);
        if (m) {
          const key = m[1] || m[2];
          return (
            <input
              key={i}
              className="blank-input"
              value={blanks[key] || ""}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder=""
            />
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

// ─── Keyword Match (free-text scored by keyword presence) ────────────────────

export function KeywordMatchQuestion({ question, onAnswer, savedAnswer }) {
  const [text, setText] = useState(savedAnswer?.answer || "");
  const handleChange = (val) => {
    setText(val);
    onAnswer({ answer: val });
  };
  return (
    <div className="qa-keywords-container" style={{ marginTop: "1rem" }}>
      <textarea
        className="form-control"
        rows={6}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Type your answer here..."
        style={{ background: "rgba(255,255,255,0.02)", resize: "vertical" }}
      />
      <p className="text-muted" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
        Tip: include the key concepts in your answer.
      </p>
    </div>
  );
}

// ─── Calculated MCQ ──────────────────────────────────────────────────────────
// Numbers in the prompt are generated per student. When the teacher added
// wrong-answer formulas, the server sends shuffled options (`_options`) and the
// student picks one; otherwise they type the number.

// Teacher preview only: the admin has the formula, so build options locally.
function previewOptions(content, variables) {
  const distractors = (content?.distractors || []).filter((d) => String(d).trim());
  if (!content?.formula || !distractors.length) return null;
  const evalF = (f) => {
    try {
      // eslint-disable-next-line no-new-func
      const v = Number(new Function(...Object.keys(variables), "Math", `return ${f}`)(...Object.values(variables), Math));
      return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null;
    } catch { return null; }
  };
  const vals = [evalF(content.formula), ...distractors.map(evalF)].filter((v) => v !== null);
  const unique = vals.filter((v, i) => vals.findIndex((x) => Math.abs(x - v) < 1e-9) === i);
  return unique.length > 1 ? unique.sort(() => 0.5 - Math.random()) : null;
}

export function CalculatedMcqQuestion({ question, onAnswer, savedAnswer }) {
  const seed = savedAnswer?.seed ?? 42;
  const variables = useMemo(() => {
    if (question._renderedVariables && Object.keys(question._renderedVariables).length) {
      return question._renderedVariables;
    }
    return generateVariables(question.content, seed);
  }, [question.content, question._renderedVariables, seed]);

  const interpolatedPrompt = useMemo(
    () => interpolatePrompt(question.prompt, variables),
    [question.prompt, variables]
  );
  const options = useMemo(
    () => question._options || (question._renderedVariables ? null : previewOptions(question.content, variables)),
    [question._options, question._renderedVariables, question.content, variables]
  );

  const [value, setValue] = useState(savedAnswer?.answer ?? "");
  const choose = (val) => {
    setValue(val);
    onAnswer({ answer: val, seed, variables });
  };

  return (
    <div>
      <p style={{ fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "0.75rem" }}>
        {interpolatedPrompt}
      </p>
      {options ? (
        <div className="options-grid" style={{ marginTop: "0.5rem" }}>
          {options.map((opt, i) => {
            const selected = String(value) === String(opt);
            return (
              <div key={i} className={`option-item ${selected ? "selected" : ""}`} onClick={() => choose(opt)} role="radio" aria-checked={selected} tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && choose(opt)}>
                <div className="radio-circle">{selected && <div className="inner-dot" />}</div>
                <span>{opt}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <input
          type="number"
          step="any"
          inputMode="decimal"
          className="form-control"
          value={value}
          onChange={(e) => choose(e.target.value)}
          placeholder="Your answer"
        />
      )}
    </div>
  );
}

// ─── Drag & Drop Word ────────────────────────────────────────────────────────
// Works with a mouse (drag) and on phones (tap a word, then tap a gap).
// Tapping a filled gap empties it.

export function DragDropWordQuestion({ question, onAnswer, savedAnswer }) {
  const { prompt, content } = question;
  const mappings = content.mappings || {};
  const draggableWords = content.draggable_words?.length
    ? content.draggable_words
    : [...new Set(Object.values(mappings))];

  const [slots, setSlots] = useState(savedAnswer?.mappings || {});
  const [picked, setPicked] = useState(null); // word chosen by tapping

  const place = (slotKey, word) => {
    const next = { ...slots };
    if (word) next[slotKey] = word; else delete next[slotKey];
    setSlots(next);
    setPicked(null);
    onAnswer({ mappings: next });
  };

  const onDragStart = (e, word) => { e.dataTransfer.setData("word", word); setPicked(null); };
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (e, slotKey) => {
    e.preventDefault();
    const word = e.dataTransfer.getData("word");
    if (word) place(slotKey, word);
  };
  const onSlotTap = (slotKey) => {
    if (picked) place(slotKey, picked);
    else if (slots[slotKey]) place(slotKey, null);
  };

  const parts = (prompt || "").split(/(\[slot\d+\])/g);

  return (
    <div>
      <div className="text-content" style={{ lineHeight: "2.5", marginBottom: "1rem" }}>
        {parts.map((part, i) => {
          const m = part.match(/\[(slot\d+)\]/);
          if (m) {
            const key = m[1];
            const filled = slots[key];
            return (
              <button
                type="button"
                key={i}
                className={`drop-slot ${filled ? "filled" : ""} ${picked ? "awaiting" : ""}`}
                onDrop={(e) => onDrop(e, key)}
                onDragOver={onDragOver}
                onClick={() => onSlotTap(key)}
                title={filled ? "Tap to remove" : picked ? `Place "${picked}" here` : "Choose a word first"}
              >
                {filled || "\u00a0"}
              </button>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>

      <p className="text-muted" style={{ fontSize: "0.78rem", marginBottom: "0.5rem" }}>
        {picked ? `Now tap a gap to place "${picked}".` : "Drag a word into a gap, or tap a word and then tap a gap."}
      </p>
      <div className="words-bank">
        {draggableWords.map((word, i) => (
          <button
            type="button"
            key={i}
            className={`draggable-item ${picked === word ? "picked" : ""}`}
            draggable
            onDragStart={(e) => onDragStart(e, word)}
            onClick={() => setPicked(picked === word ? null : word)}
            aria-pressed={picked === word}
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Drag & Drop Image (zones + items schema, matches admin authoring) ───────
// Zone x/y/width/height are pixels on the original image; they are scaled to
// the size the picture is shown at, so they line up on phones too.
// Works with drag, or tap a label then tap a zone; tap a placed label to take it back.

export function DragDropImageQuestion({ question, onAnswer, savedAnswer }) {
  const content = question.content || {};
  const background = content.background_url || content.background_image || "";
  const zones = content.zones || [];
  const items = content.items || [];
  const [placements, setPlacements] = useState(savedAnswer?.placements || {});
  const [picked, setPicked] = useState(null);
  const [scale, setScale] = useState(1);
  const imgRef = useRef(null);

  // Keep zones aligned with the picture as it resizes
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const update = () => {
      if (img.naturalWidth) setScale(img.clientWidth / img.naturalWidth);
    };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(img);
    return () => ro?.disconnect();
  }, [background]);

  const setPlacement = (itemId, zoneId) => {
    const next = { ...placements };
    if (zoneId) next[itemId] = zoneId; else delete next[itemId];
    setPlacements(next);
    setPicked(null);
    onAnswer({ placements: next });
  };

  const onDragStart = (e, itemId) => { e.dataTransfer.setData("itemId", itemId); setPicked(null); };
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (e, zoneId) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("itemId");
    if (itemId) setPlacement(itemId, zoneId);
  };

  const unplaced = items.filter((it) => !placements[it.id]);
  const itemsByZone = items.reduce((acc, it) => {
    const z = placements[it.id];
    if (!z) return acc;
    (acc[z] ||= []).push(it);
    return acc;
  }, {});
  const pickedItem = items.find((it) => it.id === picked);

  return (
    <div>
      {unplaced.length > 0 && (
        <p className="text-muted" style={{ fontSize: "0.78rem", marginBottom: "0.5rem" }}>
          {pickedItem ? `Now tap the spot for "${pickedItem.label}".` : "Drag each label onto the picture, or tap a label and then tap a spot."}
        </p>
      )}
      <div className="picture-bank" style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", minHeight: 40 }}>
        {unplaced.map((it) => (
          <button
            type="button"
            key={it.id}
            className={`draggable-item ${picked === it.id ? "picked" : ""}`}
            draggable
            onDragStart={(e) => onDragStart(e, it.id)}
            onClick={() => setPicked(picked === it.id ? null : it.id)}
            aria-pressed={picked === it.id}
          >
            {it.label}
          </button>
        ))}
        {unplaced.length === 0 && (
          <span className="text-muted" style={{ fontSize: "0.85rem" }}>
            All labels placed — tap one on the picture to take it back.
          </span>
        )}
      </div>
      <div
        className="picture-canvas"
        onDragOver={onDragOver}
        style={{ position: "relative", border: "1px solid var(--clr-border)", borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--clr-bg)" }}
      >
        {background && (
          <img
            ref={imgRef}
            src={background}
            alt="Question picture"
            style={{ width: "100%", display: "block" }}
            onLoad={(e) => { if (e.target.naturalWidth) setScale(e.target.clientWidth / e.target.naturalWidth); }}
            onError={(e) => (e.target.style.display = "none")}
          />
        )}
        {zones.map((z, idx) => {
          const filled = itemsByZone[z.id] || [];
          return (
            <div
              key={z.id}
              className={`drop-zone ${filled.length ? "filled" : ""} ${picked ? "awaiting" : ""}`}
              onDrop={(e) => onDrop(e, z.id)}
              onDragOver={onDragOver}
              onClick={() => { if (picked) setPlacement(picked, z.id); }}
              role="button"
              aria-label={z.label || `Spot ${idx + 1}`}
              style={{
                position: "absolute",
                left: `${(Number(z.x) || 0) * scale}px`,
                top: `${(Number(z.y) || 0) * scale}px`,
                width: `${(Number(z.width) || 80) * scale}px`,
                height: `${(Number(z.height) || 60) * scale}px`,
                border: `2px dashed ${filled.length ? "var(--clr-success)" : "var(--clr-primary)"}`,
                borderRadius: 6,
                background: filled.length ? "rgba(34,197,94,0.18)" : "rgba(108,99,255,0.10)",
                display: "flex", flexWrap: "wrap", gap: 4,
                alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", color: "var(--clr-heading)", padding: 2, textAlign: "center",
                cursor: picked ? "pointer" : "default",
              }}
            >
              {filled.length
                ? filled.map((it) => (
                    <button
                      type="button"
                      key={it.id}
                      className="zone-chip"
                      draggable
                      onDragStart={(e) => onDragStart(e, it.id)}
                      onClick={(e) => { e.stopPropagation(); setPlacement(it.id, null); }}
                      title="Tap to take back"
                    >
                      {it.label}
                    </button>
                  ))
                : (z.label || "")}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

/**
 * Types whose renderer embeds the prompt text inline (parsed for placeholders).
 * Containers should NOT also render the prompt as a heading above the renderer
 * for these types, or it will appear twice.
 */
export const TYPES_EMBEDDING_PROMPT = new Set([
  "fill_blanks",
  "drag_drop_word",
  "calculated_mcq",
]);

const RENDERERS = {
  mcq: MCQQuestion,
  fill_blanks: FillBlanksQuestion,
  keyword_match: KeywordMatchQuestion,
  qa_keywords: KeywordMatchQuestion, // legacy alias
  calculated_mcq: CalculatedMcqQuestion,
  drag_drop_word: DragDropWordQuestion,
  drag_drop_image: DragDropImageQuestion,
  drag_drop_picture: DragDropImageQuestion, // legacy alias
};

export default function QuestionRenderer({ question, onAnswer, savedAnswer }) {
  const Component = RENDERERS[question.question_type];
  if (!Component) {
    return (
      <div className="alert alert-warning">
        Unsupported question type: {question.question_type}
      </div>
    );
  }
  return <Component question={question} onAnswer={onAnswer} savedAnswer={savedAnswer} />;
}
