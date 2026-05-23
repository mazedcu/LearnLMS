export const QUESTION_TYPES = [
  { value: "mcq", label: "Multiple Choice (MCQ)" },
  { value: "fill_blanks", label: "Fill in the Blanks" },
  { value: "keyword_match", label: "Keyword Match" },
  { value: "calculated_mcq", label: "Calculated Multichoice" },
  { value: "drag_drop_word", label: "Drag & Drop Word" },
  { value: "drag_drop_image", label: "Drag & Drop Image" },
];

export const TYPE_LABELS = {
  mcq: "MCQ",
  fill_blanks: "Fill Blanks",
  keyword_match: "Keywords",
  calculated_mcq: "Calc MCQ",
  drag_drop_word: "DD Word",
  drag_drop_image: "DD Image",
};

export const PROMPT_PLACEHOLDERS = {
  mcq: "What is the capital of France?",
  fill_blanks: "The capital of France is {{blank1}} and the capital of Japan is {{blank2}}.",
  keyword_match: "Explain the process of photosynthesis in plants.",
  calculated_mcq: "If a = {{a}} and b = {{b}}, what is a * b + 5?",
  drag_drop_word: "The [slot1] is the powerhouse of the [slot2].",
  drag_drop_image: "Drag each label to the correct part of the diagram.",
};
