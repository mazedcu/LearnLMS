import React, { useState, useEffect, useRef, useCallback } from 'react';
import { assessmentsAPI } from '../../api';
import QuestionRenderer, { TYPES_EMBEDDING_PROMPT } from './QuestionRenderer';
import { Timer, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Merge the raw question from the quiz listing with any server-rendered
 * per-question state (calc-MCQ variables, interpolated prompt, options).
 */
function injectRendered(question, rendered) {
  if (!rendered || !Object.keys(rendered).length) return question;
  const merged = { ...question };
  if (rendered.interpolated_prompt) merged.prompt = rendered.interpolated_prompt;
  if (rendered.variables) merged._renderedVariables = rendered.variables;
  if (rendered.options) merged._options = rendered.options;
  return merged;
}

const QUESTIONS_PER_PAGE = 5;
const SAVE_DELAY_MS = 700;

export default function QuizPlayer({ quiz, onFinish }) {
  const [submission, setSubmission] = useState(null);
  const [renderedMap, setRenderedMap] = useState({});
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  // Answers are saved as the student goes (so a reload or dropped
  // connection doesn't lose them); these track what still needs sending.
  const answersRef = useRef({});
  const unsaved = useRef(new Set());
  const saveTimers = useRef({});
  const finishing = useRef(false);

  const rawQuestions = quiz.questions || [];
  const questions = rawQuestions.map(q => injectRendered(q, renderedMap[q.id]));
  const totalPages = Math.max(1, Math.ceil(questions.length / QUESTIONS_PER_PAGE));
  const startIdx = pageIndex * QUESTIONS_PER_PAGE;
  const pageQuestions = questions.slice(startIdx, startIdx + QUESTIONS_PER_PAGE);
  const answeredCount = questions.filter(q => answers[q.id] !== undefined).length;

  // Start (or resume) the attempt, then load its questions, saved answers and time left
  useEffect(() => {
    let cancelled = false;
    assessmentsAPI.startQuiz(quiz.id)
      .then(async (res) => {
        if (cancelled) return;
        const sub = res.data;
        setSubmission(sub);
        let secondsLeft = sub.seconds_left;
        try {
          const r = await assessmentsAPI.getRenderedQuestions(sub.id);
          if (cancelled) return;
          setRenderedMap(r.data.rendered_questions || {});
          const saved = r.data.answers || {};
          answersRef.current = saved;
          setAnswers(saved);
          if (r.data.seconds_left !== undefined) secondsLeft = r.data.seconds_left;
        } catch { /* older server: start fresh */ }
        if (secondsLeft !== null && secondsLeft !== undefined) setTimeLeft(secondsLeft);
        setReady(true);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.response?.data?.detail || "Failed to start quiz.");
      });
    return () => {
      cancelled = true;
      Object.values(saveTimers.current).forEach(clearTimeout);
    };
  }, [quiz.id]);

  const saveAnswer = useCallback(async (qId) => {
    if (!submission) return;
    clearTimeout(saveTimers.current[qId]);
    const data = answersRef.current[qId];
    if (data === undefined) return;
    try {
      await assessmentsAPI.submitAnswer(submission.id, qId, { answer_data: data });
      unsaved.current.delete(qId);
    } catch {
      /* stays in `unsaved`; retried when finishing */
    }
  }, [submission]);

  const handleAnswer = (question, data) => {
    let payload = data;
    if (question.question_type === 'calculated_mcq' && question._renderedVariables) {
      payload = { ...data, variables: question._renderedVariables };
    }
    answersRef.current = { ...answersRef.current, [question.id]: payload };
    setAnswers(answersRef.current);
    unsaved.current.add(question.id);
    clearTimeout(saveTimers.current[question.id]);
    saveTimers.current[question.id] = setTimeout(() => saveAnswer(question.id), SAVE_DELAY_MS);
  };

  const handleFinish = useCallback(async () => {
    if (!submission || finishing.current) return;
    finishing.current = true;
    setIsSubmitting(true);
    try {
      // Send anything not saved yet (answers after the time limit are refused by the server)
      for (const qId of Array.from(unsaved.current)) {
        await saveAnswer(qId);
      }
      const res = await assessmentsAPI.finishQuiz(submission.id);
      onFinish(res.data);
    } catch (err) {
      finishing.current = false;
      setError(err.response?.data?.detail || "Failed to submit quiz. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [submission, saveAnswer, onFinish]);

  // Countdown; submits automatically when time runs out
  useEffect(() => {
    if (timeLeft === null || !ready) return;
    if (timeLeft <= 0) { handleFinish(); return; }
    const t = setTimeout(() => setTimeLeft(s => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, ready, handleFinish]);

  const handleNext = () => {
    if (pageIndex < totalPages - 1) {
      setPageIndex(pageIndex + 1);
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (pageIndex > 0) setPageIndex(pageIndex - 1);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="alert alert-error" style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={40} style={{ marginBottom: '1rem' }} />
        <p>{error}</p>
        <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }

  if (!submission || !ready) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <Loader2 className="spinner" size={40} style={{ margin: '0 auto' }} />
        <p className="text-muted" style={{ marginTop: '1rem' }}>Preparing your quiz...</p>
      </div>
    );
  }

  if (!pageQuestions.length) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <p className="text-muted">No questions available.</p>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.25rem' }}>{quiz.title}</h2>
          <p className="text-muted">
            {totalPages > 1 ? `Page ${pageIndex + 1} of ${totalPages} · ` : ""}{answeredCount} of {questions.length} answered
          </p>
        </div>
        {timeLeft !== null && (
          <div className={`glass ${timeLeft < 60 ? 'text-danger' : ''}`} style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '100px' }}>
            <Timer size={18} />
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      {pageQuestions.map((q, i) => (
        <div key={q.id} className="question-card" style={{ marginBottom: '1.5rem' }}>
          <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>Q{startIdx + i + 1}</p>
          {!TYPES_EMBEDDING_PROMPT.has(q.question_type) && (
            <h3 style={{ marginBottom: '1.5rem', lineHeight: '1.4' }}>{q.prompt}</h3>
          )}
          <QuestionRenderer
            question={q}
            onAnswer={(data) => handleAnswer(q, data)}
            savedAnswer={answers[q.id]}
          />
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="btn btn-outline"
            onClick={handlePrev}
            disabled={pageIndex === 0}
          >
            <ChevronLeft size={18} /> Previous
          </button>
          <button
            className="btn btn-outline"
            onClick={handleNext}
            disabled={pageIndex === totalPages - 1}
          >
            Next <ChevronRight size={18} />
          </button>
        </div>

        {pageIndex === totalPages - 1 ? (
          <button
            className="btn btn-primary"
            onClick={() => {
              const left = questions.length - answeredCount;
              if (left > 0 && !window.confirm(`You haven't answered ${left} question${left === 1 ? "" : "s"}. Finish anyway?`)) return;
              handleFinish();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="spinner-sm" /> : <CheckCircle size={18} />} Finish Quiz
          </button>
        ) : (
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>{answeredCount} of {questions.length} answered</p>
        )}
      </div>
    </div>
  );
}
