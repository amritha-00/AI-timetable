"""
Assigns concrete room ids to solved (class, day, period, subject) slots.

The CP-SAT model only tracks *pool capacity* (see `model_builder.py`), not
room identity, so this is a separate deterministic pass. It is always
feasible: the pool-capacity constraint in the model guarantees that at most
`len(pool)` slots ever compete for a given pool at a given (day, period), so
a simple greedy "first free room in the pool" assignment can never run out.
"""
from __future__ import annotations

from collections import defaultdict


def assign_rooms(
    solved_slots: list[tuple[int, int, int, int]],  # (class_id, day_id, period_id, subject_id)
    effective_room_pool: dict[tuple[int, int], tuple[int, ...]],
) -> dict[tuple[int, int, int, int], int]:
    """Returns {(class_id, day_id, period_id, subject_id): room_id}."""
    used_at_slot: dict[tuple[int, int], set[int]] = defaultdict(set)  # (day_id, period_id) -> used room ids
    assignment: dict[tuple[int, int, int, int], int] = {}

    for class_id, day_id, period_id, subject_id in solved_slots:
        pool = effective_room_pool.get((class_id, subject_id), ())
        used = used_at_slot[(day_id, period_id)]
        room_id = next((r for r in pool if r not in used), None)
        if room_id is None:
            # Should be unreachable given the model's pool-capacity constraint;
            # fail loudly rather than silently double-booking a room.
            raise RuntimeError(
                f"No free room in pool {pool} for class={class_id} subject={subject_id} "
                f"at day={day_id} period={period_id} - this indicates a bug in the "
                f"pool-capacity constraint, not a genuine scheduling conflict."
            )
        used.add(room_id)
        assignment[(class_id, day_id, period_id, subject_id)] = room_id

    return assignment
