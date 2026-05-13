"""
DeepSeek AI Marking Service
----------------------------
Uses the OpenAI-compatible DeepSeek API to evaluate student answers
against a provided markscheme.

Set USE_MOCK=True in settings (or leave DEEPSEEK_API_KEY empty) to use
the MockAIMarkingService during development without an API key.
"""
import json
import logging
from datetime import datetime

from django.conf import settings

logger = logging.getLogger(__name__)


class AIMarkingService:
    """Production service — calls DeepSeek API."""

    SYSTEM_PROMPT = (
        "You are a professional exam marker. "
        "You will be given a markscheme and a student's answer. "
        "Evaluate the answer fairly and return a JSON object with exactly these keys:\n"
        "  score (int): marks awarded\n"
        "  max_score (int): maximum possible marks\n"
        "  feedback (str): concise, educational feedback for the student\n"
        "  breakdown (list of str): bullet points explaining each mark awarded or lost\n"
        "Return ONLY valid JSON, no surrounding text."
    )

    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
        )
        self.model = settings.DEEPSEEK_MODEL

    def mark(self, question, answer_text: str) -> dict:
        user_message = (
            f"Markscheme:\n{question.markscheme}\n\n"
            f"Maximum marks: {question.max_marks}\n\n"
            f"Student answer:\n{answer_text}"
        )
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            raw = response.choices[0].message.content
            result = json.loads(raw)
            result['_raw'] = raw
            return result
        except Exception as exc:
            logger.error("DeepSeek marking failed: %s", exc)
            return {
                "score": 0,
                "max_score": question.max_marks,
                "feedback": "Automated marking is temporarily unavailable. Your instructor will review this.",
                "breakdown": [],
                "_error": str(exc),
            }


class MockAIMarkingService:
    """
    Development mock — returns plausible responses without calling any API.
    Activated when settings.USE_MOCK_AI is True or DEEPSEEK_API_KEY is empty.
    """

    def mark(self, question, answer_text: str) -> dict:
        # Simple heuristic: award marks proportional to answer length (for testing)
        words = len(answer_text.split())
        ratio = min(words / 50, 1.0)  # 50 words = full marks (mock only)
        awarded = round(question.max_marks * ratio)

        return {
            "score": awarded,
            "max_score": question.max_marks,
            "feedback": (
                f"[MOCK] Your answer contained {words} words. "
                f"You scored {awarded}/{question.max_marks}. "
                "This is a development mock response — real AI marking will be enabled in production."
            ),
            "breakdown": [
                f"[MOCK] Content relevance: {awarded} mark(s) awarded based on answer length heuristic.",
                "[MOCK] Replace with real DeepSeek evaluation in production.",
            ],
            "_mock": True,
        }


def get_ai_marking_service():
    """Factory — returns mock or real service based on settings."""
    use_mock = getattr(settings, 'USE_MOCK_AI', False) or not getattr(settings, 'DEEPSEEK_API_KEY', '')
    if use_mock:
        logger.info("Using MockAIMarkingService (development mode)")
        return MockAIMarkingService()
    return AIMarkingService()
