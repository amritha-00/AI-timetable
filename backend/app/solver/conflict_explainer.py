"""
When no feasible timetable exists, don't just say "infeasible" - explain why.

Two layers of diagnosis:

1. **Static pre-checks** (`pre_check`): fast, necessary-condition arithmetic
   run *before* even trying CP-SAT. These catch the overwhelming majority of
   real-world infeasibility causes (not enough teachers for a subject, not
   enough room capacity, a class asked for more periods/week than exist) in
   milliseconds, with a precise, human-readable explanation.

2. **Constraint relaxation** (`explain_infeasibility`): if the pre-checks
   pass but CP-SAT still reports INFEASIBLE (usually because of *interacting*
   constraints, e.g. two teacher_unavailable rules that jointly starve a
   subject), re-solve the model repeatedly with each active hard DB
   constraint disabled one at a time, using a short time budget. Whichever
   removal(s) turn the model feasible are reported as the likely culprits.
"""
from __future__ import annotations

from dataclasses import dataclass

from ortools.sat.python import cp_model

from app.models.constraint import Constraint
from app.solver.data_loader import SolverInput
from app.solver.model_builder import build_model


@dataclass
class Diagnosis:
    feasible: bool
    message: str


def pre_check(si: SolverInput) -> list[str]:
    """Fast necessary-condition checks. Returns a list of problem descriptions
    (empty list means nothing obviously wrong - doesn't guarantee feasibility,
    since interactions between constraints can't be caught this way)."""
    problems: list[str] = []
    num_days = len(si.days)
    num_periods = len(si.periods)
    total_slots_per_class = num_days * num_periods

    # 0. No rooms of the type a subject needs - a fresh tenant with zero
    # rooms would otherwise crash the solver's room-assignment step instead
    # of getting a readable message (every new signup starts with no rooms).
    subjects_needing_rooms = {
        s_id for c in si.classes for s_id, ppw in si.requirements_by_class.get(c.id, {}).items() if ppw > 0
    }
    missing_room_type_subjects = sorted(
        si.subjects_by_id[s_id].name
        for s_id in subjects_needing_rooms
        if s_id in si.subjects_by_id and not si.room_pool_for_subject(s_id)
    )
    if missing_room_type_subjects:
        has_rooms = bool(si.classroom_room_ids or si.lab_room_ids)
        if not has_rooms:
            problems.append("No rooms have been added yet. Add at least one room before generating a timetable.")
        else:
            problems.append(
                "These subjects need a room type that doesn't exist yet: "
                + ", ".join(missing_room_type_subjects)
                + ". Add a classroom or lab room (as appropriate) on the Rooms page."
            )

    # 1. Per-class total load vs available slots
    for c in si.classes:
        total_required = sum(si.requirements_by_class.get(c.id, {}).values())
        if total_required > total_slots_per_class:
            problems.append(
                f"{c.display_name} requires {total_required} periods/week but only "
                f"{total_slots_per_class} teaching slots exist ({num_days} days x {num_periods} periods). "
                f"Reduce its subject requirements or add more days/periods."
            )

    # 2a. Pinned-teacher overload: a teacher's pinned commitments (across ANY
    # class/subject - a teacher's weekly capacity is shared, not per-subject)
    # can't exceed what they can physically teach.
    pinned_load_by_teacher: dict[int, int] = {}
    for c in si.classes:
        for s_id, ppw in si.requirements_by_class.get(c.id, {}).items():
            pinned_teacher = si.pinned_teacher_by_class_subject.get((c.id, s_id))
            if pinned_teacher is not None:
                pinned_load_by_teacher[pinned_teacher] = pinned_load_by_teacher.get(pinned_teacher, 0) + ppw

    for t_id, load in pinned_load_by_teacher.items():
        teacher = si.teachers_by_id.get(t_id)
        if teacher is None:
            continue
        capacity = teacher.max_periods_per_day * num_days
        if load > capacity:
            problems.append(
                f"{teacher.name} is pinned to teach {load} periods/week total across their assigned "
                f"class+subject combinations, but can only teach {capacity} (given max_periods_per_day="
                f"{teacher.max_periods_per_day}). Unpin one of their assignments or raise their daily limit."
            )

    # 2b. Per-subject teacher capacity vs total *unpinned* demand - pinned
    # requirements are already guaranteed a teacher, so they're excluded from
    # the shared pool on both sides (demand and capacity).
    unpinned_demand_by_subject: dict[int, int] = {}
    for c in si.classes:
        for s_id, ppw in si.requirements_by_class.get(c.id, {}).items():
            if (c.id, s_id) not in si.pinned_teacher_by_class_subject:
                unpinned_demand_by_subject[s_id] = unpinned_demand_by_subject.get(s_id, 0) + ppw

    for s_id, demand in unpinned_demand_by_subject.items():
        subject = si.subjects_by_id.get(s_id)
        subject_name = subject.name if subject else f"subject #{s_id}"
        qualified = si.qualified_teachers_for_subject.get(s_id, [])
        if not qualified:
            problems.append(
                f"No active teacher is qualified to teach {subject_name}, but it is required "
                f"by at least one class. Assign a qualified teacher (Teacher subjects) or remove the requirement."
            )
            continue
        capacity = sum(
            max(0, si.teachers_by_id[t_id].max_periods_per_day * num_days - pinned_load_by_teacher.get(t_id, 0))
            for t_id in qualified
            if t_id in si.teachers_by_id
        )
        if demand > capacity:
            problems.append(
                f"{subject_name} needs {demand} teacher-periods/week from classes without a pinned teacher, "
                f"but its {len(qualified)} qualified teacher(s) can only cover {capacity} once their other "
                f"commitments (including any pinned assignments) are accounted for. Qualify another teacher "
                f"for {subject_name}, pin fewer of them elsewhere, or reduce demand."
            )

    # 3. Room pool capacity vs total demand (loose necessary condition: total
    # weekly demand on a pool can't exceed what the pool can host in a week)
    demand_by_pool: dict[tuple[int, ...], int] = {}
    pool_label: dict[tuple[int, ...], str] = {}
    for c in si.classes:
        for s_id, ppw in si.requirements_by_class.get(c.id, {}).items():
            pool = tuple(si.room_pool_for_subject(s_id))
            demand_by_pool[pool] = demand_by_pool.get(pool, 0) + ppw
            subject = si.subjects_by_id.get(s_id)
            if pool not in pool_label:
                pool_label[pool] = "lab rooms" if subject and subject.is_lab else "classrooms"

    for pool, demand in demand_by_pool.items():
        if not pool:
            continue
        capacity = len(pool) * total_slots_per_class
        if demand > capacity:
            problems.append(
                f"Total weekly demand for {pool_label[pool]} ({demand} class-periods) exceeds what "
                f"{len(pool)} such room(s) can host ({capacity} class-periods/week). Add more rooms of "
                f"that type or reduce demand."
            )

    return problems


def explain_infeasibility(si: SolverInput, per_attempt_seconds: float = 5.0) -> Diagnosis:
    """Called only after CP-SAT itself reports INFEASIBLE. Tries disabling
    each active hard DB constraint in turn to find the likely culprit(s)."""
    hard_constraints = [c for c in si.active_constraints if c.severity.value == "hard"]

    culprits: list[Constraint] = []
    for constraint in hard_constraints:
        bundle = build_model(si, disabled_constraint_ids={constraint.id})
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = per_attempt_seconds
        solver.parameters.num_search_workers = 4
        status = solver.Solve(bundle.model)
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            culprits.append(constraint)

    if culprits:
        lines = [
            f"  - #{c.id} ({c.constraint_type.value}): \"{c.raw_text}\""
            for c in culprits
        ]
        message = (
            "No feasible timetable exists with all hard constraints active. Removing any ONE of the "
            "following (individually) would make it feasible again, so they are the most likely source "
            "of the conflict - consider relaxing, correcting, or deactivating one of them:\n"
            + "\n".join(lines)
        )
        return Diagnosis(feasible=False, message=message)

    if hard_constraints:
        message = (
            "No feasible timetable exists, and removing any single hard constraint you've added "
            "(teacher unavailability, preferred slots, etc.) does not fix it on its own - the conflict "
            "comes from how multiple constraints interact together, or from the base scheduling rules "
            "(teacher/room/class capacity). Try relaxing more than one constraint at once, or review "
            "the capacity numbers below."
        )
    else:
        message = (
            "No feasible timetable exists even with no custom constraints active. This points to the "
            "base data itself - teacher qualifications, room counts, or subject period requirements are "
            "too tight for the number of classes, days, and periods available."
        )
    return Diagnosis(feasible=False, message=message)
