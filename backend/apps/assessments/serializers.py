from rest_framework import serializers
from .models import AIQuestion, AISubmission, MoodleQuiz, QuizAttempt


class AIQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIQuestion
        fields = ['id', 'lesson', 'question_text', 'max_marks', 'order', 'is_active']
        # markscheme excluded — never sent to student


class AIQuestionAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIQuestion
        fields = '__all__'


class AISubmissionSerializer(serializers.ModelSerializer):
    final_score = serializers.IntegerField(read_only=True)
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    max_marks = serializers.IntegerField(source='question.max_marks', read_only=True)

    class Meta:
        model = AISubmission
        fields = [
            'id', 'question', 'question_text', 'answer_text', 'submitted_at',
            'ai_score', 'ai_feedback', 'ai_breakdown',
            'teacher_score', 'teacher_feedback', 'is_reviewed',
            'final_score', 'max_marks',
        ]
        read_only_fields = [
            'id', 'submitted_at', 'ai_score', 'ai_feedback', 'ai_breakdown',
            'teacher_score', 'teacher_feedback', 'is_reviewed', 'final_score',
        ]


class SubmitAnswerSerializer(serializers.Serializer):
    answer_text = serializers.CharField(min_length=1)


class OverrideScoreSerializer(serializers.Serializer):
    teacher_score    = serializers.IntegerField(min_value=0)
    teacher_feedback = serializers.CharField(allow_blank=True, default='')


class MoodleQuizSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodleQuiz
        fields = ['id', 'lesson', 'moodle_quiz_id', 'title', 'time_limit_secs', 'max_attempts', 'is_active']


class QuizAttemptSerializer(serializers.ModelSerializer):
    score_percent = serializers.FloatField(read_only=True)

    class Meta:
        model = QuizAttempt
        fields = [
            'id', 'moodle_quiz', 'moodle_attempt_id', 'score', 'max_score',
            'score_percent', 'status', 'started_at', 'finished_at',
        ]
