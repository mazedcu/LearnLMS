import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Eye, CheckCircle, RotateCcw } from "lucide-react";
import { adminAPI } from "../../../api";
import QuestionRenderer, { TYPES_EMBEDDING_PROMPT } from "../../quiz/QuestionRenderer";
import { markLocally } from "../../admin/coursesSection/quiz/markLocally";
import { apiErrorMessage } from "../shared";
import { TYPES, fromDraft, previewQuestion, sampleVariables, detectVariables } from "./quizModel";
import { McqEditor, GapEditor, KeywordEditor, CalcEditor, ImageEditor } from "./StudioEditors";
import { TypeIcon } from "./TypePicker";

/**
 * Full-screen editor for one question: edit on the left, the exact student
 * view on the right (try it and check the answer). Saves through the same
 * API as before, so stored content is unchanged.
 */
export default function QuestionStudio({ quizId, initialDraft, onClose, onSaved, onSaveAndNew }) {
  const [draft, setDraft] = useState(initialDraft);
  const [dirty, setDirty] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [sample, setSample] = useState(null);
  const set = (patch) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); setVerdict(null); };

  // Example numbers for calculation questions (refresh when variables change)
  const varSig = draft.type === "calculated_mcq" ? JSON.stringify([detectVariables(draft.prompt), draft.variables]) : "";
  useEffect(() => {
    if (draft.type !== "calculated_mcq") return;
    const names = detectVariables(draft.prompt);
    setSample(sampleVariables(Object.fromEntries(names.map((n) => [n, { min: 1, max: 10, decimals: 0, ...draft.variables[n] }]))));
  }, [varSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const built = useMemo(() => fromDraft(draft), [draft]);
  const preview = useMemo(() => previewQuestion(draft, built, sample), [draft, built, sample]);
  const previewKey = useMemo(() => JSON.stringify([preview?.prompt, preview?.content, preview?._options]), [preview]);
  useEffect(() => { setAnswer(null); setVerdict(null); }, [previewKey]);

  // Escape closes (asks first if there are unsaved changes)
  const requestClose = () => {
    if (dirty && !window.confirm("Discard your changes to this question?")) return;
    onClose();
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") doSave(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  });

  const save = useMutation({
    mutationFn: (payload) => (draft.id ? adminAPI.updateQuestion(draft.id, payload) : adminAPI.createQuestion(quizId, payload)),
  });

  const doSave = (andNew) => {
    setShowErrors(true);
    if (built.error) return;
    const payload = { question_type: draft.type, prompt: built.prompt, content: built.content, max_marks: built.max_marks };
    if (draft.order) payload.order = draft.order;
    save.mutate(payload, {
      onSuccess: () => { setDirty(false); andNew ? onSaveAndNew(draft.type) : onSaved(); },
    });
  };

  const check = () => {
    if (!preview) return;
    setVerdict(markLocally(preview, answer || {}));
  };

  const marks = Number(draft.marks) || 1;
  const setMarks = (m) => set({ marks: Math.max(0.5, Math.round(m * 2) / 2) });
  const Editor = { mcq: McqEditor, fill_blanks: GapEditor, drag_drop_word: GapEditor, keyword_match: KeywordEditor, calculated_mcq: CalcEditor, drag_drop_image: ImageEditor }[draft.type];

  return (
    <div className="qs-overlay" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div className={`qs-studio qs-t-${draft.type}`} role="dialog" aria-label="Edit question">
        <div className="qs-studio-head">
          <TypeIcon type={draft.type} />
          <h3>
            {draft.id ? "Edit question" : "New question"}
            <small>{TYPES[draft.type]?.label} · {TYPES[draft.type]?.blurb}</small>
          </h3>
          <div className="qs-marks" title="Marks for this question">
            <button type="button" aria-label="Fewer marks" onClick={() => setMarks(marks - (marks > 1 ? 1 : 0.5))}>−</button>
            <span>{marks} mark{marks === 1 ? "" : "s"}</span>
            <button type="button" aria-label="More marks" onClick={() => setMarks(marks + 1)}>+</button>
          </div>
          <button className="cb-icon-btn" aria-label="Close" onClick={requestClose}><X size={18} /></button>
        </div>

        <div className="qs-studio-body">
          <div className="qs-edit">
            {Editor ? (
              <Editor draft={draft} set={set} sample={sample}
                onNewNumbers={() => setSample(sampleVariables(Object.fromEntries(detectVariables(draft.prompt).map((n) => [n, { min: 1, max: 10, decimals: 0, ...draft.variables[n] }]))))} />
            ) : (
              <p className="text-muted">This question type can't be edited here.</p>
            )}
          </div>

          <div className="qs-preview">
            <div className="qs-preview-label"><Eye size={14} /> What students see</div>
            <div className="qs-preview-card">
              {preview ? (
                <>
                  {!TYPES_EMBEDDING_PROMPT.has(preview.question_type) && <h4>{preview.prompt}</h4>}
                  <QuestionRenderer key={previewKey} question={preview} onAnswer={setAnswer} savedAnswer={null} />
                  <div className="qs-check">
                    <button type="button" className="cb-btn" onClick={check}><CheckCircle size={15} /> Check answer</button>
                    {verdict && (
                      <>
                        <div className={`qs-verdict ${verdict.marks >= verdict.max ? "ok" : verdict.marks > 0 ? "part" : "no"}`}>
                          {verdict.marks >= verdict.max ? "Correct!" : verdict.marks > 0 ? "Partly right" : "Not right"} — {verdict.marks}/{verdict.max}
                          {verdict.feedback && verdict.marks < verdict.max && <small>{verdict.feedback}</small>}
                        </div>
                        <button type="button" className="cb-icon-btn" title="Try again" onClick={() => { setVerdict(null); setAnswer(null); }}><RotateCcw size={15} /></button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="qs-preview-empty">{built.error || "Start typing — the question appears here as students will see it."}</div>
              )}
            </div>
            <p className="qs-hint" style={{ marginTop: "0.75rem" }}>Try it like a student, then press <b>Check answer</b>. The preview updates as you type.</p>
          </div>
        </div>

        <div className="qs-studio-foot">
          {showErrors && built.error ? <span className="qs-error">{built.error}</span>
            : save.isError ? <span className="qs-error">{apiErrorMessage(save.error, "Couldn't save.")}</span>
            : <span className="qs-ok">{dirty ? "Unsaved changes · Ctrl+Enter to save" : " "}</span>}
          <button className="cb-btn cb-btn-ghost" onClick={requestClose}>Cancel</button>
          {!draft.id && <button className="cb-btn" onClick={() => doSave(true)} disabled={save.isPending}>Save & add another</button>}
          <button className="cb-btn cb-btn-primary" onClick={() => doSave(false)} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save question"}</button>
        </div>
      </div>
    </div>
  );
}
