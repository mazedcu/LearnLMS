import { generateVariables } from "../../../quiz/calcVariables";

/**
 * Client-side question marker used by the admin preview ("Try It").
 *
 * Answer payload shapes are kept identical to what `QuestionRenderer` emits
 * via `onAnswer` and what the backend expects on submission, so a single
 * payload format flows through preview → server → student player.
 *
 * Per-type payloads:
 *   mcq             { answer: string | string[] }
 *   fill_blanks     { blanks: { [key]: string } }
 *   keyword_match   { answer: string }
 *   calculated_mcq  { answer: string | number, seed?: number }
 *   drag_drop_word  { mappings: { [slot]: word } }
 *   drag_drop_image { placements: { [itemId]: zoneId } }
 *
 * Note: calculated MCQ uses `new Function(...)` to evaluate the formula. This
 * is acceptable because the formula is authored by the admin themselves; do
 * NOT reuse this for untrusted input.
 */

function markMcq(content, ans, max) {
  const correct = content.correct_answer;
  const student = ans.answer;
  if (Array.isArray(correct)) {
    const studentList = Array.isArray(student) ? student : [];
    const same =
      correct.length === studentList.length &&
      correct.every((c) => studentList.includes(c));
    return same ? { marks: max, feedback: "" } : { marks: 0, feedback: `Correct: ${correct.join(", ")}` };
  }
  if (String(correct) === String(student)) return { marks: max, feedback: "" };
  return { marks: 0, feedback: `Correct: ${correct}` };
}

function markFillBlanks(content, ans, max) {
  const blanks = content.blanks || {};
  const total = Object.keys(blanks).length;
  if (!total) return { marks: 0, feedback: "" };
  const userBlanks = ans.blanks || {};
  let correct = 0;
  const wrong = [];
  for (const [k, v] of Object.entries(blanks)) {
    const given = String(userBlanks[k] || "").trim().toLowerCase();
    if (given === String(v).trim().toLowerCase()) correct++;
    else wrong.push(`${k}: "${v}"`);
  }
  return {
    marks: (correct / total) * max,
    feedback: wrong.length ? `Correct: ${wrong.join(", ")}` : "",
  };
}

function markKeyword(content, ans, max) {
  const kws = content.keywords || [];
  const text = ans.answer || "";
  let marks = 0;
  const missing = [];
  for (const kw of kws) {
    const found = kw.case_sensitive
      ? text.includes(kw.keyword)
      : text.toLowerCase().includes(kw.keyword.toLowerCase());
    if (found) marks += Number(kw.weight) || 0;
    else missing.push(kw.keyword);
  }
  return {
    marks: Math.min(marks, max),
    feedback: missing.length ? `Missing: ${missing.join(", ")}` : "",
  };
}

function markCalculated(content, ans, max) {
  // Prefer the exact variables the renderer used (sent via onAnswer); fall
  // back to regenerating them with the same seeded RNG.
  const variables =
    ans.variables && Object.keys(ans.variables).length
      ? ans.variables
      : generateVariables(content, ans.seed ?? 42);
  try {
    const fn = new Function(...Object.keys(variables), `return ${content.formula}`);
    const correctVal = fn(...Object.values(variables));
    const tol = content.tolerance ?? 0.01;
    const studentVal = parseFloat(ans.answer);
    if (!Number.isNaN(studentVal) && Math.abs(correctVal - studentVal) <= tol) {
      return { marks: max, feedback: "" };
    }
    return { marks: 0, feedback: `Correct: ${correctVal} (your: ${ans.answer ?? "empty"})` };
  } catch {
    return { marks: 0, feedback: "Formula error" };
  }
}

function markDragDropWord(content, ans, max) {
  const mappings = content.mappings || {};
  const total = Object.keys(mappings).length;
  if (!total) return { marks: 0, feedback: "" };
  const userMap = ans.mappings || {};
  let correct = 0;
  const wrong = [];
  for (const [s, w] of Object.entries(mappings)) {
    if (userMap[s] === w) correct++;
    else wrong.push(`[${s}] = "${w}"`);
  }
  return {
    marks: (correct / total) * max,
    feedback: wrong.length ? `Correct: ${wrong.join(", ")}` : "",
  };
}

function markDragDropImage(content, ans, max) {
  const items = content.items || [];
  if (!items.length) return { marks: 0, feedback: "" };
  const placements = ans.placements || {};
  let correct = 0;
  const wrong = [];
  for (const it of items) {
    if (placements[it.id] === it.correct_zone) correct++;
    else wrong.push(`${it.label} → ${it.correct_zone}`);
  }
  return {
    marks: (correct / items.length) * max,
    feedback: wrong.length ? `Correct: ${wrong.join(", ")}` : "",
  };
}

const MARKERS = {
  mcq: markMcq,
  fill_blanks: markFillBlanks,
  keyword_match: markKeyword,
  qa_keywords: markKeyword,
  calculated_mcq: markCalculated,
  drag_drop_word: markDragDropWord,
  drag_drop_image: markDragDropImage,
  drag_drop_picture: markDragDropImage,
};

export function markLocally(question, answers = {}) {
  const fn = MARKERS[question.question_type];
  const max = question.max_marks;
  const result = fn
    ? fn(question.content || {}, answers, max)
    : { marks: 0, feedback: "Unsupported question type" };
  return {
    marks: Math.round(result.marks * 100) / 100,
    max,
    feedback: result.feedback || "",
  };
}
