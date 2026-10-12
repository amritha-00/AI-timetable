"""
Top-level orchestration: load data -> build model -> solve -> persist.

This is the only module the API layer talks to (`app/routers/timetables.py`).
Everything else in `app/solver/` is an implementation detail behind
`generate_timetable()`.
"""
from __future__ import annotations

from dataclasses import dataclass

from ortools.sat.python import cp_model
from sqlalchemy.orm import Session

from app.config import settings
from app.models.timetable import Timetable, TimetableEntry, TimetableStatus
from app.solver.conflict_explainer import explain_infeasibility, pre_check
from app.solver.data_loader import SolverInput, load_solver_input
from app.solver.model_builder import ModelBundle, build_model
from app.solver.room_assigner import assign_rooms


@dataclass
class GenerationResult:
    timetable: Timetable
    solver_status: str


def generate_timetable(
    db: Session, tenant_id: int, name: str, time_limit_seconds: int | None = None, include_soft: bool = True
) -> GenerationResult:
    """
    Run the full pipeline and persist the result as a new `Timetable` row
    (with `TimetableEntry` rows on success). Always returns - failure is
    represented as `Timetable.status == FAILED` with an explanatory message,
    never as a raised exception (so the API layer has one, tolerant path).
    """
    si = load_solver_input(db, tenant_id)
    if not include_soft:
        si.active_constraints = [c for c in si.active_constraints if c.severity.value == "hard"]

    problems = pre_check(si)
    if problems:
        timetable = Timetable(
            tenant_id=tenant_id,
            name=name,
            status=TimetableStatus.FAILED,
            message="Cannot generate a timetable - found structural problems before even trying to solve:\n"
            + "\n".join(f"  - {p}" for p in problems),
        )
        db.add(timetable)
        db.commit()
        db.refresh(timetable)
        return GenerationResult(timetable=timetable, solver_status="PRECHECK_FAILED")

    bundle = build_model(si)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds or settings.solver_max_seconds
    solver.parameters.num_search_workers = settings.solver_num_workers
    status = solver.Solve(bundle.model)
    status_name = solver.StatusName(status)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        timetable = _persist_solution(db, tenant_id, name, si, bundle, solver, status_name)
        return GenerationResult(timetable=timetable, solver_status=status_name)

    # INFEASIBLE or UNKNOWN/timed-out-with-nothing-found: explain why.
    diagnosis = explain_infeasibility(si)
    timetable = Timetable(
        tenant_id=tenant_id,
        name=name,
        status=TimetableStatus.FAILED,
        message=f"Solver status: {status_name}.\n\n{diagnosis.message}",
    )
    db.add(timetable)
    db.commit()
    db.refresh(timetable)
    return GenerationResult(timetable=timetable, solver_status=status_name)


def _persist_solution(
    db: Session,
    tenant_id: int,
    name: str,
    si: SolverInput,
    bundle: ModelBundle,
    solver: cp_model.CpSolver,
    status_name: str,
) -> Timetable:
    solved_slots: list[tuple[int, int, int, int]] = []
    teacher_for_slot: dict[tuple[int, int, int, int], int] = {}

    for (c_id, d_id, p_id, s_id), var in bundle.subject_assigned.items():
        if solver.Value(var) == 1:
            solved_slots.append((c_id, d_id, p_id, s_id))

    for (c_id, d_id, p_id, s_id, t_id), var in bundle.teacher_assigned.items():
        if solver.Value(var) == 1:
            teacher_for_slot[(c_id, d_id, p_id, s_id)] = t_id

    room_for_slot = assign_rooms(solved_slots, bundle.effective_room_pool)

    objective_value = solver.ObjectiveValue() if bundle.model.HasObjective() else 0.0
    is_optimal = status_name == "OPTIMAL"
    summary_lines = [
        f"Solver status: {status_name}{' (proven optimal)' if is_optimal else ' (best found within time limit)'}.",
        f"Scheduled {len(solved_slots)} class-periods across {len(si.classes)} classes.",
        f"Soft-constraint penalty score: {objective_value:g} (lower is better; 0 = no soft-constraint violations).",
    ]
    if bundle.applied_notes:
        summary_lines.append("Active custom constraints applied:")
        summary_lines.extend(f"  - {note}" for note in bundle.applied_notes)
    if bundle.skipped_notes:
        summary_lines.append("Custom constraints skipped:")
        summary_lines.extend(f"  - {note}" for note in bundle.skipped_notes)

    timetable = Timetable(
        tenant_id=tenant_id,
        name=name,
        status=TimetableStatus.COMPLETED,
        score=objective_value,
        message="\n".join(summary_lines),
    )
    db.add(timetable)
    db.flush()  # get timetable.id without a full commit yet

    entries = [
        TimetableEntry(
            timetable_id=timetable.id,
            class_id=c_id,
            day_id=d_id,
            period_id=p_id,
            subject_id=s_id,
            teacher_id=teacher_for_slot[(c_id, d_id, p_id, s_id)],
            room_id=room_for_slot[(c_id, d_id, p_id, s_id)],
        )
        for (c_id, d_id, p_id, s_id) in solved_slots
    ]
    db.add_all(entries)
    db.commit()
    db.refresh(timetable)
    return timetable
