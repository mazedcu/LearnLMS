/**
 * Shared deterministic variable generation for Calculated-MCQ questions.
 *
 * Both the renderer (`CalculatedMcqQuestion`) and the client-side marker
 * (`markLocally`) import these helpers so the numbers shown in the prompt
 * are guaranteed to be the numbers used for marking.
 *
 * NOTE on backend parity: the server-side marker uses Python's
 * `random.Random(seed)` which is NOT byte-compatible with this JS RNG. As a
 * result, *server-marked* submissions can disagree with what the student saw
 * on screen. The proper fix is for the API to pre-render variables when the
 * student starts the quiz and include them in the question payload; this
 * module is a stopgap that at least makes the admin Preview self-consistent.
 */

// Simple LCG — fast, deterministic, no external deps. Good enough for
// generating teaching-style numbers in a small range; do not use for
// anything security-sensitive.
export function seededRng(seed = 42) {
  let s = seed || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function generateVariables(content, seed = 42) {
  const vars = content?.variables || {};
  const rand = seededRng(seed);
  const out = {};
  for (const [name, cfg] of Object.entries(vars)) {
    const lo = cfg.min ?? 0;
    const hi = cfg.max ?? 10;
    const dec = cfg.decimals ?? 0;
    const raw = lo + rand() * (hi - lo);
    out[name] = dec ? parseFloat(raw.toFixed(dec)) : Math.round(raw);
  }
  return out;
}

// Replaces `{{name}}` tokens in a string with values from `variables`.
// Unknown tokens are left intact so authors can spot typos.
export function interpolatePrompt(prompt, variables) {
  if (!prompt) return "";
  return prompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match
  );
}
