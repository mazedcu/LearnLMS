import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { adminAPI } from "../../../../api";
import QuestionRenderer, { TYPES_EMBEDDING_PROMPT } from "../../../quiz/QuestionRenderer";
import { TYPE_LABELS } from "./types";
import { markLocally } from "./markLocally";

/**
 * Admin "Try It" preview. Renders each question with the SAME `QuestionRenderer`
 * the student player uses, so the admin sees the actual student experience.
 *
 * Adds admin-only chrome on top: per-question result chip, feedback string,
 * a Submit button (client-side marking, no submission saved), and Try Again.
 *
 * After submit we render a transparent overlay so users can't keep editing
 * answers post-marking — `QuestionRenderer` itself doesn't have a "disabled"
 * concept, and forking it would defeat the whole point of sharing one
 * component with the student player.
 */

function ResultChip({ result }) {
  if (!result) return null;
  const passed = result.marks === result.max;
  const partial = result.marks > 0 && !passed;
  const bg = passed
    ? "rgba(34,197,94,0.15)"
    : partial
    ? "rgba(245,158,11,0.18)"
    : "rgba(239,68,68,0.12)";
  const fg = passed ? "var(--clr-success)" : partial ? "orange" : "var(--clr-danger)";
  return (
    <span
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        padding: "2px 10px",
        borderRadius: 4,
        background: bg,
        color: fg,
      }}
    >
      {result.marks}/{result.max}
    </span>
  );
}

function questionBorderColor(result) {
  if (!result) return "var(--clr-border)";
  if (result.marks === result.max) return "var(--clr-success)";
  if (result.marks > 0) return "orange";
  return "var(--clr-danger)";
}

export default function QuizPreview({ quiz, onClose }) {
  const { data: questionsRaw, isLoading } = useQuery({
    queryKey: ["questions-admin", quiz.id],
    queryFn: () =>
      adminAPI.getQuestions(quiz.id).then((r) => {
        const d = r.data;
        return Array.isArray(d) ? d : d?.results || [];
      }),
  });
  const questions = questionsRaw || [];

  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);

  // QuestionRenderer's `onAnswer` is per-question; build a stable factory.
  const makeOnAnswer = useCallback(
    (qId) => (payload) => setAnswers((a) => ({ ...a, [qId]: payload })),
    []
  );

  const handleSubmit = () => {
    const qResults = questions.map((q) => ({
      id: q.id,
      ...markLocally(q, answers[q.id] || {}),
    }));
    const totalMarks = qResults.reduce((s, r) => s + r.max, 0);
    const scored = qResults.reduce((s, r) => s + r.marks, 0);
    const pct = totalMarks > 0 ? Math.round((scored / totalMarks) * 100) : 0;
    setResults({
      questions: qResults,
      scored,
      totalMarks,
      pct,
      passed: pct >= quiz.passing_score,
    });
  };

  const handleRetry = () => {
    setAnswers({});
    setResults(null);
  };

  const resultsById = useMemo(() => {
    if (!results) return {};
    return Object.fromEntries(results.questions.map((r) => [r.id, r]));
  }, [results]);

  const submitted = !!results;

  return (
    <div
      style={{
        padding: "1rem",
        background: "rgba(108,99,255,0.04)",
        border: "1px solid rgba(108,99,255,0.25)",
        borderRadius: "var(--radius-md)",
        marginTop: "0.5rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h5 style={{ margin: 0, color: "var(--clr-primary)" }}>{quiz.title} — Try It</h5>
          <p className="text-muted" style={{ fontSize: "0.7rem", margin: "0.25rem 0 0" }}>
            {questions.length} question{questions.length !== 1 ? "s" : ""} · Passing:{" "}
            {quiz.passing_score}%{quiz.time_limit_mins ? ` · ${quiz.time_limit_mins} min` : ""} ·{" "}
            <em>Renders the student view (client-side marking, no submission saved)</em>
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onClose}>
          <X size={13} /> Close
        </button>
      </div>

      {results && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            borderRadius: "var(--radius-sm)",
            background: results.passed ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
            border: `1.5px solid ${results.passed ? "var(--clr-success)" : "var(--clr-danger)"}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p
                style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: results.passed ? "var(--clr-success)" : "var(--clr-danger)",
                }}
              >
                {results.passed ? "PASSED" : "FAILED"} — {results.pct}%
              </p>
              <p className="text-muted" style={{ fontSize: "0.75rem", margin: "0.25rem 0 0" }}>
                {results.scored} / {results.totalMarks} marks · Pass threshold: {quiz.passing_score}%
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleRetry}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="spinner" style={{ margin: "1rem auto" }} />}

      {questions.map((q, idx) => {
        const r = resultsById[q.id];
        const showPromptHeading = !TYPES_EMBEDDING_PROMPT.has(q.question_type);
        return (
          <div
            key={q.id}
            style={{
              padding: "1rem",
              background: "var(--clr-bg)",
              borderRadius: "var(--radius-sm)",
              marginBottom: "0.75rem",
              border: `1.5px solid ${questionBorderColor(r)}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.5rem",
              }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--clr-heading)" }}>
                Q{idx + 1}.
              </span>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: "0.65rem",
                    background: "rgba(108,99,255,0.12)",
                    color: "var(--clr-primary)",
                    padding: "1px 8px",
                    borderRadius: "4px",
                    fontWeight: 600,
                  }}
                >
                  {TYPE_LABELS[q.question_type] || q.question_type}
                </span>
                {r ? (
                  <ResultChip result={r} />
                ) : (
                  <span style={{ fontSize: "0.65rem", color: "var(--clr-muted)" }}>
                    {q.max_marks} mk{q.max_marks > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {showPromptHeading && (
              <p style={{ fontSize: "0.9rem", margin: "0 0 0.75rem", lineHeight: 1.5 }}>
                {q.prompt}
              </p>
            )}

            <div style={{ position: "relative" }}>
              <QuestionRenderer
                question={q}
                onAnswer={makeOnAnswer(q.id)}
                savedAnswer={answers[q.id]}
              />
              {/* Lock interaction after submission so admin can't edit answers
                  while results are shown. */}
              {submitted && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    cursor: "not-allowed",
                  }}
                  aria-hidden="true"
                />
              )}
            </div>

            {r?.feedback && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: r.marks === r.max ? "var(--clr-success)" : "var(--clr-danger)",
                  marginTop: "0.5rem",
                  fontStyle: "italic",
                }}
              >
                {r.feedback}
              </p>
            )}
          </div>
        );
      })}

      {!isLoading && questions.length === 0 && (
        <p className="text-muted" style={{ textAlign: "center", padding: "1.5rem", fontSize: "0.85rem" }}>
          This quiz has no questions yet.
        </p>
      )}

      {!submitted && questions.length > 0 && (
        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: "0.5rem" }}
          onClick={handleSubmit}
        >
          Submit & Check Results
        </button>
      )}
    </div>
  );
}
