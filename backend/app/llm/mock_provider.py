"""
A deterministic, offline, regex-based "provider" - NOT one of the two
required providers (Anthropic / AWS Bedrock). It exists purely so the whole
constraint pipeline (parsing -> validation -> DB entity resolution ->
ambiguity detection -> persistence) can be developed and tested without
spending API credits or requiring cloud credentials to be configured.

Set `LLM_PROVIDER=mock` in `.env` to use it. It intentionally has modest
coverage - it recognizes the common sentence patterns used in the Phase 5
evaluation set, not arbitrary phrasing. Real accuracy numbers should always
be measured against `anthropic` or `bedrock`, never against this.
"""
from __future__ import annotations

import re
from typing import Any

from app.llm.base import LLMProvider

_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
_MORNING = [1, 2, 3, 4]
_AFTERNOON = [5, 6, 7, 8]

_NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "first": 1, "second": 2,
}


def _find_days(text: str) -> list[str]:
    found = [d for d in _DAY_NAMES if d.lower() in text.lower()]
    if not found:
        if "end of the week" in text.lower() or "end of week" in text.lower():
            found = ["Friday", "Saturday"]
        elif "weekdays" in text.lower():
            found = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    return found


def _find_periods(text: str) -> list[int]:
    lowered = text.lower()
    if "morning" in lowered:
        return _MORNING
    if "afternoon" in lowered:
        return _AFTERNOON
    nums = [int(n) for n in re.findall(r"period\s+(\d)", lowered)]
    if nums:
        return nums
    m = re.search(r"first\s+(\w+)\s+periods?", lowered)
    if m and m.group(1) in _NUMBER_WORDS:
        return list(range(1, _NUMBER_WORDS[m.group(1)] + 1))
    return []


def _find_number(text: str, default: int | None = None) -> int | None:
    """Looks specifically for the number right after 'more than'/'exceed' (the
    quantity these sentences are actually constraining) before falling back
    to the first bare number anywhere - a bare-number-anywhere search would
    wrongly grab a grade number like the '10' in 'Grade 10' instead of the
    '2' in 'more than 2 periods'."""
    m = re.search(r"(?:more than|exceed(?:ing)?|over)\s+(\d+)", text, re.IGNORECASE)
    if m:
        return int(m.group(1))
    for word, val in _NUMBER_WORDS.items():
        if re.search(rf"(?:more than|exceed(?:ing)?|over)\s+{word}\b", text.lower()):
            return val
    m = re.search(r"\b(\d+)\b", text)
    if m:
        return int(m.group(1))
    for word, val in _NUMBER_WORDS.items():
        if re.search(rf"\b{word}\b", text.lower()):
            return val
    return default


def _extract_proper_noun_phrase(text: str, stop_words: set[str]) -> str | None:
    """Very rough heuristic: the FIRST run of capitalized words that isn't a
    sentence-starter word or a day name (teacher names in the test sentences
    overwhelmingly appear before the verb, e.g. 'Rao can't teach...',
    'Mrs. Gupta prefers...', and day names are frequently also capitalized
    and would otherwise be picked as a longer, wrong match)."""
    candidates = re.findall(r"(?:[A-Z][a-zA-Z]*\.?\s*){1,4}", text)
    candidates = [c.strip().rstrip(".") for c in candidates if c.strip()]
    candidates = [
        c for c in candidates
        if c.split()[0] not in stop_words and c not in _DAY_NAMES and c.split()[0] not in _DAY_NAMES
    ]
    return candidates[0] if candidates else None


_SENTENCE_STARTERS = {"The", "A", "An", "Class", "Grade", "Mrs", "Mr", "Ms", "Dr"}


class MockProvider(LLMProvider):
    def complete_structured(
        self, system_prompt: str, user_message: str, json_schema: dict[str, Any], schema_name: str
    ) -> dict[str, Any]:
        text = user_message.strip()
        lowered = text.lower()

        # --- no_consecutive: "shouldn't teach more than N periods back to back / in a row"
        if re.search(r"back.to.back|in a row|consecutive", lowered):
            name = _extract_proper_noun_phrase(text, _SENTENCE_STARTERS) or "Unknown"
            n = _find_number(text, default=3)
            return {
                "result": "parsed",
                "parsed": {
                    "payload": {"constraint_type": "no_consecutive", "teacher_name": name, "max_consecutive": n},
                    "severity": "soft",
                    "weight": 5.0,
                    "explanation": f"{name} should not teach more than {n} periods in a row.",
                    "confidence": "medium",
                },
            }

        # --- teacher_unavailable: "can't teach" / "unavailable" / "not available"
        if re.search(r"can'?t teach|unavailable|not available|cannot teach", lowered):
            name = _extract_proper_noun_phrase(text, _SENTENCE_STARTERS) or "Unknown"
            days = _find_days(text) or ["Friday"]
            periods = _find_periods(text)
            return {
                "result": "parsed",
                "parsed": {
                    "payload": {
                        "constraint_type": "teacher_unavailable",
                        "teacher_name": name,
                        "day_names": days,
                        "periods": periods,
                    },
                    "severity": "hard",
                    "weight": 1.0,
                    "explanation": f"{name} is unavailable on {', '.join(days)}"
                    + (f" during periods {periods}" if periods else " (all day)") + ".",
                    "confidence": "medium",
                },
            }

        # --- teacher_preferred_slot: "prefers"
        if "prefer" in lowered and "class" not in lowered.split("prefer")[0][-10:]:
            name = _extract_proper_noun_phrase(text, _SENTENCE_STARTERS) or "Unknown"
            days = _find_days(text)
            periods = _find_periods(text) or _MORNING
            return {
                "result": "parsed",
                "parsed": {
                    "payload": {
                        "constraint_type": "teacher_preferred_slot",
                        "teacher_name": name,
                        "day_names": days,
                        "periods": periods,
                    },
                    "severity": "soft",
                    "weight": 3.0,
                    "explanation": f"{name} prefers teaching during periods {periods}.",
                    "confidence": "medium",
                },
            }

        # --- room_requirement: "should always be in" / "must be in" + room
        if re.search(r"should (always )?be in|must be in|use the .* lab|held in", lowered):
            subj = _extract_proper_noun_phrase(text.split(" should")[0].split(" must")[0], _SENTENCE_STARTERS)
            room_match = re.search(r"(computer lab \d?|science lab \d?|room-?\s?\d+|auditorium)", lowered)
            room = room_match.group(1).title() if room_match else None
            if subj and room:
                return {
                    "result": "parsed",
                    "parsed": {
                        "payload": {
                            "constraint_type": "room_requirement",
                            "subject_name": subj,
                            "class_name": None,
                            "room_names": [room],
                        },
                        "severity": "hard",
                        "weight": 1.0,
                        "explanation": f"{subj} must always be scheduled in {room}.",
                        "confidence": "medium",
                    },
                }

        # --- max_periods_per_day: "shouldn't have more than N X periods a day" or "don't give TEACHER more than N periods"
        if "more than" in lowered and "period" in lowered:
            n = _find_number(text, default=2)
            if re.search(r"give|assign", lowered):
                name = _extract_proper_noun_phrase(text, _SENTENCE_STARTERS) or "Unknown"
                return {
                    "result": "parsed",
                    "parsed": {
                        "payload": {
                            "constraint_type": "max_periods_per_day",
                            "scope": "teacher",
                            "teacher_name": name,
                            "max_periods": n,
                        },
                        "severity": "soft",
                        "weight": 4.0,
                        "explanation": f"{name} should not teach more than {n} periods a day.",
                        "confidence": "low",
                    },
                }
            class_match = re.search(r"(grade \d+\s*-?\s*[a-z]|class \d+[a-z]?)", lowered)
            subj_match = re.search(
                r"(mathematics|maths|science|english|hindi|social studies|computer science|"
                r"physical education|art|sanskrit|general knowledge)",
                lowered,
            )
            if class_match and subj_match:
                return {
                    "result": "parsed",
                    "parsed": {
                        "payload": {
                            "constraint_type": "max_periods_per_day",
                            "scope": "class_subject",
                            "class_name": class_match.group(1).title(),
                            "subject_name": subj_match.group(1).title(),
                            "max_periods": n,
                        },
                        "severity": "soft",
                        "weight": 4.0,
                        "explanation": f"{class_match.group(1).title()} should not have more than {n} "
                        f"{subj_match.group(1).title()} periods a day.",
                        "confidence": "low",
                    },
                }

        # --- subject_time_preference: "SUBJECT should be in ... periods for CLASS"
        if re.search(r"should be (in|during|held)", lowered):
            subj_match = re.search(
                r"(mathematics|maths|science|english|hindi|social studies|computer science|"
                r"physical education|art|sanskrit|general knowledge)",
                lowered,
            )
            class_match = re.search(r"(grade \d+\s*-?\s*[a-z]|class \d+[a-z]?)", lowered)
            periods = _find_periods(text)
            if subj_match and periods:
                return {
                    "result": "parsed",
                    "parsed": {
                        "payload": {
                            "constraint_type": "subject_time_preference",
                            "subject_name": subj_match.group(1).title(),
                            "class_name": class_match.group(1).title() if class_match else None,
                            "day_names": _find_days(text),
                            "periods": periods,
                        },
                        "severity": "soft",
                        "weight": 3.0,
                        "explanation": f"{subj_match.group(1).title()} should be scheduled in periods {periods}"
                        + (f" for {class_match.group(1).title()}" if class_match else " for all classes") + ".",
                        "confidence": "medium",
                    },
                }

        return {
            "result": "unparseable",
            "error_message": (
                "The mock provider (offline/dev mode) couldn't match this sentence to a known pattern. "
                "Try a real LLM provider (LLM_PROVIDER=anthropic or bedrock) for general-purpose parsing."
            ),
        }

    def complete_text(self, system_prompt: str, user_message: str) -> str:
        return (
            "[mock provider] " + user_message.strip().splitlines()[0]
            if user_message.strip()
            else "[mock provider] (no explanation available)"
        )
