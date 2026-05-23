import { useState, useMemo } from "react";
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
// Free numeric input. Backend regenerates variables from `seed` and marks with
// tolerance. We send `{ answer, seed }`. Seed defaults to 0 so server-side
// generation is deterministic.

export function CalculatedMcqQuestion({ question, onAnswer, savedAnswer }) {
  const seed = savedAnswer?.seed ?? 42;
  // Prefer server-rendered variables stored on the question object (set by
  // QuizPlayer after fetching from the API); fall back to client-side
  // generation for admin preview / legacy submissions.
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

  const [value, setValue] = useState(savedAnswer?.answer ?? "");

  const handleChange = (val) => {
    setValue(val);
    // Send variables alongside the answer so the marker (backend or
  // admin preview) can verify against the exact numbers shown on screen.
    onAnswer({ answer: val, seed, variables });
  };

  return (
    <div>
      <p style={{ fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "0.75rem" }}>
        {interpolatedPrompt}
      </p>
      <input
        type="number"
        step="any"
        className="form-control"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Numeric answer"
      />
    </div>
  );
}

// ─── Drag & Drop Word ────────────────────────────────────────────────────────

export function DragDropWordQuestion({ question, onAnswer, savedAnswer }) {
  const { prompt, content } = question;
  const mappings = content.mappings || {};
  const draggableWords = content.draggable_words?.length
    ? content.draggable_words
    : [...new Set(Object.values(mappings))];

  const [slots, setSlots] = useState(savedAnswer?.mappings || {});

  const onDragStart = (e, word) => e.dataTransfer.setData("word", word);
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (e, slotKey) => {
    e.preventDefault();
    const word = e.dataTransfer.getData("word");
    const next = { ...slots, [slotKey]: word };
    setSlots(next);
    onAnswer({ mappings: next });
  };

  const parts = (prompt || "").split(/(\[slot\d+\])/g);

  return (
    <div>
      <div className="text-content" style={{ lineHeight: "2.5", marginBottom: "1.5rem" }}>
        {parts.map((part, i) => {
          const m = part.match(/\[(slot\d+)\]/);
          if (m) {
            const key = m[1];
            const filled = slots[key];
            return (
              <div
                key={i}
                className={`drop-slot ${filled ? "filled" : ""}`}
                onDrop={(e) => onDrop(e, key)}
                onDragOver={onDragOver}
              >
                {filled || ""}
              </div>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>

      <div
        className="words-bank"
        style={{
          padding: "1rem",
          background: "rgba(255,255,255,0.03)",
          borderRadius: "var(--radius-md)",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        {draggableWords.map((word, i) => (
          <div
            key={i}
            className="draggable-item"
            draggable
            onDragStart={(e) => onDragStart(e, word)}
          >
            {word}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Drag & Drop Image (zones + items schema, matches admin authoring) ───────

export function DragDropImageQuestion({ question, onAnswer, savedAnswer }) {
  const content = question.content || {};
  const background = content.background_url || content.background_image || "";
  const zones = content.zones || [];
  const items = content.items || [];

  const [placements, setPlacements] = useState(savedAnswer?.placements || {});

  const onDragStart = (e, itemId) => e.dataTransfer.setData("itemId", itemId);
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (e, zoneId) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("itemId");
    if (!itemId) return;
    const next = { ...placements, [itemId]: zoneId };
    setPlacements(next);
    onAnswer({ placements: next });
  };

  // Items not yet placed remain in the bank
  const unplaced = items.filter((it) => !placements[it.id]);

  // Map zoneId -> [items placed there] so we render labels on zones
  const itemsByZone = items.reduce((acc, it) => {
    const z = placements[it.id];
    if (!z) return acc;
    (acc[z] ||= []).push(it);
    return acc;
  }, {});

  return (
    <div>
      <div
        className="picture-bank"
        style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
      >
        {unplaced.map((it) => (
          <div
            key={it.id}
            className="draggable-item"
            draggable
            onDragStart={(e) => onDragStart(e, it.id)}
          >
            {it.label}
          </div>
        ))}
        {unplaced.length === 0 && (
          <span className="text-muted" style={{ fontSize: "0.85rem" }}>
            All items placed — drag from a zone to move them.
          </span>
        )}
      </div>

      <div
        className="picture-canvas"
        onDragOver={onDragOver}
        style={{
          position: "relative",
          border: "1px solid var(--clr-border)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          background: "var(--clr-bg)",
        }}
      >
        {background && (
          <img
            src={background}
            alt="Question background"
            style={{ width: "100%", display: "block" }}
            onError={(e) => (e.target.style.display = "none")}
          />
        )}
        {zones.map((z) => {
          const filled = itemsByZone[z.id] || [];
          return (
            <div
              key={z.id}
              className={`drop-zone ${filled.length ? "filled" : ""}`}
              onDrop={(e) => onDrop(e, z.id)}
              onDragOver={onDragOver}
              style={{
                position: "absolute",
                left: `${z.x}px`,
                top: `${z.y}px`,
                width: `${z.width}px`,
                height: `${z.height}px`,
                border: `2px dashed ${filled.length ? "var(--clr-success)" : "var(--clr-primary)"}`,
                borderRadius: 4,
                background: filled.length ? "rgba(34,197,94,0.15)" : "rgba(108,99,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                color: "var(--clr-heading)",
                padding: 2,
                textAlign: "center",
              }}
              title={z.label}
            >
              {filled.length
                ? filled.map((it) => (
                    <span
                      key={it.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, it.id)}
                      style={{ cursor: "grab" }}
                    >
                      {it.label}
                    </span>
                  ))
                : z.label || z.id}
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
