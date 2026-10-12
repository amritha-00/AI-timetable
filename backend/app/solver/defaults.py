"""
Default weights and thresholds for the built-in soft constraints.

These apply automatically to every generated timetable (on top of whatever
soft constraints the admin adds via the LLM layer in Phase 3). Keeping them
as named constants here - rather than scattered magic numbers in
`model_builder.py` - makes the objective function's priorities easy to see
and tune in one place.
"""

# "Avoid the same subject more than twice a day for a class"
MAX_SAME_SUBJECT_PER_DAY = 2
SAME_SUBJECT_OVERUSE_WEIGHT = 8.0

# "Limit consecutive periods for a teacher (max 3 in a row)"
MAX_CONSECUTIVE_TEACHER_PERIODS = 3
CONSECUTIVE_OVERUSE_WEIGHT = 5.0

# "Balance each teacher's daily workload" - penalizes the spread between a
# teacher's busiest and lightest day of the week.
WORKLOAD_BALANCE_WEIGHT = 1.0

# Default weight used for a DB-stored soft constraint if its own `weight`
# column is left at the schema default (1.0) - i.e. this is just a fallback,
# the per-row weight from `constraints.weight` always takes precedence.
DEFAULT_SOFT_CONSTRAINT_WEIGHT = 3.0
