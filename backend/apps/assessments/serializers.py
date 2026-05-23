"""Assessment serializers + per-type marking & validation logic.

Marking is split into small per-type functions keyed by question type, so the
public ``mark_question`` entry point stays a one-line dispatch and each type's
logic can be tested or extended independently.
"""

from rest_framework import serializers

import math
import random

from .models import Quiz, Question, QuizSubmission, QuestionResponse


# ─── Calculated-MCQ variable helpers ───────────────────────────────────────

def generate_calc_variables(content, seed=42):
    """Deterministically generate variables for a calculated MCQ.
    Uses the same algorithm as the frontend preview (Python random.Random).
    Returns a dict of {var_name: value}."""
    rng = random.Random(seed)
    variables = {}
    for name, cfg in (content.get('variables') or {}).items():
        lo = float(cfg.get('min', 0))
        hi = float(cfg.get('max', 10))
        decimals = int(cfg.get('decimals', 0))
        val = rng.uniform(lo, hi)
        variables[name] = round(val, decimals) if decimals else int(round(val))
    return variables


def interpolate_prompt(prompt, variables):
    """Replace {{name}} tokens with actual variable values."""
    if not prompt:
        return ""
    import re
    def _repl(m):
        key = m.group(1)
        return str(variables[key]) if key in variables else m.group(0)
    return re.sub(r'\{\{\s*(\w+)\s*\}\}', _repl, prompt)


# ─── Safe math evaluator for Calculated MCQ ──────────────────────────────────

_SAFE_NAMES = {
    'abs': abs, 'round': round, 'min': min, 'max': max,
    'sqrt': math.sqrt, 'pow': pow, 'pi': math.pi, 'e': math.e,
    'sin': math.sin, 'cos': math.cos, 'tan': math.tan,
    'log': math.log, 'log10': math.log10, 'ceil': math.ceil, 'floor': math.floor,
}


def _safe_eval(expr, variables):
    """Evaluate a math expression with given variables. No builtins exposed."""
    ns = dict(_SAFE_NAMES)
    ns.update(variables)
    try:
        return float(eval(expr, {"__builtins__": {}}, ns))  # noqa: S307 - sandboxed
    except Exception:
        return None


# ─── Per-question-type validators ────────────────────────────────────────────

def _validate_mcq(content, max_marks):
    options = content.get('options') or []
    if len(options) < 2:
        raise serializers.ValidationError("MCQ needs at least 2 options.")
    if 'correct_answer' not in content:
        raise serializers.ValidationError("MCQ requires a 'correct_answer'.")
    correct = content['correct_answer']
    if isinstance(correct, list):
        for c in correct:
            if c not in options:
                raise serializers.ValidationError(f"Correct answer '{c}' not in options.")
    elif correct not in options:
        raise serializers.ValidationError("Correct answer must be one of the options.")


def _validate_fill_blanks(content, max_marks):
    blanks = content.get('blanks') or {}
    if not blanks:
        raise serializers.ValidationError("Fill-blanks needs at least one blank.")


def _validate_keyword_match(content, max_marks):
    keywords = content.get('keywords') or []
    if not keywords:
        raise serializers.ValidationError("Keyword match needs at least one keyword.")
    total_weight = sum(float(kw.get('weight', 0)) for kw in keywords)
    if abs(total_weight - max_marks) > 0.01:
        raise serializers.ValidationError(
            f"Keyword weights must total {max_marks}. Currently: {total_weight}"
        )


def _validate_calculated_mcq(content, max_marks):
    if not content.get('formula', '').strip():
        raise serializers.ValidationError("Calculated MCQ requires a formula.")
    if not content.get('variables'):
        raise serializers.ValidationError("Calculated MCQ requires at least one variable.")


def _validate_drag_drop_word(content, max_marks):
    if not content.get('mappings'):
        raise serializers.ValidationError("Drag-drop word needs at least one mapping.")
    if not content.get('draggable_words'):
        raise serializers.ValidationError("Drag-drop word needs draggable words.")


def _validate_drag_drop_image(content, max_marks):
    if not content.get('background_url'):
        raise serializers.ValidationError("Drag-drop image needs a background URL.")
    if not content.get('zones'):
        raise serializers.ValidationError("Drag-drop image needs at least one zone.")
    if not content.get('items'):
        raise serializers.ValidationError("Drag-drop image needs at least one item.")


_VALIDATORS = {
    Question.Type.MCQ: _validate_mcq,
    Question.Type.FILL_BLANKS: _validate_fill_blanks,
    Question.Type.KEYWORD_MATCH: _validate_keyword_match,
    Question.Type.CALCULATED_MCQ: _validate_calculated_mcq,
    Question.Type.DRAG_DROP_WORD: _validate_drag_drop_word,
    Question.Type.DRAG_DROP_IMAGE: _validate_drag_drop_image,
}


# ─── Per-question-type markers ───────────────────────────────────────────────
#
# Each marker takes (content, answer_data, max_marks) and returns
# (marks, feedback). They are pure functions — no DB access — so unit testing
# is straightforward.

def _mark_mcq(content, answer, max_marks):
    correct = content.get('correct_answer')
    student = answer.get('answer')
    if isinstance(correct, list):
        student_list = student if isinstance(student, list) else []
        if set(correct) == set(student_list):
            return max_marks, ""
        return 0.0, ""
    if str(correct) == str(student):
        return max_marks, ""
    return 0.0, ""


def _mark_fill_blanks(content, answer, max_marks):
    blanks = content.get('blanks') or {}
    if not blanks:
        return 0.0, ""
    student_blanks = answer.get('blanks') or {}
    correct = 0
    for key, val in blanks.items():
        if str(student_blanks.get(key, "")).strip().lower() == str(val).strip().lower():
            correct += 1
    return (correct / len(blanks)) * max_marks, ""


def _mark_keyword_match(content, answer, max_marks):
    keywords = content.get('keywords') or []
    text = str(answer.get('answer', '') or '')
    marks = 0.0
    matched = set()
    for kw_cfg in keywords:
        keyword = str(kw_cfg.get('keyword', ''))
        weight = float(kw_cfg.get('weight', 0))
        case_sensitive = kw_cfg.get('case_sensitive', False)
        found = (keyword in text) if case_sensitive else (keyword.lower() in text.lower())
        if found:
            marks += weight
            matched.add(keyword)
    marks = min(marks, max_marks)
    missing = [kw['keyword'] for kw in keywords if kw['keyword'] not in matched]
    feedback = f"Missing keywords: {', '.join(missing)}" if missing else ""
    return marks, feedback


def _mark_calculated_mcq(content, answer, max_marks, rendered_variables=None):
    # Prefer pre-generated variables stored on the submission; fall back to
    # regenerating from seed (used only for legacy submissions without
    # rendered_questions).
    variables = rendered_variables
    if variables is None:
        seed = answer.get('seed', 0)
        variables = generate_calc_variables(content, seed)

    correct_val = _safe_eval(content.get('formula', '0'), variables)
    tolerance = float(content.get('tolerance', 0.01))

    try:
        student_val = float(answer.get('answer', ''))
    except (ValueError, TypeError):
        student_val = None

    if correct_val is None or student_val is None:
        return 0.0, "Could not evaluate answer."
    if abs(correct_val - student_val) <= tolerance:
        return max_marks, f"Correct! ({correct_val})"
    return 0.0, f"Incorrect. Expected {correct_val}, got {student_val}"


def _mark_drag_drop_word(content, answer, max_marks):
    mappings = content.get('mappings') or {}
    if not mappings:
        return 0.0, ""
    student = answer.get('mappings') or {}
    correct = sum(1 for slot, word in mappings.items() if student.get(slot) == word)
    return (correct / len(mappings)) * max_marks, ""


def _mark_drag_drop_image(content, answer, max_marks):
    items = content.get('items') or []
    if not items:
        return 0.0, ""
    placements = answer.get('placements') or {}
    correct = sum(
        1 for item in items if placements.get(item.get('id')) == item.get('correct_zone')
    )
    return (correct / len(items)) * max_marks, ""


_MARKERS = {
    Question.Type.MCQ: _mark_mcq,
    Question.Type.FILL_BLANKS: _mark_fill_blanks,
    Question.Type.KEYWORD_MATCH: _mark_keyword_match,
    Question.Type.CALCULATED_MCQ: _mark_calculated_mcq,
    Question.Type.DRAG_DROP_WORD: _mark_drag_drop_word,
    Question.Type.DRAG_DROP_IMAGE: _mark_drag_drop_image,
}


def mark_question(question, answer_data, rendered_variables=None):
    """Auto-mark a question. Returns ``(marks, feedback)``.

    ``rendered_variables`` is used for calculated MCQ so the backend marks
    against the exact variables the student saw on screen, rather than
    regenerating them and risking a mismatch.

    Falls back to ``(0, "Unsupported question type")`` for unknown types.
    """
    q_type = question.question_type
    if q_type == Question.Type.CALCULATED_MCQ:
        marks, feedback = _mark_calculated_mcq(
            question.content or {}, answer_data or {}, question.max_marks, rendered_variables
        )
        return round(float(marks), 2), feedback

    marker = _MARKERS.get(q_type)
    if marker is None:
        return 0.0, "Unsupported question type"
    marks, feedback = marker(question.content or {}, answer_data or {}, question.max_marks)
    return round(float(marks), 2), feedback


# ─── Serializers ─────────────────────────────────────────────────────────────

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['id', 'question_type', 'prompt', 'content', 'max_marks', 'order']

    def validate(self, data):
        q_type = data.get('question_type') or getattr(self.instance, 'question_type', None)
        content = data.get('content', {}) or {}
        max_marks = data.get('max_marks', getattr(self.instance, 'max_marks', 1))

        validator = _VALIDATORS.get(q_type)
        if validator is not None:
            validator(content, max_marks)
        return data


class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Quiz
        fields = [
            'id', 'lesson', 'title', 'description', 'time_limit_mins',
            'passing_score', 'max_attempts', 'questions',
        ]
        read_only_fields = ['lesson']


class QuizSubmissionSerializer(serializers.ModelSerializer):
    score_percent = serializers.ReadOnlyField()

    class Meta:
        model = QuizSubmission
        fields = [
            'id', 'student', 'quiz', 'score', 'total_marks', 'status',
            'started_at', 'finished_at', 'score_percent',
        ]
        read_only_fields = [
            'student', 'score', 'total_marks', 'status', 'started_at', 'finished_at',
        ]


class QuestionResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionResponse
        fields = [
            'id', 'submission', 'question', 'answer_data',
            'marks_obtained', 'feedback', 'marked_at',
        ]
        read_only_fields = ['marks_obtained', 'feedback', 'marked_at']
