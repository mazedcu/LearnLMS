import { Edit2, Trash2 } from "lucide-react";
import { TYPE_LABELS } from "./types";

function McqSummary({ content }) {
  return (
    <div style={{ marginTop: "0.375rem", paddingLeft: "0.5rem" }}>
      {content.options.map((opt, i) => (
        <p
          key={i}
          style={{
            fontSize: "0.75rem",
            margin: "2px 0",
            color: opt === content.correct_answer ? "var(--clr-success)" : "var(--clr-muted)",
          }}
        >
          {opt === content.correct_answer ? "✓ " : "○ "}{opt}
        </p>
      ))}
    </div>
  );
}

function BlanksSummary({ content }) {
  return (
    <div style={{ marginTop: "0.375rem", paddingLeft: "0.5rem" }}>
      {Object.entries(content.blanks).map(([k, v]) => (
        <p key={k} style={{ fontSize: "0.75rem", margin: "2px 0", color: "var(--clr-muted)" }}>
          <code>{`{{${k}}}`}</code> ={" "}
          <strong style={{ color: "var(--clr-success)" }}>{v}</strong>
        </p>
      ))}
    </div>
  );
}

function KeywordsSummary({ content }) {
  return (
    <div style={{ marginTop: "0.375rem", paddingLeft: "0.5rem", display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
      {content.keywords.map((kw, i) => (
        <span key={i} style={{ fontSize: "0.7rem", background: "rgba(0,212,170,0.12)", padding: "1px 6px", borderRadius: "4px" }}>
          {kw.keyword} <small style={{ opacity: 0.7 }}>({kw.weight})</small>
        </span>
      ))}
    </div>
  );
}

function CalcSummary({ content }) {
  return (
    <p style={{ fontSize: "0.7rem", margin: "0.375rem 0 0 0.5rem", fontFamily: "monospace", color: "var(--clr-muted)" }}>
      f = {content.formula || "?"} &nbsp; tol={content.tolerance}
    </p>
  );
}

function DdwSummary({ content }) {
  return (
    <div style={{ marginTop: "0.375rem", paddingLeft: "0.5rem" }}>
      {Object.entries(content.mappings).map(([s, w]) => (
        <p key={s} style={{ fontSize: "0.7rem", margin: "2px 0", color: "var(--clr-muted)" }}>
          [{s}] → <strong style={{ color: "var(--clr-success)" }}>{w}</strong>
        </p>
      ))}
    </div>
  );
}

function DdiSummary({ content }) {
  return (
    <div style={{ marginTop: "0.375rem", paddingLeft: "0.5rem" }}>
      <p style={{ fontSize: "0.7rem", color: "var(--clr-muted)", margin: "2px 0" }}>
        {content.zones?.length || 0} zones · {content.items?.length || 0} items
      </p>
    </div>
  );
}

const SUMMARIES = {
  mcq: (c) => c.options && <McqSummary content={c} />,
  fill_blanks: (c) => c.blanks && <BlanksSummary content={c} />,
  keyword_match: (c) => c.keywords && <KeywordsSummary content={c} />,
  calculated_mcq: (c) => <CalcSummary content={c} />,
  drag_drop_word: (c) => c.mappings && <DdwSummary content={c} />,
  drag_drop_image: (c) => <DdiSummary content={c} />,
};

export default function QuestionCard({ q, onEdit, onDelete }) {
  const typeLabel = TYPE_LABELS[q.question_type] || q.question_type;
  const content = q.content || {};
  const renderSummary = SUMMARIES[q.question_type];

  return (
    <div style={{ padding: "0.75rem", background: "var(--clr-bg)", borderRadius: "var(--radius-sm)", marginBottom: "0.5rem", border: "1px solid var(--clr-border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.375rem" }}>
            <span style={{ background: "rgba(108,99,255,0.15)", color: "var(--clr-primary)", borderRadius: "4px", padding: "1px 8px", fontSize: "0.65rem", fontWeight: 700 }}>
              {typeLabel}
            </span>
            <span className="text-muted" style={{ fontSize: "0.65rem" }}>
              {q.max_marks} mark{q.max_marks > 1 ? "s" : ""}
            </span>
          </div>
          <p style={{ fontSize: "0.8rem", margin: 0 }}>{q.prompt}</p>
          {renderSummary?.(content)}
        </div>
        <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
          <button className="btn btn-outline btn-sm" style={{ padding: "0.2rem 0.4rem" }} onClick={onEdit}>
            <Edit2 size={11} />
          </button>
          <button className="btn btn-danger btn-sm" style={{ padding: "0.2rem 0.4rem" }} onClick={onDelete}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
