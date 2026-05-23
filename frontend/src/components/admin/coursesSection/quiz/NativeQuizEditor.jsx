import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Save, X, Eye } from "lucide-react";
import { adminAPI } from "../../../../api";
import { apiErrorMessage } from "../apiError";
import QuestionCard from "./QuestionCard";
import QuestionForm from "./QuestionForm";
import QuizPreview from "./QuizPreview";

function QuizCreateForm({ onSubmit, onCancel, mutation }) {
  const [form, setForm] = useState({ title: "", passing_score: "70", time_limit_mins: "" });
  const handleSubmit = () => {
    const payload = { title: form.title.trim() };
    const ps = Number(form.passing_score);
    payload.passing_score = Number.isNaN(ps) ? 70 : ps;
    const tl = Number(form.time_limit_mins);
    if (!Number.isNaN(tl) && tl > 0) payload.time_limit_mins = tl;
    onSubmit(payload);
  };
  return (
    <div style={{ padding: "0.75rem", background: "rgba(108,99,255,0.06)", borderRadius: "var(--radius-sm)" }}>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="form-group" style={{ margin: 0, flex: "1 1 160px" }}>
          <label className="form-label" style={{ fontSize: "0.7rem" }}>Quiz Title *</label>
          <input className="form-control" style={{ fontSize: "0.8rem" }} placeholder="e.g. Unit 1 Exam" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "0 0 90px" }}>
          <label className="form-label" style={{ fontSize: "0.7rem" }}>Passing %</label>
          <input className="form-control" style={{ fontSize: "0.8rem" }} type="number" value={form.passing_score} onChange={(e) => setForm((f) => ({ ...f, passing_score: e.target.value }))} />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "0 0 90px" }}>
          <label className="form-label" style={{ fontSize: "0.7rem" }}>Time (min)</label>
          <input className="form-control" style={{ fontSize: "0.8rem" }} type="number" placeholder="optional" value={form.time_limit_mins} onChange={(e) => setForm((f) => ({ ...f, time_limit_mins: e.target.value }))} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={!form.title.trim() || mutation.isPending}>
          <Save size={13} /> {mutation.isPending ? "..." : "Save"}
        </button>
        <button className="btn btn-outline btn-sm" onClick={onCancel}><X size={13} /></button>
      </div>
      {mutation.isError && (
        <p style={{ fontSize: "0.75rem", color: "var(--clr-danger)", marginTop: "0.5rem" }}>
          {apiErrorMessage(mutation.error, "Error creating quiz.")}
        </p>
      )}
    </div>
  );
}

function QuestionManager({ quiz, onBack }) {
  const qc = useQueryClient();
  const [addingQ, setAddingQ] = useState(false);
  const [editingQ, setEditingQ] = useState(null);

  const { data: questionsRaw } = useQuery({
    queryKey: ["questions-admin", quiz.id],
    queryFn: () =>
      adminAPI.getQuestions(quiz.id).then((r) => {
        const d = r.data;
        return Array.isArray(d) ? d : d?.results || [];
      }),
  });
  const questions = questionsRaw || [];

  const delQ = useMutation({
    mutationFn: (id) => adminAPI.deleteQuestion(id),
    onSuccess: () => qc.invalidateQueries(["questions-admin", quiz.id]),
  });

  const handleSuccess = () => {
    qc.invalidateQueries(["questions-admin", quiz.id]);
    setEditingQ(null);
    setAddingQ(false);
  };

  return (
    <div style={{ padding: "1rem", background: "rgba(108,99,255,0.04)", border: "1px solid rgba(108,99,255,0.25)", borderRadius: "var(--radius-md)", marginTop: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h5 style={{ margin: 0, color: "var(--clr-primary)" }}>{quiz.title}</h5>
          <p className="text-muted" style={{ fontSize: "0.7rem", margin: "0.25rem 0 0" }}>
            Passing: {quiz.passing_score}% · {questions.length} question{questions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onBack}><X size={13} /> Back</button>
      </div>

      {questions.map((q) => (
        <QuestionCard
          key={q.id}
          q={q}
          onEdit={() => {
            setEditingQ(q);
            setAddingQ(false);
          }}
          onDelete={() => {
            if (confirm("Delete this question?")) delQ.mutate(q.id);
          }}
        />
      ))}
      {questions.length === 0 && !addingQ && !editingQ && (
        <p className="text-muted" style={{ fontSize: "0.8rem", textAlign: "center", padding: "1rem" }}>
          No questions yet. Add one below.
        </p>
      )}

      {editingQ && (
        <QuestionForm
          quizId={quiz.id}
          question={editingQ}
          onCancel={() => setEditingQ(null)}
          onSuccess={handleSuccess}
        />
      )}

      {addingQ && !editingQ && (
        <QuestionForm
          quizId={quiz.id}
          onCancel={() => setAddingQ(false)}
          onSuccess={handleSuccess}
        />
      )}

      {!addingQ && !editingQ && (
        <button
          className="btn btn-primary btn-sm"
          style={{ width: "100%", marginTop: "0.5rem" }}
          onClick={() => setAddingQ(true)}
        >
          <Plus size={13} /> Add Question
        </button>
      )}
    </div>
  );
}

export default function NativeQuizEditor({ lessonId, onClose }) {
  const qc = useQueryClient();
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [previewQuiz, setPreviewQuiz] = useState(null);
  const [addingQuiz, setAddingQuiz] = useState(false);

  const { data: quizzesRaw, isLoading } = useQuery({
    queryKey: ["quizzes-admin", lessonId],
    queryFn: () =>
      adminAPI.getQuizzes(lessonId).then((r) => {
        const d = r.data;
        return Array.isArray(d) ? d : d?.results || [];
      }),
  });
  const quizzes = quizzesRaw || [];

  const createQuiz = useMutation({
    mutationFn: (payload) => adminAPI.createQuiz(lessonId, payload),
    onSuccess: () => {
      qc.invalidateQueries(["quizzes-admin", lessonId]);
      setAddingQuiz(false);
    },
  });

  const delQuiz = useMutation({
    mutationFn: (id) => adminAPI.deleteQuiz(id),
    onSuccess: () => {
      qc.invalidateQueries(["quizzes-admin", lessonId]);
      setActiveQuiz(null);
    },
  });

  if (previewQuiz) {
    return <QuizPreview quiz={previewQuiz} onClose={() => setPreviewQuiz(null)} />;
  }

  if (activeQuiz) {
    return <QuestionManager quiz={activeQuiz} onBack={() => setActiveQuiz(null)} />;
  }

  return (
    <div style={{ padding: "1rem", background: "rgba(0,212,170,0.04)", border: "1px solid rgba(0,212,170,0.2)", borderRadius: "var(--radius-md)", marginTop: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h5 style={{ margin: 0, color: "var(--clr-accent)" }}>Quizzes</h5>
        <button className="btn btn-outline btn-sm" onClick={onClose}><X size={13} /></button>
      </div>

      {isLoading && <div className="spinner" style={{ margin: "1rem auto" }} />}

      {quizzes.map((q) => (
        <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", background: "var(--clr-bg)", borderRadius: "var(--radius-sm)", marginBottom: "0.5rem", border: "1px solid var(--clr-border)" }}>
          <div>
            <p style={{ fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>{q.title}</p>
            <p className="text-muted" style={{ fontSize: "0.7rem", margin: "0.125rem 0 0" }}>
              Passing: {q.passing_score}% · {q.questions?.length || 0} questions
              {q.time_limit_mins ? ` · ${q.time_limit_mins} min` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-outline btn-sm" style={{ padding: "0.3rem 0.6rem" }} onClick={() => setPreviewQuiz(q)}>
              <Eye size={12} /> Preview
            </button>
            <button className="btn btn-primary btn-sm" style={{ padding: "0.3rem 0.6rem" }} onClick={() => setActiveQuiz(q)}>
              <Edit2 size={12} /> Manage
            </button>
            <button
              className="btn btn-danger btn-sm"
              style={{ padding: "0.3rem 0.5rem" }}
              onClick={() => {
                if (confirm("Delete quiz and all questions?")) delQuiz.mutate(q.id);
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}

      {!isLoading && quizzes.length === 0 && !addingQuiz && (
        <p className="text-muted" style={{ fontSize: "0.8rem", textAlign: "center", padding: "1rem" }}>
          No quizzes yet.
        </p>
      )}

      {addingQuiz ? (
        <QuizCreateForm
          onSubmit={(payload) => createQuiz.mutate(payload)}
          onCancel={() => setAddingQuiz(false)}
          mutation={createQuiz}
        />
      ) : (
        <button
          className="btn btn-sm btn-outline"
          style={{ width: "100%", color: "var(--clr-accent)", borderColor: "rgba(0,212,170,0.3)" }}
          onClick={() => setAddingQuiz(true)}
        >
          <Plus size={13} /> Create Quiz
        </button>
      )}
    </div>
  );
}
