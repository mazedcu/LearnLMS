"""
Failed-login lockout
--------------------
After LOCK_AFTER wrong passwords for one email address, that account can't
sign in for LOCK_MINUTES. Counts only failures, and resets on success, so
students signing in normally are never affected. Works per account rather
than per IP because a whole class may share one school internet connection.
"""
from django.core.cache import cache

LOCK_AFTER = 8
LOCK_MINUTES = 15


def _key(email):
    return f"login-fail:{(email or '').strip().lower()}"


def is_locked(email):
    return cache.get(_key(email), 0) >= LOCK_AFTER


def record_failure(email):
    key = _key(email)
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, LOCK_MINUTES * 60)
        count = 1
    if count == LOCK_AFTER:
        cache.touch(key, LOCK_MINUTES * 60)  # lock window starts now
    return count


def clear(email):
    cache.delete(_key(email))
