"""
Builds the CP-SAT model for one timetable-generation run.

Variable design
----------------
Rather than one giant `x[class, day, period, subject, teacher, room]`
variable (which explodes combinatorially), the model factors the decision
into two layers:

  subject_assigned[c, d, p, s]   - is class c taught subject s at (d, p)?
  teacher_assigned[c, d, p, s, t] - ...and if so, by teacher t?

Rooms are *not* given per-instance identity variables. Classrooms are
interchangeable within a type (classroom vs lab), so the model only tracks
*how many* classroom-pool / lab-pool slots are used at each (day, period) and
caps that by the number of rooms of that type. This keeps the model roughly
an order of magnitude smaller than a fully-disaggregated one. A concrete
room id is then assigned deterministically after solving, in
`room_assigner.py` - always feasible, because the pool-capacity constraint
already guarantees enough rooms exist. A `room_requirement` constraint
narrows a subject's pool to a specific room subset (see `_apply_room_requirement`).

Hard constraints (always enforced):
  H1. A class has at most one subject per period (domain: subject_assigned sums <= 1)
  H2. Each (class, subject) gets exactly its required periods/week
  H3. A teacher is in at most one place per period
  H4. A teacher only teaches subjects they are qualified for (variable domain)
  H5. A room-type pool (classroom/lab, or a narrowed custom pool) is never
      double-booked beyond its room count
  H6. No classes during break periods (domain: breaks are excluded from `periods`)
  H7. Teacher unavailability, from active `teacher_unavailable` constraints
  H8. Any DB constraint whose `severity == hard` is enforced as a hard bound

Soft constraints (weighted penalties added to the objective, to minimize):
  S1. Same subject more than twice a day for a class
  S2. Teacher daily workload balance (spread between busiest/lightest day)
  S3. More than 3 consecutive periods for a teacher
  S4. Any DB constraint whose `severity == soft` (teacher/subject time
      preferences, extra per-day caps, custom no-consecutive thresholds, ...)
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from ortools.sat.python import cp_model

from app.models.constraint import Constraint, ConstraintType
from app.solver import defaults
from app.solver.data_loader import SolverInput

# Keys into the two variable dictionaries
SubjectKey = tuple[int, int, int, int]  # (class_id, day_id, period_id, subject_id)
TeacherKey = tuple[int, int, int, int, int]  # (class_id, day_id, period_id, subject_id, teacher_id)


@dataclass
class ModelBundle:
    """Everything the caller needs to solve the model and extract a solution."""

    model: cp_model.CpModel
    solver_input: SolverInput
    subject_assigned: dict[SubjectKey, cp_model.IntVar] = field(default_factory=dict)
    teacher_assigned: dict[TeacherKey, cp_model.IntVar] = field(default_factory=dict)
    # Room pool each (class, subject) draws from, after room_requirement narrowing.
    # Keyed the same as subject-level (class_id, subject_id).
    effective_room_pool: dict[tuple[int, int], tuple[int, ...]] = field(default_factory=dict)
    # Human-readable notes about which constraints were applied, surfaced in
    # the timetable's `message` field on success.
    applied_notes: list[str] = field(default_factory=list)
    skipped_notes: list[str] = field(default_factory=list)


def _period_numbers_from_payload(payload: dict, key: str = "periods") -> set[int]:
    return set(int(p) for p in payload.get(key, []))


def build_model(si: SolverInput, disabled_constraint_ids: set[int] | None = None) -> ModelBundle:
    """
    Build the CP-SAT model.

    `disabled_constraint_ids` lets the conflict-explainer re-build the model
    with specific DB constraints turned off, to find out which one(s) make
    the problem infeasible, without touching the built-in hard rules.
    """
    disabled_constraint_ids = disabled_constraint_ids or set()
    model = cp_model.CpModel()
    bundle = ModelBundle(model=model, solver_input=si)

    day_ids = [d.id for d in si.days]
    period_ids = [p.id for p in si.periods]
    period_number_by_id = {p.id: p.period_number for p in si.periods}

    # ---------------------------------------------------------------
    # Variable creation
    # ---------------------------------------------------------------
    for c in si.classes:
        subject_reqs = si.requirements_by_class.get(c.id, {})
        for s_id, periods_per_week in subject_reqs.items():
            if periods_per_week <= 0:
                continue
            pinned_teacher = si.pinned_teacher_by_class_subject.get((c.id, s_id))
            qualified_teachers = (
                [pinned_teacher] if pinned_teacher is not None else si.qualified_teachers_for_subject.get(s_id, [])
            )

            # Default room pool: classroom or lab, based on the subject flag.
            bundle.effective_room_pool[(c.id, s_id)] = tuple(si.room_pool_for_subject(s_id))

            slot_vars: list[cp_model.IntVar] = []
            for d_id in day_ids:
                for p_id in period_ids:
                    sa = model.NewBoolVar(f"subj_c{c.id}_d{d_id}_p{p_id}_s{s_id}")
                    bundle.subject_assigned[(c.id, d_id, p_id, s_id)] = sa
                    slot_vars.append(sa)

                    if qualified_teachers:
                        t_vars = []
                        for t_id in qualified_teachers:
                            tv = model.NewBoolVar(f"teach_c{c.id}_d{d_id}_p{p_id}_s{s_id}_t{t_id}")
                            bundle.teacher_assigned[(c.id, d_id, p_id, s_id, t_id)] = tv
                            t_vars.append(tv)
                        # exactly one qualified teacher iff the subject is scheduled here
                        model.Add(sum(t_vars) == sa)
                    else:
                        # No qualified teacher at all -> this subject can never be scheduled.
                        model.Add(sa == 0)

            # H1 (partial, per class-period) is enforced below globally; here we
            # enforce H2: exact weekly periods for this (class, subject).
            model.Add(sum(slot_vars) == periods_per_week)

    # H1: at most one subject per class per period
    for c in si.classes:
        for d_id in day_ids:
            for p_id in period_ids:
                vars_here = [
                    bundle.subject_assigned[(c.id, d_id, p_id, s_id)]
                    for s_id in si.requirements_by_class.get(c.id, {})
                ]
                if vars_here:
                    model.Add(sum(vars_here) <= 1)

    # H3: a teacher is in at most one place per period
    teacher_period_vars: dict[tuple[int, int, int], list[cp_model.IntVar]] = defaultdict(list)
    for (c_id, d_id, p_id, s_id, t_id), var in bundle.teacher_assigned.items():
        teacher_period_vars[(t_id, d_id, p_id)].append(var)
    for key, vars_here in teacher_period_vars.items():
        model.Add(sum(vars_here) <= 1)

    # ---------------------------------------------------------------
    # room_requirement constraints must narrow `effective_room_pool` BEFORE
    # the H5 pool-capacity constraints below are built from it.
    # ---------------------------------------------------------------
    for constraint in si.active_constraints:
        if constraint.id in disabled_constraint_ids:
            continue
        if constraint.constraint_type == ConstraintType.ROOM_REQUIREMENT:
            _apply_room_requirement(bundle, constraint)

    # H5: room pool capacity per (day, period), grouped by the *exact* pool
    # tuple in use (so a custom room_requirement pool is tracked separately
    # from the default classroom/lab pools it was narrowed from).
    pool_slot_vars: dict[tuple[tuple[int, ...], int, int], list[cp_model.IntVar]] = defaultdict(list)
    for (c_id, d_id, p_id, s_id), var in bundle.subject_assigned.items():
        pool = bundle.effective_room_pool.get((c_id, s_id), ())
        if pool:
            pool_slot_vars[(pool, d_id, p_id)].append(var)
    for (pool, d_id, p_id), vars_here in pool_slot_vars.items():
        model.Add(sum(vars_here) <= len(pool))

    # ---------------------------------------------------------------
    # Remaining DB-driven constraints (from the `constraints` table)
    # ---------------------------------------------------------------
    objective_terms: list[cp_model.LinearExprT] = []

    for constraint in si.active_constraints:
        if constraint.id in disabled_constraint_ids:
            bundle.skipped_notes.append(
                f"[disabled for diagnosis] #{constraint.id} ({constraint.constraint_type.value}): {constraint.raw_text}"
            )
            continue
        if constraint.constraint_type == ConstraintType.ROOM_REQUIREMENT:
            continue  # already handled above, before H5 was built
        _apply_db_constraint(model, bundle, si, constraint, day_ids, period_ids, period_number_by_id, objective_terms)

    # ---------------------------------------------------------------
    # Built-in soft constraints
    # ---------------------------------------------------------------
    _apply_same_subject_limit(model, bundle, si, day_ids, period_ids, objective_terms)
    _apply_consecutive_limit(model, bundle, si, day_ids, period_ids, objective_terms)
    _apply_workload_balance(model, bundle, si, day_ids, period_ids, objective_terms)

    if objective_terms:
        model.Minimize(sum(objective_terms))

    return bundle


# =====================================================================
# DB-driven constraint handlers
# =====================================================================
def _apply_db_constraint(
    model: cp_model.CpModel,
    bundle: ModelBundle,
    si: SolverInput,
    constraint: Constraint,
    day_ids: list[int],
    period_ids: list[int],
    period_number_by_id: dict[int, int],
    objective_terms: list,
) -> None:
    payload = constraint.payload or {}
    is_hard = constraint.severity.value == "hard"
    weight = constraint.weight or defaults.DEFAULT_SOFT_CONSTRAINT_WEIGHT
    period_id_by_number = {num: pid for pid, num in period_number_by_id.items()}

    def periods_to_ids(numbers: set[int]) -> set[int]:
        return {period_id_by_number[n] for n in numbers if n in period_id_by_number}

    if constraint.constraint_type == ConstraintType.TEACHER_UNAVAILABLE:
        t_id = payload.get("teacher_id")
        d_ids = payload.get("day_ids") or ([payload["day_id"]] if "day_id" in payload else day_ids)
        p_ids = periods_to_ids(_period_number_from_payload_flexible(payload)) or set(period_ids)
        count = 0
        for (c_id, d_id, p_id, s_id, tt_id), var in bundle.teacher_assigned.items():
            if tt_id == t_id and d_id in d_ids and p_id in p_ids:
                model.Add(var == 0)
                count += 1
        bundle.applied_notes.append(
            f"#{constraint.id} teacher_unavailable: '{constraint.raw_text}' ({count} slots blocked)"
        )

    elif constraint.constraint_type in (ConstraintType.TEACHER_PREFERRED_SLOT, ConstraintType.SUBJECT_TIME_PREFERENCE):
        t_id = payload.get("teacher_id")
        c_id = payload.get("class_id")
        s_id = payload.get("subject_id")
        preferred_numbers = _period_number_from_payload_flexible(payload)
        preferred_p_ids = periods_to_ids(preferred_numbers)
        d_ids = set(payload.get("day_ids", day_ids))

        matches, mismatches = [], []
        for key, var in bundle.subject_assigned.items():
            k_c_id, k_d_id, k_p_id, k_s_id = key
            if s_id is not None and k_s_id != s_id:
                continue
            if c_id is not None and k_c_id != c_id:
                continue
            if t_id is not None:
                # only relevant if this class-subject slot could involve that teacher
                if (k_c_id, k_d_id, k_p_id, k_s_id, t_id) not in bundle.teacher_assigned:
                    continue
                var = bundle.teacher_assigned[(k_c_id, k_d_id, k_p_id, k_s_id, t_id)]
            if k_d_id not in d_ids:
                continue
            if preferred_p_ids and k_p_id not in preferred_p_ids:
                mismatches.append(var)
            else:
                matches.append(var)

        if is_hard:
            for var in mismatches:
                model.Add(var == 0)
        else:
            objective_terms.extend(weight * var for var in mismatches)
        bundle.applied_notes.append(
            f"#{constraint.id} {constraint.constraint_type.value} "
            f"({'hard' if is_hard else f'soft, weight={weight}'}): '{constraint.raw_text}'"
        )

    elif constraint.constraint_type == ConstraintType.MAX_PERIODS_PER_DAY:
        scope = payload.get("scope", "teacher")
        max_periods = payload.get("max_periods")
        if max_periods is None:
            bundle.skipped_notes.append(f"#{constraint.id} missing max_periods, skipped")
            return
        if scope == "teacher":
            t_id = payload["teacher_id"]
            for d_id in day_ids:
                day_vars = [
                    var for (c_id, dd, p_id, s_id, tt_id), var in bundle.teacher_assigned.items()
                    if tt_id == t_id and dd == d_id
                ]
                if not day_vars:
                    continue
                if is_hard:
                    model.Add(sum(day_vars) <= max_periods)
                else:
                    over = model.NewIntVar(0, len(day_vars), f"over_mpd_{constraint.id}_{d_id}")
                    model.Add(over >= sum(day_vars) - max_periods)
                    objective_terms.append(weight * over)
        else:  # class_subject
            c_id, s_id = payload["class_id"], payload["subject_id"]
            for d_id in day_ids:
                day_vars = [
                    var for (cc, dd, p_id, ss), var in bundle.subject_assigned.items()
                    if cc == c_id and dd == d_id and ss == s_id
                ]
                if not day_vars:
                    continue
                if is_hard:
                    model.Add(sum(day_vars) <= max_periods)
                else:
                    over = model.NewIntVar(0, len(day_vars), f"over_mpd_{constraint.id}_{d_id}")
                    model.Add(over >= sum(day_vars) - max_periods)
                    objective_terms.append(weight * over)
        bundle.applied_notes.append(f"#{constraint.id} max_periods_per_day: '{constraint.raw_text}'")

    elif constraint.constraint_type == ConstraintType.NO_CONSECUTIVE:
        t_id = payload["teacher_id"]
        max_consecutive = payload.get("max_consecutive", defaults.MAX_CONSECUTIVE_TEACHER_PERIODS)
        _add_consecutive_penalty(
            model, bundle, si, t_id, max_consecutive, day_ids, period_ids,
            weight if not is_hard else None, objective_terms, tag=f"c{constraint.id}",
        )
        bundle.applied_notes.append(f"#{constraint.id} no_consecutive: '{constraint.raw_text}'")

    elif constraint.constraint_type == ConstraintType.CLASS_TEACHER_PERIOD:
        p_ids = periods_to_ids(_period_number_from_payload_flexible(payload))
        target = payload.get("class_id")
        classes = [c for c in si.classes if (target is None or c.id == target) and c.class_teacher_id]
        for c in classes:
            ct = c.class_teacher_id
            hits = []  # one 0/1 var per (day, period): class teacher is teaching this class then
            for d_id in day_ids:
                for p_id in p_ids:
                    vs = [v for (cc, dd, pp, ss, tt), v in bundle.teacher_assigned.items()
                          if cc == c.id and dd == d_id and pp == p_id and tt == ct]
                    if not vs:
                        continue
                    hit = model.NewBoolVar(f"ctp_{constraint.id}_c{c.id}_d{d_id}_p{p_id}")
                    model.Add(sum(vs) == hit)
                    hits.append(hit)
            if not hits:
                bundle.skipped_notes.append(f"#{constraint.id} {c.display_name}: class teacher cannot teach it")
                continue
            # Most days the class teacher can possibly cover: bounded by days and by their weekly periods with this class.
            possible = sum(
                ppw for s_id, ppw in si.requirements_by_class.get(c.id, {}).items()
                if ct in ([si.pinned_teacher_by_class_subject[(c.id, s_id)]]
                          if (c.id, s_id) in si.pinned_teacher_by_class_subject
                          else si.qualified_teachers_for_subject.get(s_id, []))
            )
            wanted = min(len(day_ids) * len(p_ids), possible)
            if is_hard:
                model.Add(sum(hits) >= wanted)
            else:
                miss = model.NewIntVar(0, wanted, f"ctp_miss_{constraint.id}_c{c.id}")
                model.Add(miss >= wanted - sum(hits))
                objective_terms.append(weight * miss)
        bundle.applied_notes.append(
            f"#{constraint.id} class_teacher_period ({'hard' if is_hard else f'soft, weight={weight}'}): '{constraint.raw_text}'"
        )

    elif constraint.constraint_type == ConstraintType.ROOM_REQUIREMENT:
        # Handled earlier in build_model (see `_apply_room_requirement`), before
        # the H5 pool-capacity constraints are built - nothing to do here.
        pass


def _apply_room_requirement(bundle: ModelBundle, constraint: Constraint) -> None:
    """Narrow the room pool for a (class, subject) - or every class taking
    that subject, if class_id is omitted - to an explicit set of room ids."""
    payload = constraint.payload or {}
    c_id = payload.get("class_id")
    s_id = payload.get("subject_id")
    room_ids = tuple(payload.get("room_ids", []))
    if not room_ids or s_id is None:
        bundle.skipped_notes.append(f"#{constraint.id} missing subject_id/room_ids, skipped")
        return
    targets = (
        [(c_id, s_id)]
        if c_id is not None
        else [(cc, ss) for (cc, ss) in bundle.effective_room_pool if ss == s_id]
    )
    for target in targets:
        if target in bundle.effective_room_pool:
            bundle.effective_room_pool[target] = room_ids
    bundle.applied_notes.append(f"#{constraint.id} room_requirement: '{constraint.raw_text}'")


def _period_number_from_payload_flexible(payload: dict) -> set[int]:
    """Accepts either `periods: [1,2,3]` or `period_numbers: [...]`."""
    return set(int(p) for p in (payload.get("periods") or payload.get("period_numbers") or []))


# =====================================================================
# Built-in soft constraints
# =====================================================================
def _apply_same_subject_limit(model, bundle: ModelBundle, si: SolverInput, day_ids, period_ids, objective_terms) -> None:
    for c in si.classes:
        for s_id in si.requirements_by_class.get(c.id, {}):
            for d_id in day_ids:
                day_vars = [
                    bundle.subject_assigned[(c.id, d_id, p_id, s_id)]
                    for p_id in period_ids
                    if (c.id, d_id, p_id, s_id) in bundle.subject_assigned
                ]
                if not day_vars:
                    continue
                over = model.NewIntVar(0, len(day_vars), f"over_subj_c{c.id}_d{d_id}_s{s_id}")
                model.Add(over >= sum(day_vars) - defaults.MAX_SAME_SUBJECT_PER_DAY)
                objective_terms.append(defaults.SAME_SUBJECT_OVERUSE_WEIGHT * over)


def _add_consecutive_penalty(
    model, bundle: ModelBundle, si: SolverInput, t_id: int, max_consecutive: int,
    day_ids, period_ids, weight: float | None, objective_terms: list, tag: str,
) -> None:
    """Penalize (or forbid, if weight is None) any run of > max_consecutive
    busy periods for a teacher in a single day. `period_ids` must be in
    chronological order (guaranteed by data_loader sorting by period_number)."""
    window = max_consecutive + 1
    if len(period_ids) < window:
        return
    for d_id in day_ids:
        busy_exprs = []
        for p_id in period_ids:
            vars_here = [
                var for (c_id, dd, pp, s_id, tt_id), var in bundle.teacher_assigned.items()
                if tt_id == t_id and dd == d_id and pp == p_id
            ]
            busy_exprs.append(sum(vars_here) if vars_here else 0)
        for start in range(len(period_ids) - window + 1):
            window_sum = sum(busy_exprs[start : start + window])
            if weight is None:
                model.Add(window_sum <= max_consecutive)
            else:
                over = model.NewIntVar(0, window, f"over_consec_{tag}_t{t_id}_d{d_id}_{start}")
                model.Add(over >= window_sum - max_consecutive)
                objective_terms.append(weight * over)


def _apply_consecutive_limit(model, bundle: ModelBundle, si: SolverInput, day_ids, period_ids, objective_terms) -> None:
    for t in si.teachers:
        _add_consecutive_penalty(
            model, bundle, si, t.id, defaults.MAX_CONSECUTIVE_TEACHER_PERIODS,
            day_ids, period_ids, defaults.CONSECUTIVE_OVERUSE_WEIGHT, objective_terms, tag="builtin",
        )


def _apply_workload_balance(model, bundle: ModelBundle, si: SolverInput, day_ids, period_ids, objective_terms) -> None:
    max_daily = len(period_ids)
    for t in si.teachers:
        day_loads = []
        for d_id in day_ids:
            vars_here = [
                var for (c_id, dd, p_id, s_id, tt_id), var in bundle.teacher_assigned.items()
                if tt_id == t.id and dd == d_id
            ]
            if not vars_here:
                day_loads.append(None)
                continue
            load = model.NewIntVar(0, max_daily, f"load_t{t.id}_d{d_id}")
            model.Add(load == sum(vars_here))
            day_loads.append(load)

        real_loads = [dl for dl in day_loads if dl is not None]
        if len(real_loads) < 2:
            continue
        max_load = model.NewIntVar(0, max_daily, f"maxload_t{t.id}")
        min_load = model.NewIntVar(0, max_daily, f"minload_t{t.id}")
        model.AddMaxEquality(max_load, real_loads)
        model.AddMinEquality(min_load, real_loads)
        spread = model.NewIntVar(0, max_daily, f"spread_t{t.id}")
        model.Add(spread == max_load - min_load)
        objective_terms.append(defaults.WORKLOAD_BALANCE_WEIGHT * spread)
