import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { adminAPI } from "../../../../api";
import { apiErrorMessage } from "../apiError";
import { QUESTION_TYPES, PROMPT_PLACEHOLDERS } from "./types";
import McqEditor from "./editors/McqEditor";
import FillBlanksEditor from "./editors/FillBlanksEditor";
import KeywordMatchEditor from "./editors/KeywordMatchEditor";
import CalculatedMcqEditor from "./editors/CalculatedMcqEditor";
import DragDropWordEditor from "./editors/DragDropWordEditor";
import DragDropImageEditor from "./editors/DragDropImageEditor";

// ─── Default content per question type ──────────────────────────────────────
const DEFAULTS = {
  mcq: () => ({ options: ["", ""], correctIndex: -1 }),
  fill_blanks: () => [{ key: "blank1", answer: "" }],
  keyword_match: () => [{ keyword: "", weight: 0, case_sensitive: false }],
  calculated_mcq: () => ({ variables: {}, formula: "", tolerance: 0.01, distractors: [""] }),
  drag_drop_word: () => ({ draggable_words: [], mappings: {} }),
  drag_drop_image: () => ({ background_url: "", zones: [], items: [] }),
};

// ─── Hydrate existing question content back into editor state ───────────────
function parseExisting(q) {
  if (!q) return null;
  const r = { ...q };
  const c = q.content || {};
  switch (q.question_type) {
    case "mcq": {
      const opts = c.options || ["", ""];
      r._mcq = { options: opts, correctIndex: opts.indexOf(c.correct_answer ?? "") };
      break;
    }
    case "fill_blanks": {
      const list = Object.entries(c.blanks || {}).map(([key, answer]) => ({ key, answer }));
      r._blanks = list.length ? list : DEFAULTS.fill_blanks();
      break;
    }
    case "keyword_match":
      r._keywords = c.keywords?.length ? c.keywords : DEFAULTS.keyword_match();
      break;
    case "calculated_mcq":
      r._calc = {
        variables: c.variables || {},
        formula: c.formula || "",
        tolerance: c.tolerance ?? 0.01,
        distractors: c.distractors || [""],
      };
      break;
    case "drag_drop_word":
      r._ddw = { draggable_words: c.draggable_words || [], mappings: c.mappings || {} };
      break;
    case "drag_drop_image":
      r._ddi = {
        background_url: c.background_url || "",
        zones: c.zones || [],
        items: c.items || [],
      };
      break;
    default:
      break;
  }
  return r;
}

// ─── Build the API payload for each type, with validation ───────────────────
function buildContent(qtype, state, marks) {
  const { mcq, blanks, keywords, calc, ddw, ddi } = state;
  switch (qtype) {
    case "mcq": {
      const filtered = mcq.options.filter((o) => o.trim());
      if (filtered.length < 2) return { error: "At least 2 options required." };
      if (mcq.correctIndex < 0 || mcq.correctIndex >= mcq.options.length)
        return { error: "Select the correct answer." };
      return { content: { options: filtered, correct_answer: mcq.options[mcq.correctIndex] } };
    }
    case "fill_blanks": {
      const valid = blanks.filter((b) => b.key.trim() && b.answer.trim());
      if (!valid.length) return { error: "Add at least one blank with an answer." };
      return { content: { blanks: Object.fromEntries(valid.map((b) => [b.key, b.answer])) } };
    }
    case "keyword_match": {
      const valid = keywords.filter((k) => k.keyword.trim());
      if (!valid.length) return { error: "Add at least one keyword." };
      const totalW = valid.reduce((s, k) => s + (parseFloat(k.weight) || 0), 0);
      if (Math.abs(totalW - marks) > 0.01)
        return { error: `Keyword weights (${totalW}) must total ${marks} marks.` };
      return { content: { keywords: valid } };
    }
    case "calculated_mcq": {
      if (!calc.formula.trim()) return { error: "Formula is required." };
      if (Object.keys(calc.variables).length === 0)
        return { error: "Add at least one variable." };
      return { content: { ...calc, distractors: calc.distractors.filter((d) => d.trim()) } };
    }
    case "drag_drop_word": {
      if (!ddw.draggable_words.length) return { error: "Add draggable words." };
      if (!Object.keys(ddw.mappings).length) return { error: "Add at least one slot mapping." };
      return { content: ddw };
    }
    case "drag_drop_image": {
      if (!ddi.background_url.trim()) return { error: "Background image URL required." };
      if (!ddi.zones.length) return { error: "Add at least one drop zone." };
      if (!ddi.items.length) return { error: "Add at least one draggable item." };
      return { content: ddi };
    }
    default:
      return { content: {} };
  }
}

export default function QuestionForm({ quizId, question, onCancel, onSuccess }) {
  const existing = parseExisting(question);

  const [qtype, setQtype] = useState(existing?.question_type || "mcq");
  const [prompt, setPrompt] = useState(existing?.prompt || "");
  const [marks, setMarks] = useState(existing?.max_marks ?? 1);
  const [order, setOrder] = useState(existing?.order ?? 0);

  const [mcq, setMcq] = useState(existing?._mcq || DEFAULTS.mcq());
  const [blanks, setBlanks] = useState(existing?._blanks || DEFAULTS.fill_blanks());
  const [keywords, setKeywords] = useState(existing?._keywords || DEFAULTS.keyword_match());
  const [calc, setCalc] = useState(existing?._calc || DEFAULTS.calculated_mcq());
  const [ddw, setDdw] = useState(existing?._ddw || DEFAULTS.drag_drop_word());
  const [ddi, setDdi] = useState(existing?._ddi || DEFAULTS.drag_drop_image());

  const [error, setError] = useState(null);

  const save = useMutation({
    mutationFn: (payload) =>
      question?.id ? adminAPI.updateQuestion(question.id, payload) : adminAPI.createQuestion(quizId, payload),
    onSuccess: () => onSuccess(),
    onError: (err) => setError(apiErrorMessage(err, "Failed to save question.")),
  });

  const handleSave = () => {
    setError(null);
    if (!prompt.trim()) {
      setError("Prompt is required.");
      return;
    }
    const result = buildContent(qtype, { mcq, blanks, keywords, calc, ddw, ddi }, marks);
    if (result.error) {
      setError(result.error);
      return;
    }
    save.mutate({
      question_type: qtype,
      prompt: prompt.trim(),
      content: result.content,
      max_marks: marks,
      order,
    });
  };

  return (
    <div style={{ padding: "1rem", background: "rgba(108,99,255,0.04)", border: "1px solid rgba(108,99,255,0.2)", borderRadius: "var(--radius-md)", marginBottom: "1rem" }}>
      <h6 style={{ margin: "0 0 1rem", color: "var(--clr-primary)" }}>
        {question?.id ? "Edit Question" : "New Question"}
      </h6>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <div className="form-group" style={{ margin: 0, flex: 1 }}>
          <label className="form-label" style={{ fontSize: "0.7rem" }}>Type</label>
          <select
            className="form-control"
            style={{ fontSize: "0.8rem" }}
            value={qtype}
            onChange={(e) => {
              setQtype(e.target.value);
              setError(null);
            }}
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, flex: "0 0 80px" }}>
          <label className="form-label" style={{ fontSize: "0.7rem" }}>Marks</label>
          <input
            className="form-control"
            style={{ fontSize: "0.8rem" }}
            type="number"
            min={1}
            value={marks}
            onChange={(e) => setMarks(Number(e.target.value) || 1)}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "0 0 70px" }}>
          <label className="form-label" style={{ fontSize: "0.7rem" }}>Order</label>
          <input
            className="form-control"
            style={{ fontSize: "0.8rem" }}
            type="number"
            min={0}
            value={order}
            onChange={(e) => setOrder(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: "0.75rem" }}>
        <label className="form-label" style={{ fontSize: "0.7rem" }}>Question Prompt</label>
        <textarea
          className="form-control"
          rows={2}
          style={{ fontSize: "0.85rem" }}
          placeholder={PROMPT_PLACEHOLDERS[qtype] || ""}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {qtype === "mcq" && (
        <McqEditor
          options={mcq.options}
          correctIndex={mcq.correctIndex}
          onChange={(opts, ci) => setMcq({ options: opts, correctIndex: ci })}
        />
      )}
      {qtype === "fill_blanks" && <FillBlanksEditor blanks={blanks} onChange={setBlanks} />}
      {qtype === "keyword_match" && (
        <KeywordMatchEditor keywords={keywords} maxMarks={marks} onChange={setKeywords} />
      )}
      {qtype === "calculated_mcq" && <CalculatedMcqEditor calcData={calc} onChange={setCalc} />}
      {qtype === "drag_drop_word" && <DragDropWordEditor ddw={ddw} onChange={setDdw} />}
      {qtype === "drag_drop_image" && <DragDropImageEditor ddi={ddi} onChange={setDdi} />}

      {error && (
        <p style={{ fontSize: "0.75rem", color: "var(--clr-danger)", marginTop: "0.75rem" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={save.isPending}>
          <Save size={13} /> {save.isPending ? "Saving..." : "Save Question"}
        </button>
        <button className="btn btn-outline btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
