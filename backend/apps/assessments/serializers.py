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


def _decimals_for(tolerance):
    """Enough decimal places that rounding an option never moves it outside
    the marking tolerance."""
    try:
        t = float(tolerance)
    except (TypeError, ValueError):
        t = 0.01
    if t <= 0:
        return 6
    return min(6, max(2, len(f"{t:.10f}".rstrip("0").split(".")[1]) + 1))


def _fmt(value, places):
    v = round(float(value), places)
    return int(v) if v == int(v) else v


def calc_options(content, variables, seed=None):
    """Answer options for a calculated multichoice question: the correct value
    plus each distractor formula, evaluated with the student's own numbers,
    de-duplicated and shuffled. Empty list when there are no distractors (the
    question is then answered by typing a number)."""
    distractors = [d for d in (content.get('distractors') or []) if str(d).strip()]
    if not distractors:
        return []
    places = _decimals_for(content.get('tolerance', 0.01))
    correct = _safe_eval(content.get('formula', ''), variables)
    if correct is None:
        return []
    values = [_fmt(correct, places)]
    for d in distractors:
        v = _safe_eval(d, variables)
        if v is None:
            continue
        v = _fmt(v, places)
        if all(abs(v - x) > 1e-9 for x in values):
            values.append(v)
    if len(values) < 2:
        return []
    random.Random(seed).shuffle(values)
    return values


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
    zone_ids = {z.get('id') for z in content.get('zones') or []}
    if not any(it.get('correct_zone') in zone_ids for it in content.get('items') or []):
        raise serializers.ValidationError("Give at least one label a correct spot on the picture.")


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


def _norm_blank(text):
    """Forgive case, extra spaces and a trailing full stop/comma."""
    return " ".join(str(text or "").split()).strip(" .,;:!?").lower()


def _mark_fill_blanks(content, answer, max_marks):
    blanks = content.get('blanks') or {}
    if not blanks:
        return 0.0, ""
    student_blanks = answer.get('blanks') or {}
    correct = 0
    for key, val in blanks.items():
        # A blank may list alternatives separated by "|", e.g. "colour|color"
        accepted = {_norm_blank(a) for a in str(val).split("|") if _norm_blank(a)}
        if _norm_blank(student_blanks.get(key, "")) in accepted:
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
    # Labels without a correct_zone are distractors: they don't count towards
    # the score, but putting one on the picture costs the mark for that spot.
    items = content.get('items') or []
    scored = [it for it in items if it.get('correct_zone')]
    if not scored:
        return 0.0, ""
    placements = answer.get('placements') or {}
    taken_by_distractor = {
        placements.get(it.get('id')) for it in items
        if not it.get('correct_zone') and placements.get(it.get('id'))
    }
    correct = sum(
        1 for it in scored
        if placements.get(it.get('id')) == it.get('correct_zone')
        and it.get('correct_zone') not in taken_by_distractor
    )
    return (correct / len(scored)) * max_marks, ""


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


# ─── Student-facing serializers (no answer keys) ─────────────────────────────
#
# The admin serializers above return a question's full ``content``, which holds
# the marking key (correct_answer, blanks, keywords, formula, mappings, each
# item's correct_zone). Students must only receive what the player needs to
# draw the question, so each type has an explicit whitelist.

def _student_mcq(content):
    return {
        'options': list(content.get('options') or []),
        'is_multiple': bool(content.get('is_multiple')),
    }


def _student_fill_blanks(content):
    # The renderer builds the inputs from the [blankN] markers in the prompt.
    return {}


def _student_keyword_match(content):
    return {}


def _student_calculated_mcq(content):
    # Variable ranges are not secret and let the player fall back to local
    # generation; the formula and tolerance are the answer key.
    out = {'variables': content.get('variables') or {}}
    for key in ('units', 'unit'):
        if key in content:
            out[key] = content[key]
    return out


def _student_drag_drop_word(content):
    words = list(content.get('draggable_words') or [])
    if not words:
        words = sorted(set((content.get('mappings') or {}).values()), key=str)
    return {'draggable_words': words}


def _student_drag_drop_image(content):
    return {
        'background_url': content.get('background_url') or content.get('background_image') or '',
        'zones': list(content.get('zones') or []),
        'items': [
            {k: v for k, v in (item or {}).items() if k != 'correct_zone'}
            for item in (content.get('items') or [])
        ],
    }


_STUDENT_CONTENT = {
    Question.Type.MCQ: _student_mcq,
    Question.Type.FILL_BLANKS: _student_fill_blanks,
    Question.Type.KEYWORD_MATCH: _student_keyword_match,
    Question.Type.CALCULATED_MCQ: _student_calculated_mcq,
    Question.Type.DRAG_DROP_WORD: _student_drag_drop_word,
    Question.Type.DRAG_DROP_IMAGE: _student_drag_drop_image,
}


def student_safe_content(question_type, content):
    """Return the parts of ``content`` a student may see. Unknown types get
    nothing, so a new type can never leak its key by default."""
    builder = _STUDENT_CONTENT.get(question_type)
    return builder(content or {}) if builder else {}


class StudentQuestionSerializer(serializers.ModelSerializer):
    content = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = ['id', 'question_type', 'prompt', 'content', 'max_marks', 'order']

    def get_content(self, obj):
        return student_safe_content(obj.question_type, obj.content)


class StudentQuizSerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()
    attempts_used = serializers.SerializerMethodField()
    attempts_left = serializers.SerializerMethodField()
    best_score_percent = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            'id', 'lesson', 'title', 'description', 'time_limit_mins',
            'passing_score', 'max_attempts', 'questions',
            'attempts_used', 'attempts_left', 'best_score_percent',
        ]

    def _finished(self, obj):
        cache = self.context.setdefault('_finished_cache', {})
        if obj.pk not in cache:
            user = self.context['request'].user
            cache[obj.pk] = list(
                QuizSubmission.objects.filter(student=user, quiz=obj).exclude(
                    status=QuizSubmission.Status.IN_PROGRESS
                )
            )
        return cache[obj.pk]

    def get_questions(self, obj):
        qs = obj.questions.filter(is_active=True).order_by('order')
        return StudentQuestionSerializer(qs, many=True).data

    def get_attempts_used(self, obj):
        return len(self._finished(obj))

    def get_attempts_left(self, obj):
        if not obj.max_attempts:
            return None  # unlimited
        return max(obj.max_attempts - len(self._finished(obj)), 0)

    def get_best_score_percent(self, obj):
        scores = [s.score_percent for s in self._finished(obj)]
        return max(scores) if scores else None


def submission_deadline(submission):
    """When a timed attempt runs out, or None for untimed quizzes."""
    from datetime import timedelta
    mins = submission.quiz.time_limit_mins
    if not mins or not submission.started_at:
        return None
    return submission.started_at + timedelta(minutes=mins)


class QuizSubmissionSerializer(serializers.ModelSerializer):
    score_percent = serializers.ReadOnlyField()
    deadline = serializers.SerializerMethodField()
    seconds_left = serializers.SerializerMethodField()

    class Meta:
        model = QuizSubmission
        fields = [
            'id', 'student', 'quiz', 'score', 'total_marks', 'status',
            'started_at', 'finished_at', 'score_percent', 'deadline', 'seconds_left',
        ]

    def get_deadline(self, obj):
        d = submission_deadline(obj)
        return d.isoformat() if d else None

    def get_seconds_left(self, obj):
        from django.utils import timezone
        d = submission_deadline(obj)
        if not d:
            return None
        return max(0, int((d - timezone.now()).total_seconds()))
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
