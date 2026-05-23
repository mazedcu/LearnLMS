import React, { useState, useEffect } from 'react';
import { assessmentsAPI } from '../../api';
import QuestionRenderer, { TYPES_EMBEDDING_PROMPT } from './QuestionRenderer';
import { Timer, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Merge the raw question from the quiz listing with any server-rendered
 * per-question state (e.g. calc-MCQ variables + interpolated prompt).
 */
function injectRendered(question, rendered) {
  if (!rendered || !Object.keys(rendered).length) return question;
  const merged = { ...question };
  if (rendered.interpolated_prompt) {
    merged.prompt = rendered.interpolated_prompt;
  }
  if (rendered.variables) {
    merged._renderedVariables = rendered.variables;
  }
  return merged;
}

const QUESTIONS_PER_PAGE = 5;

export default function QuizPlayer({ quiz, onFinish }) {
  const [submission, setSubmission] = useState(null);
  const [renderedMap, setRenderedMap] = useState({});
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [error, setError] = useState(null);

  const rawQuestions = quiz.questions || [];
  const questions = rawQuestions.map(q => injectRendered(q, renderedMap[q.id]));
  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
  const startIdx = pageIndex * QUESTIONS_PER_PAGE;
  const pageQuestions = questions.slice(startIdx, startIdx + QUESTIONS_PER_PAGE);

  // Start Quiz -> then fetch rendered per-question state
  useEffect(() => {
    let cancelled = false;
    assessmentsAPI.startQuiz(quiz.id)
      .then(res => {
        if (cancelled) return;
        const sub = res.data;
        setSubmission(sub);
        if (quiz.time_limit_mins) {
          setTimeLeft(quiz.time_limit_mins * 60);
        }
        // Fetch pre-generated variables / prompts
        return assessmentsAPI.getRenderedQuestions(sub.id).then(r => {
          if (cancelled) return;
          setRenderedMap(r.data.rendered_questions || {});
        }).catch(() => {
          // Non-fatal: if the endpoint is missing, calc-MCQ falls back to
          // client-side generation (legacy path)
        });
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.response?.data?.detail || "Failed to start quiz.");
      });
    return () => { cancelled = true; };
  }, [quiz.id, quiz.time_limit_mins]);

  // Timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const handleAnswer = (question, data) => {
    // For calc-MCQ, attach the rendered variables so the backend can verify
    // marking against the exact numbers the student saw on screen.
    let payload = data;
    if (question.question_type === 'calculated_mcq' && question._renderedVariables) {
      payload = { ...data, variables: question._renderedVariables };
    }
    setAnswers(prev => ({ ...prev, [question.id]: payload }));
  };

  const handleNext = () => {
    if (pageIndex < totalPages - 1) {
      setPageIndex(pageIndex + 1);
    }
  };

  const handlePrev = () => {
    if (pageIndex > 0) {
      setPageIndex(pageIndex - 1);
    }
  };

  const handleFinish = async () => {
    if (!submission) return;
    setIsSubmitting(true);
    try {
      // Submit all answers
      for (const [qId, data] of Object.entries(answers)) {
        await assessmentsAPI.submitAnswer(submission.id, qId, { answer_data: data });
      }
      // Finish quiz
      const res = await assessmentsAPI.finishQuiz(submission.id);
      onFinish(res.data);
    } catch (err) {
      setError("Failed to submit quiz. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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

  if (!submission) {
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
          <p className="text-muted">Page {pageIndex + 1} of {totalPages} · Questions {startIdx + 1}–{Math.min(startIdx + QUESTIONS_PER_PAGE, questions.length)} of {questions.length}</p>
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
            onClick={handleFinish}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="spinner-sm" /> : <CheckCircle size={18} />} Finish Quiz
          </button>
        ) : (
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>Progress: {Math.round(((startIdx + pageQuestions.length) / questions.length) * 100)}%</p>
        )}
      </div>
    </div>
  );
}
