"""
Moodle REST API Client
----------------------
Proxies all Moodle quiz operations through Django so that:
  - The service account token never reaches the browser
  - Students authenticate via Django JWT, not Moodle

Moodle instance: https://campus.rawdatun.org
"""
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

MOODLE_BASE = "https://campus.rawdatun.org"
REST_ENDPOINT = f"{MOODLE_BASE}/webservice/rest/server.php"


class MoodleAPIError(Exception):
    pass


class MoodleClient:
    """Thin wrapper around Moodle Web Services REST API."""

    def __init__(self):
        self.token = getattr(settings, 'MOODLE_SERVICE_TOKEN', '')
        self.base_url = MOODLE_BASE

    def _call(self, function: str, **params) -> dict:
        if not self.token:
            raise MoodleAPIError("MOODLE_SERVICE_TOKEN is not configured.")
        payload = {
            "wstoken": self.token,
            "wsfunction": function,
            "moodlewsrestformat": "json",
            **params,
        }
        try:
            resp = requests.post(REST_ENDPOINT, data=payload, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and "exception" in data:
                raise MoodleAPIError(f"Moodle error: {data.get('message', data)}")
            return data
        except requests.RequestException as exc:
            logger.error("Moodle API request failed (%s): %s", function, exc)
            raise MoodleAPIError(str(exc)) from exc

    # ------------------------------------------------------------------ #
    # Quiz operations                                                       #
    # ------------------------------------------------------------------ #

    def get_quiz_info(self, quiz_id: int) -> dict:
        """Fetch quiz metadata by Moodle quiz ID."""
        data = self._call("mod_quiz_get_quizzes_by_courses", courseids=[])
        quizzes = data.get("quizzes", [])
        for q in quizzes:
            if q["id"] == quiz_id:
                return q
        raise MoodleAPIError(f"Quiz {quiz_id} not found on Moodle.")

    def start_attempt(self, quiz_id: int) -> dict:
        """Start a new quiz attempt. Returns attempt data."""
        return self._call("mod_quiz_start_attempt", quizid=quiz_id)

    def get_attempt_data(self, attempt_id: int, page: int = 0) -> dict:
        """Fetch questions for a given attempt page."""
        return self._call("mod_quiz_get_attempt_data", attemptid=attempt_id, page=page)

    def process_attempt(self, attempt_id: int, data: list, finish: bool = False) -> dict:
        """Submit answers for an attempt. Set finish=True to finalize."""
        params = {
            "attemptid": attempt_id,
            "finishattempt": 1 if finish else 0,
        }
        # Moodle expects data as indexed params: data[0][name], data[0][value], ...
        for i, item in enumerate(data):
            params[f"data[{i}][name]"] = item["name"]
            params[f"data[{i}][value]"] = item["value"]
        return self._call("mod_quiz_process_attempt", **params)

    def get_attempt_review(self, attempt_id: int) -> dict:
        """Fetch the review/results of a finished attempt."""
        return self._call("mod_quiz_get_attempt_review", attemptid=attempt_id)

    def get_attempt_summary(self, attempt_id: int) -> dict:
        return self._call("mod_quiz_get_attempt_summary", attemptid=attempt_id)

    # ------------------------------------------------------------------ #
    # H5P                                                                   #
    # ------------------------------------------------------------------ #

    def get_h5p_embed_url(self, resource_id: int) -> str:
        """Return the embed URL for an H5P activity on Moodle."""
        return f"{self.base_url}/mod/hvp/embed.php?id={resource_id}"


class MockMoodleClient(MoodleClient):
    """
    Development mock — returns realistic fake Moodle data.
    Used when MOODLE_SERVICE_TOKEN is not set.
    """

    def _call(self, function: str, **params) -> dict:
        logger.info("[MOCK] Moodle call: %s params=%s", function, params)
        return {}

    def get_quiz_info(self, quiz_id: int) -> dict:
        return {
            "id": quiz_id,
            "name": f"[MOCK] Sample Quiz #{quiz_id}",
            "timelimit": 1800,
            "attempts": 1,
        }

    def start_attempt(self, quiz_id: int) -> dict:
        return {"attempt": {"id": 9001, "quiz": quiz_id, "state": "inprogress"}}

    def get_attempt_data(self, attempt_id: int, page: int = 0) -> dict:
        return {
            "attempt": {"id": attempt_id, "state": "inprogress"},
            "questions": [
                {
                    "slot": 1,
                    "type": "multichoice",
                    "html": (
                        "<p>[MOCK] Which of the following is a programming language?</p>"
                        "<ul><li>A) Python</li><li>B) Banana</li><li>C) Oxygen</li></ul>"
                    ),
                    "sequencecheck": 1,
                }
            ],
        }

    def process_attempt(self, attempt_id: int, data: list, finish: bool = False) -> dict:
        return {"state": "finished" if finish else "inprogress"}

    def get_attempt_review(self, attempt_id: int) -> dict:
        return {
            "attempt": {"id": attempt_id, "sumgrades": 8.0},
            "grade": "8.00 / 10.00",
            "questions": [],
        }


def get_moodle_client() -> MoodleClient:
    """Factory — returns mock if token not configured."""
    from django.conf import settings
    token = getattr(settings, 'MOODLE_SERVICE_TOKEN', '')
    if not token:
        logger.info("Using MockMoodleClient (no service token configured)")
        return MockMoodleClient()
    return MoodleClient()
