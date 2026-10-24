import assert from "node:assert/strict";
import * as m from "../src/components/builder/quiz/quizModel.js";

// gaps: fill in the blanks
let r = m.fromDraft({ type: "fill_blanks", gapText: "The capital of France is [Paris] and of Japan is [Tokyo|tokio].", marks: 2 });
assert.equal(r.prompt, "The capital of France is {{blank1}} and of Japan is {{blank2}}.");
assert.deepEqual(r.content.blanks, { blank1: "Paris", blank2: "Tokyo|tokio" });
// round trip from stored question
let d = m.toDraft({ question_type: "fill_blanks", prompt: r.prompt, content: r.content, max_marks: 2 });
assert.equal(d.gapText, "The capital of France is [Paris] and of Japan is [Tokyo|tokio].");
// legacy stored syntax [blank1] also round-trips
assert.equal(m.toDraft({ question_type: "fill_blanks", prompt: "A [blank1] b", content: { blanks: { blank1: "x" } } }).gapText, "A [x] b");

// click a word → gap, keeping punctuation outside
let text = "The cell is small.";
let tok = m.gapTokens(text).find(t => t.text === "small.");
text = m.toggleGapAt(text, tok);
assert.equal(text, "The cell is [small].");
tok = m.gapTokens(text).find(t => t.kind === "gap");
assert.equal(m.toggleGapAt(text, tok), "The cell is small.");

// drag words: answers + extra words, round trip
r = m.fromDraft({ type: "drag_drop_word", gapText: "The [mitochondria] is the powerhouse of the [cell].", extraWords: ["nucleus", "cell"], marks: 2 });
assert.equal(r.prompt, "The [slot1] is the powerhouse of the [slot2].");
assert.deepEqual(r.content.mappings, { slot1: "mitochondria", slot2: "cell" });
assert.deepEqual(r.content.draggable_words, ["mitochondria", "cell", "nucleus"]);
d = m.toDraft({ question_type: "drag_drop_word", prompt: r.prompt, content: r.content, max_marks: 2 });
assert.equal(d.gapText, "The [mitochondria] is the powerhouse of the [cell].");
assert.deepEqual(d.extraWords, ["nucleus"]);

// mcq single + multiple
r = m.fromDraft({ type: "mcq", prompt: "2+2?", marks: 1, multiple: false, options: [{ text: "3", correct: false }, { text: "4", correct: true }, { text: " ", correct: false }] });
assert.deepEqual(r.content, { options: ["3", "4"], correct_answer: "4" });
r = m.fromDraft({ type: "mcq", prompt: "Primes?", marks: 1, multiple: true, options: [{ text: "2", correct: true }, { text: "4", correct: false }, { text: "5", correct: true }] });
assert.deepEqual(r.content.correct_answer, ["2", "5"]);
assert.ok(m.fromDraft({ type: "mcq", prompt: "x", options: [{ text: "a" }, { text: "b" }] }).error.includes("Mark"));

// keywords split evenly to the exact total
r = m.fromDraft({ type: "keyword_match", prompt: "Explain", marks: 1, autoWeights: true, keywords: [{ keyword: "a" }, { keyword: "b" }, { keyword: "c" }] });
assert.equal(Math.round(r.content.keywords.reduce((s, k) => s + k.weight, 0) * 100) / 100, 1);

// calculation
assert.deepEqual(m.detectVariables("If a = {{a}} and {{b}} and again {{a}}"), ["a", "b"]);
assert.equal(m.evalFormula("a*b + sqrt(c)", { a: 2, b: 3, c: 16 }).value, 10);
assert.ok(m.evalFormula("a^2", { a: 2 }).error.includes("**"));
r = m.fromDraft({ type: "calculated_mcq", prompt: "{{a}} × {{b}}?", marks: 1, formula: "a*b", tolerance: 0.01, variables: {}, distractors: ["a+b", ""] });
assert.deepEqual(Object.keys(r.content.variables), ["a", "b"]);
assert.deepEqual(r.content.distractors, ["a+b"]);
const pq = m.previewQuestion({ type: "calculated_mcq" }, r, { a: 3, b: 7 });
assert.deepEqual(pq._options, [10, 21]);
assert.equal(pq.prompt, "3 × 7?");

// picture: zone labels never leak the answer
r = m.fromDraft({ type: "drag_drop_image", prompt: "Label it", marks: 2, background_url: "/x.png",
  zones: [{ id: "z1", x: 1, y: 2, width: 3, height: 4, label: "", answer: "Sun" }, { id: "z2", x: 5, y: 6, width: 7, height: 8, answer: " " }], distractors: ["Moon"] });
assert.equal(r.content.zones.length, 1);
assert.equal(r.content.zones[0].label, "");
assert.deepEqual(r.content.items.map(i => [i.label, i.correct_zone]), [["Sun", "z1"], ["Moon", ""]]);
d = m.toDraft({ question_type: "drag_drop_image", prompt: r.prompt, content: r.content, max_marks: 2 });
assert.equal(d.zones[0].answer, "Sun"); assert.deepEqual(d.distractors, ["Moon"]);
// calculation: click numbers to make them variables
{
  let prompt = "A 5 kg box accelerates at 2 m/s². H2O has 3 atoms. Force?";
  const nums = m.calcTokens(prompt).filter(t => t.kind === "num").map(t => t.text);
  assert.deepEqual(nums, ["5", "2", "3"]);           // the 2 in H2O is skipped
  assert.deepEqual(m.calcTokens("a 12kg mass").filter(t => t.kind === "num").map(t => t.text), ["12"]);
  let vars = {};
  let r1 = m.makeVariable(prompt, vars, m.calcTokens(prompt).find(t => t.text === "5"));
  assert.equal(r1.name, "a"); assert.ok(r1.prompt.startsWith("A {{a}} kg"));
  assert.deepEqual(r1.variables.a, { min: 2, max: 8, decimals: 0, example: 5 });
  let r2 = m.makeVariable(r1.prompt, r1.variables, m.calcTokens(r1.prompt).find(t => t.text === "2"));
  assert.equal(r2.name, "b");
  assert.deepEqual(m.calcTokens(r2.prompt).filter(t => t.kind === "var").map(t => t.name), ["a", "b"]);
  // names skip e (Euler) and existing ones
  assert.equal(m.makeVariable("x 1", { a:{}, b:{}, c:{}, d:{} }, m.calcTokens("x 1")[1]).name, "f");
  // revert a chip → its example number, config dropped
  const back = m.revertVariable(r2.prompt, r2.variables, m.calcTokens(r2.prompt).find(t => t.name === "a"));
  assert.ok(back.prompt.startsWith("A 5 kg")); assert.ok(!("a" in back.variables));
  assert.deepEqual(m.rangeAround(0.4), { min: 0.2, max: 0.6, decimals: 1, example: 0.4 });
  assert.deepEqual(m.rangeAround(1), { min: 1, max: 3, decimals: 0, example: 1 });
  assert.deepEqual(m.exampleValues(r2.variables, ["a", "b"]), { a: 5, b: 2 });
  // typical mistakes
  const ms = m.suggestMistakes("a * b", { a: 5, b: 2 });
  assert.equal(ms[0].expr, "a / b"); assert.equal(ms[0].value, 2.5);
  assert.ok(ms.some(x => x.expr === "a + b" || x.expr.includes("* 10")));
  assert.ok(!ms.some(x => x.value === 10));            // never equals the right answer
  assert.ok(m.suggestMistakes("a / b", { a: 6, b: 3 }).some(x => x.expr === "b / a"));
  assert.ok(m.suggestMistakes("0.5 * a * b ** 2", { a: 2, b: 3 }).some(x => x.why === "forgot to square"));
  assert.deepEqual(m.suggestMistakes("a *", { a: 1 }), []);
  // version check across many students
  const ok = m.checkVersions("a * b", ["a + b"], r2.variables, ["a", "b"], 100);
  assert.equal(ok.errors, 0); assert.equal(ok.examples.length, 3); assert.ok(ok.min >= 2 * 1);
  const bad = m.checkVersions("a / (b - 2)", ["a * b"], { a: { min: 1, max: 3 }, b: { min: 2, max: 2 } }, ["a", "b"], 50);
  assert.equal(bad.errors, 50); assert.ok(bad.warnings[0].includes("no number"));
  const clash = m.checkVersions("a * 2", ["a + a"], { a: { min: 1, max: 9 } }, ["a"], 30);
  assert.equal(clash.clashes, 30);
  // example survives a save (backend ignores it)
  const saved = m.fromDraft({ type: "calculated_mcq", prompt: r2.prompt, variables: r2.variables, formula: "a*b", distractors: ["a+b"], tolerance: 0.01, marks: 1 });
  assert.equal(saved.content.variables.a.example, 5);
}
console.log("all model checks passed");
