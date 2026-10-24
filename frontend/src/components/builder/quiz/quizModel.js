/**
 * Quiz Studio data model — converts between what the teacher edits (drafts)
 * and what the API stores (question content). Pure functions, no React.
 *
 * Stored shapes are unchanged, so existing questions, the student player and
 * server-side marking all keep working.
 */

export const TYPES = {
  mcq:             { label: "Multiple choice",      blurb: "Pick the right option (or several)." },
  fill_blanks:     { label: "Fill in the blanks",   blurb: "Type the missing words in a sentence." },
  drag_drop_word:  { label: "Drag the words",       blurb: "Drag words into gaps in a sentence." },
  drag_drop_image: { label: "Label a picture",      blurb: "Drag labels onto spots on an image." },
  calculated_mcq:  { label: "Calculation",          blurb: "Numbers change for every student." },
  keyword_match:   { label: "Short answer",         blurb: "Marked by key words in the answer." },
};

/* ── Gap sentences: "The capital is [Paris]." ─────────────────────────── */

const GAP_RE = /\[([^\[\]]+)\]/g;

/** "The [mitochondria] is …" → { prompt with markers, answers by key } */
export function parseGaps(text, type) {
  const answers = {};
  let n = 0;
  const prompt = (text || "").replace(GAP_RE, (_, inner) => {
    n += 1;
    const key = type === "drag_drop_word" ? `slot${n}` : `blank${n}`;
    answers[key] = inner.trim();
    return type === "drag_drop_word" ? `[${key}]` : `{{${key}}}`;
  });
  return { prompt, answers, count: n };
}

/** Stored prompt + answers → teacher-friendly "[answer]" text */
export function gapsToText(prompt, answers) {
  return (prompt || "")
    .replace(/\{\{\s*(blank\d+)\s*\}\}|\[(blank\d+)\]|\[(slot\d+)\]/g, (m, a, b, c) => {
      const key = a || b || c;
      return answers?.[key] !== undefined ? `[${answers[key]}]` : m;
    });
}

/** Split gap text into tokens for the click-a-word view. */
export function gapTokens(text) {
  const out = [];
  const re = /(\[[^\[\]]+\])|([^\s\[\]]+)|(\s+)/g;
  let m;
  while ((m = re.exec(text || ""))) {
    if (m[1]) out.push({ kind: "gap", text: m[1].slice(1, -1), start: m.index, end: m.index + m[0].length });
    else if (m[2]) out.push({ kind: "word", text: m[2], start: m.index, end: m.index + m[0].length });
    else out.push({ kind: "space", text: m[3] });
  }
  return out;
}

/** Turn a word into a gap (or a gap back into a word) at a token position. */
export function toggleGapAt(text, token) {
  if (token.kind === "gap") {
    return text.slice(0, token.start) + token.text + text.slice(token.end);
  }
  // keep trailing punctuation outside the gap: "Paris." → "[Paris]."
  const m = token.text.match(/^(.*?)([.,;:!?)"']*)$/);
  const word = m[1] || token.text;
  const tail = m[1] ? m[2] : "";
  return text.slice(0, token.start) + `[${word}]` + tail + text.slice(token.end);
}

/* ── Calculations ─────────────────────────────────────────────────────── */

export function detectVariables(prompt) {
  const names = [];
  for (const m of (prompt || "").matchAll(/\{\{\s*([A-Za-z_]\w*)\s*\}\}/g)) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

// Same functions the server allows (apps/assessments/serializers.py _SAFE_NAMES)
const MATH = {
  abs: Math.abs, round: Math.round, min: Math.min, max: Math.max, sqrt: Math.sqrt,
  pow: Math.pow, pi: Math.PI, e: Math.E, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  log: Math.log, log10: Math.log10, ceil: Math.ceil, floor: Math.floor,
};

/** Evaluate a teacher-written formula with given variables. → { value } | { error } */
export function evalFormula(formula, variables) {
  const f = (formula || "").trim();
  if (!f) return { error: "empty" };
  if (f.includes("^")) return { error: "Use ** for powers (e.g. a**2), not ^" };
  try {
    const names = [...Object.keys(MATH), ...Object.keys(variables)];
    const values = [...Object.values(MATH), ...Object.values(variables)];
    // eslint-disable-next-line no-new-func
    const v = Number(new Function(...names, `"use strict"; return (${f});`)(...values));
    if (!Number.isFinite(v)) return { error: "Gives no number (division by zero?)" };
    return { value: Math.round(v * 1e6) / 1e6 };
  } catch {
    return { error: "Can't read this formula" };
  }
}

export function sampleVariables(variables) {
  const out = {};
  for (const [name, cfg] of Object.entries(variables || {})) {
    const lo = Number(cfg.min ?? 1);
    const hi = Number(cfg.max ?? 10);
    const dec = Number(cfg.decimals ?? 0);
    const raw = lo + Math.random() * (hi - lo);
    out[name] = dec ? Number(raw.toFixed(dec)) : Math.round(raw);
  }
  return out;
}

export function fillPrompt(prompt, variables) {
  return (prompt || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in variables ? String(variables[k]) : m));
}

/* ── Drafts ───────────────────────────────────────────────────────────── */

export function newDraft(type) {
  const base = { type, prompt: "", marks: type === "mcq" || type === "calculated_mcq" ? 1 : 2 };
  switch (type) {
    case "mcq": return { ...base, options: [{ text: "", correct: true }, { text: "", correct: false }], multiple: false };
    case "fill_blanks": return { ...base, gapText: "" };
    case "drag_drop_word": return { ...base, gapText: "", extraWords: [] };
    case "keyword_match": return { ...base, keywords: [], autoWeights: true };
    case "calculated_mcq": return { ...base, variables: {}, formula: "", tolerance: 0.01, distractors: [""] };
    case "drag_drop_image": return { ...base, prompt: "Drag each label to the right place.", background_url: "", zones: [], distractors: [] };
    default: return base;
  }
}

/** Existing question → draft */
export function toDraft(q) {
  const c = q.content || {};
  const base = { id: q.id, type: q.question_type, prompt: q.prompt || "", marks: q.max_marks ?? 1, order: q.order };
  switch (q.question_type) {
    case "mcq": {
      const correct = Array.isArray(c.correct_answer) ? c.correct_answer : [c.correct_answer];
      return { ...base, multiple: Array.isArray(c.correct_answer) || !!c.is_multiple,
        options: (c.options || []).map((t) => ({ text: t, correct: correct.includes(t) })) };
    }
    case "fill_blanks":
      return { ...base, gapText: gapsToText(q.prompt, c.blanks) };
    case "drag_drop_word": {
      const used = new Set(Object.values(c.mappings || {}));
      return { ...base, gapText: gapsToText(q.prompt, c.mappings),
        extraWords: (c.draggable_words || []).filter((w) => !used.has(w)) };
    }
    case "keyword_match": {
      const kws = c.keywords || [];
      const even = kws.length ? Math.abs(kws[0].weight - (q.max_marks / kws.length)) < 0.02 && kws.every((k) => Math.abs(k.weight - kws[0].weight) < 0.02) : true;
      return { ...base, keywords: kws.map((k) => ({ ...k })), autoWeights: even };
    }
    case "calculated_mcq":
      return { ...base, variables: c.variables || {}, formula: c.formula || "", tolerance: c.tolerance ?? 0.01,
        distractors: c.distractors?.length ? c.distractors : [""] };
    case "drag_drop_image": {
      const items = c.items || [];
      return { ...base, background_url: c.background_url || "",
        zones: (c.zones || []).map((z) => ({ ...z, answer: items.find((it) => it.correct_zone === z.id)?.label || "" })),
        distractors: items.filter((it) => !it.correct_zone).map((it) => it.label) };
    }
    default:
      return { ...base, content: c };
  }
}

const err = (message) => ({ error: message });

/** Draft → { prompt, content, max_marks } for the API, or { error } */
export function fromDraft(d) {
  const marks = Math.max(0.5, Number(d.marks) || 1);
  const prompt = (d.prompt || "").trim();
  switch (d.type) {
    case "mcq": {
      if (!prompt) return err("Write the question.");
      const opts = d.options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text);
      if (opts.length < 2) return err("Add at least two options.");
      if (new Set(opts.map((o) => o.text)).size !== opts.length) return err("Two options are the same.");
      const correct = opts.filter((o) => o.correct).map((o) => o.text);
      if (!correct.length) return err("Mark the correct option (click its circle).");
      const content = { options: opts.map((o) => o.text), correct_answer: d.multiple ? correct : correct[0] };
      if (d.multiple) content.is_multiple = true;
      return { prompt, content, max_marks: marks };
    }
    case "fill_blanks":
    case "drag_drop_word": {
      const { prompt: p, answers, count } = parseGaps(d.gapText, d.type);
      if (!d.gapText.trim()) return err("Write the sentence.");
      if (!count) return err("Make at least one gap — click a word in the sentence.");
      if (d.type === "fill_blanks") return { prompt: p, content: { blanks: answers }, max_marks: marks };
      const words = [...new Set([...Object.values(answers), ...d.extraWords.map((w) => w.trim()).filter(Boolean)])];
      return { prompt: p, content: { draggable_words: words, mappings: answers }, max_marks: marks };
    }
    case "keyword_match": {
      if (!prompt) return err("Write the question.");
      const kws = d.keywords.filter((k) => k.keyword.trim());
      if (!kws.length) return err("Add at least one key word.");
      let list = kws.map((k) => ({ keyword: k.keyword.trim(), weight: Number(k.weight) || 0, case_sensitive: !!k.case_sensitive }));
      if (d.autoWeights) list = splitEvenly(list, marks);
      const total = list.reduce((s, k) => s + k.weight, 0);
      if (Math.abs(total - marks) > 0.01) return err(`Key word marks add up to ${round2(total)}, but the question is worth ${marks}.`);
      return { prompt, content: { keywords: list }, max_marks: marks };
    }
    case "calculated_mcq": {
      if (!prompt) return err("Write the question.");
      const names = detectVariables(prompt);
      if (!names.length) return err("Put at least one number in curly brackets, e.g. {{a}}.");
      if (!d.formula.trim()) return err("Write the formula for the correct answer.");
      const variables = Object.fromEntries(names.map((n) => [n, d.variables[n] || { min: 1, max: 10, decimals: 0 }]));
      for (const [n, v] of Object.entries(variables)) {
        if (Number(v.min) > Number(v.max)) return err(`For ${n}, the smallest value is bigger than the largest.`);
      }
      const test = evalFormula(d.formula, sampleVariables(variables));
      if (test.error) return err(`Formula: ${test.error}`);
      const distractors = d.distractors.map((x) => x.trim()).filter(Boolean);
      for (const x of distractors) {
        const r = evalFormula(x, sampleVariables(variables));
        if (r.error) return err(`Wrong-answer formula "${x}": ${r.error}`);
      }
      return { prompt, content: { variables, formula: d.formula.trim(), tolerance: Number(d.tolerance) || 0.01, distractors }, max_marks: marks };
    }
    case "drag_drop_image": {
      if (!prompt) return err("Write the instruction.");
      if (!d.background_url) return err("Add a picture.");
      const zones = d.zones.filter((z) => z.answer.trim());
      if (!zones.length) return err("Draw a spot on the picture and give it a label.");
      const items = zones.map((z) => ({ id: `i_${z.id}`, label: z.answer.trim(), image_url: "", correct_zone: z.id }));
      d.distractors.map((x) => x.trim()).filter(Boolean).forEach((label, i) => items.push({ id: `d${i + 1}`, label, image_url: "", correct_zone: "" }));
      return {
        prompt,
        // zone.label stays empty: it's shown to students, so it must not give away the answer
        content: { background_url: d.background_url, zones: zones.map(({ answer, ...z }) => ({ ...z, label: "" })), items },
        max_marks: marks,
      };
    }
    default:
      return { prompt, content: d.content || {}, max_marks: marks };
  }
}

function round2(n) { return Math.round(n * 100) / 100; }

export function splitEvenly(list, marks) {
  const n = list.length;
  const each = Math.floor((marks / n) * 100) / 100;
  return list.map((k, i) => ({ ...k, weight: i === n - 1 ? round2(marks - each * (n - 1)) : each }));
}

/** What the live preview renders (same shape the student player gets). */
export function previewQuestion(d, built, sampleVars) {
  if (!built || built.error) return null;
  const q = { id: d.id || "preview", question_type: d.type, prompt: built.prompt, content: built.content, max_marks: built.max_marks };
  if (d.type === "calculated_mcq" && sampleVars) {
    q._renderedVariables = sampleVars;
    q.prompt = fillPrompt(built.prompt, sampleVars);
    const c = built.content;
    if (c.distractors?.length) {
      const vals = [c.formula, ...c.distractors].map((f) => evalFormula(f, sampleVars).value).filter((v) => v !== undefined);
      const uniq = vals.filter((v, i) => vals.findIndex((x) => Math.abs(x - v) < 1e-9) === i);
      if (uniq.length > 1) q._options = uniq.sort((a, b) => a - b);
    }
  }
  return q;
}
