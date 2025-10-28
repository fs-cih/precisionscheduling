import { monthsBetween } from './dates.js';
import { AGE_TOLERANCE_MONTHS, getLessonAgeRange, shouldPull } from './filters.js';

function getLessonMinutes(lesson) {
  return Number.isFinite(lesson?.minutes) ? lesson.minutes : 0;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getThanksgivingDate(year) {
  const novemberFirst = new Date(year, 10, 1);
  const dayOfWeek = novemberFirst.getDay();
  const firstThursdayOffset = (4 - dayOfWeek + 7) % 7;
  return new Date(year, 10, 1 + firstThursdayOffset + 3 * 7);
}

function isThanksgivingWeek(date) {
  if (date.getMonth() !== 10) {
    return false;
  }

  const thanksgiving = getThanksgivingDate(date.getFullYear());
  const startOfWeek = new Date(thanksgiving);
  startOfWeek.setDate(thanksgiving.getDate() - thanksgiving.getDay());

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  return date >= startOfWeek && date <= endOfWeek;
}

function isLateDecember(date) {
  if (date.getMonth() !== 11) {
    return false;
  }

  const cutoff = getDaysInMonth(date.getFullYear(), 11) - 13;
  return date.getDate() >= cutoff;
}

function getHolidayBlackoutReason(date) {
  if (isThanksgivingWeek(date)) {
    return 'No lesson scheduled (Thanksgiving week)';
  }

  if (isLateDecember(date)) {
    return 'No lesson scheduled (end of year holidays)';
  }

  return null;
}

function isFirstHalfOfDecember(date) {
  return date.getMonth() === 11 && date.getDate() <= 14;
}

function canPullLesson(visit, lesson, participantCtx, topics) {
  if (!visit || visit.blocked) {
    return false;
  }

  return shouldPull(lesson, participantCtx, topics, visit.ageM);
}

function canPlaceLesson(visit, lesson, participantCtx, topics) {
  if (!canPullLesson(visit, lesson, participantCtx, topics)) {
    return false;
  }

  if (visit.assignments.length >= visit.maxSlots) {
    return false;
  }

  return true;
}

function addLessonToVisit(visit, lesson) {
  visit.assignments.push(lesson);
  visit.totalMinutes += getLessonMinutes(lesson);
}

function removeLessonFromVisit(visit, index) {
  const [removed] = visit.assignments.splice(index, 1);
  if (removed) {
    visit.totalMinutes = Math.max(0, visit.totalMinutes - getLessonMinutes(removed));
  }
  return removed;
}

function tryFillVisitWithLesson(
  targetVisit,
  unscheduledCodes,
  lessonsByCode,
  participantCtx,
  topics,
  donorVisits,
) {
  if (!targetVisit || targetVisit.blocked || targetVisit.assignments.length >= targetVisit.maxSlots) {
    return false;
  }

  const unscheduledLessons = Array.from(unscheduledCodes)
    .map((code) => lessonsByCode.get(code))
    .filter(Boolean);

  for (const lesson of unscheduledLessons) {
    if (canPlaceLesson(targetVisit, lesson, participantCtx, topics)) {
      addLessonToVisit(targetVisit, lesson);
      unscheduledCodes.delete(lesson.code);
      return true;
    }
  }

  for (const donor of donorVisits) {
    if (!donor || donor === targetVisit || donor.blocked) {
      continue;
    }

    if (!donor.assignments.length) {
      continue;
    }

    for (let i = donor.assignments.length - 1; i >= 0; i -= 1) {
      const lesson = donor.assignments[i];
      if (lesson?.code === 'YGC11') {
        continue;
      }
      if (!canPlaceLesson(targetVisit, lesson, participantCtx, topics)) {
        continue;
      }

      removeLessonFromVisit(donor, i);
      addLessonToVisit(targetVisit, lesson);
      return true;
    }
  }

  return false;
}

function getDonorVisits(visitInfos, excluded = [], preferLater = false) {
  const excludedSet = new Set(excluded);

  return visitInfos
    .filter((visit) => !excludedSet.has(visit) && !visit.blocked && visit.assignments.length > 0)
    .sort((a, b) => {
      const assignmentDiff = b.assignments.length - a.assignments.length;
      if (assignmentDiff !== 0) {
        return assignmentDiff;
      }
      const minuteDiff = b.totalMinutes - a.totalMinutes;
      if (minuteDiff !== 0) {
        return minuteDiff;
      }
      return preferLater ? b.index - a.index : a.index - b.index;
    });
}

function ensureEarlyVisitLessons(visitInfos, unscheduledCodes, lessonsByCode, participantCtx, topics) {
  const earlyVisits = visitInfos.filter((visit) => !visit.blocked).slice(0, 5);
  const earlyVisitSet = new Set(earlyVisits);

  for (const visit of earlyVisits) {
    if (visit.assignments.length > 0) {
      continue;
    }

    const donors = getDonorVisits(visitInfos, [visit], true).filter(
      (donor) => donor.assignments.length > 1 || !earlyVisitSet.has(donor),
    );
    tryFillVisitWithLesson(visit, unscheduledCodes, lessonsByCode, participantCtx, topics, donors);
  }
}

function distributeExcessCapacity(
  visitInfos,
  unscheduledCodes,
  lessonsByCode,
  participantCtx,
  topics,
) {
  const activeVisits = visitInfos.filter((visit) => !visit.blocked);

  if (!activeVisits.length) {
    return;
  }

  const requiredVisitCount = Math.min(5, activeVisits.length);
  const requiredVisits = activeVisits.slice(0, requiredVisitCount);
  const requiredVisitSet = new Set(requiredVisits);

  for (const visit of requiredVisits) {
    if (visit.assignments.length > 0) {
      continue;
    }

    const donors = getDonorVisits(visitInfos, [visit], true).filter(
      (donor) => donor.assignments.length > 1 || !requiredVisitSet.has(donor),
    );
    tryFillVisitWithLesson(visit, unscheduledCodes, lessonsByCode, participantCtx, topics, donors);
  }

  if (activeVisits.length <= requiredVisitCount) {
    return;
  }

  const remainingVisits = activeVisits.slice(requiredVisitCount);
  let remainingEmptyCount = remainingVisits.filter((visit) => visit.assignments.length === 0).length;

  if (remainingEmptyCount === 0) {
    return;
  }

  const desiredEmptyVisits = new Set();
  const step = remainingVisits.length / remainingEmptyCount;
  let position = step / 2;

  for (let i = 0; i < remainingEmptyCount; i += 1) {
    let rawIndex = Math.round(position - 0.5);
    rawIndex = Math.min(Math.max(rawIndex, 0), remainingVisits.length - 1);

    let visit = remainingVisits[rawIndex];
    let offset = 1;

    while (desiredEmptyVisits.has(visit) && (rawIndex + offset < remainingVisits.length || rawIndex - offset >= 0)) {
      const forwardIndex = rawIndex + offset;
      const backwardIndex = rawIndex - offset;

      if (forwardIndex < remainingVisits.length && !desiredEmptyVisits.has(remainingVisits[forwardIndex])) {
        visit = remainingVisits[forwardIndex];
        break;
      }

      if (backwardIndex >= 0 && !desiredEmptyVisits.has(remainingVisits[backwardIndex])) {
        visit = remainingVisits[backwardIndex];
        break;
      }

      offset += 1;
    }

    desiredEmptyVisits.add(visit);
    position += step;
  }

  for (const visit of remainingVisits) {
    if (visit.assignments.length > 0 || desiredEmptyVisits.has(visit)) {
      continue;
    }

    const donors = getDonorVisits(visitInfos, [visit], true).filter(
      (donor) => donor.assignments.length > 1 || desiredEmptyVisits.has(donor),
    );

    if (!donors.length) {
      continue;
    }

    tryFillVisitWithLesson(visit, unscheduledCodes, lessonsByCode, participantCtx, topics, donors);
  }

  for (const visit of requiredVisits) {
    if (visit.assignments.length > 0) {
      continue;
    }

    const donors = getDonorVisits(visitInfos, [visit], true).filter(
      (donor) => donor.assignments.length > 1 || !requiredVisitSet.has(donor),
    );
    if (!donors.length) {
      continue;
    }

    tryFillVisitWithLesson(visit, unscheduledCodes, lessonsByCode, participantCtx, topics, donors);
  }
}

function ensureNoConsecutiveEmptyVisits(
  visitInfos,
  unscheduledCodes,
  lessonsByCode,
  participantCtx,
  topics,
) {
  if (participantCtx?.pacing !== 'standard') {
    return;
  }

  const activeVisits = visitInfos.filter((visit) => !visit.blocked);

  for (let i = 0; i < activeVisits.length - 1; i += 1) {
    const current = activeVisits[i];
    const next = activeVisits[i + 1];

    if (current.assignments.length > 0 || next.assignments.length > 0) {
      continue;
    }

    if (current.assignments.length === 0) {
      const donors = getDonorVisits(visitInfos, [current, next], true);
      tryFillVisitWithLesson(current, unscheduledCodes, lessonsByCode, participantCtx, topics, donors);
    }

    if (next.assignments.length === 0) {
      const donors = getDonorVisits(visitInfos, [current, next], true);
      tryFillVisitWithLesson(next, unscheduledCodes, lessonsByCode, participantCtx, topics, donors);
    }
  }
}

function ensureEarlyDecemberLesson(visitInfos, unscheduledCodes, lessonsByCode, participantCtx, topics) {
  const decemberTargets = visitInfos.filter(
    (visit) => !visit.blocked && isFirstHalfOfDecember(visit.date),
  );

  if (!decemberTargets.length) {
    return;
  }

  const hasLesson = decemberTargets.some((visit) => visit.assignments.length > 0);
  if (hasLesson) {
    return;
  }

  const donorVisits = visitInfos.filter(
    (visit) => !visit.blocked && visit.assignments.length > 1 && !isFirstHalfOfDecember(visit.date),
  );

  for (const target of decemberTargets) {
    if (tryFillVisitWithLesson(target, unscheduledCodes, lessonsByCode, participantCtx, topics, donorVisits)) {
      return;
    }
  }
}

function ensureLessonsInCloseIntervals(
  visitInfos,
  participantCtx,
  unscheduledCodes,
  lessonsByCode,
  topics,
) {
  if (participantCtx?.pacing !== 'standard') {
    return;
  }

  for (let i = 0; i < visitInfos.length - 1; i += 1) {
    const current = visitInfos[i];
    const next = visitInfos[i + 1];

    if (current.blocked || next.blocked) {
      continue;
    }

    const diffMs = next.date.getTime() - current.date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays > 14) {
      continue;
    }

    if (current.assignments.length > 0 || next.assignments.length > 0) {
      continue;
    }

    const donorVisits = visitInfos.filter(
      (visit) =>
        visit !== current &&
        visit !== next &&
        !visit.blocked &&
        visit.assignments.length > 1,
    );

    if (
      tryFillVisitWithLesson(
        current,
        unscheduledCodes,
        lessonsByCode,
        participantCtx,
        topics,
        donorVisits,
      )
    ) {
      continue;
    }

    tryFillVisitWithLesson(next, unscheduledCodes, lessonsByCode, participantCtx, topics, donorVisits);
  }
}

function getTargetAge(lesson) {
  if (Number.isFinite(lesson?.seqAge)) {
    return lesson.seqAge;
  }
  const { start } = getLessonAgeRange(lesson);
  return start;
}

function calculateScore(lesson, visitAgeM) {
  const { start, end } = getLessonAgeRange(lesson);
  const target = getTargetAge(lesson);
  const tolerance = AGE_TOLERANCE_MONTHS;

  const diff = Math.abs(visitAgeM - target);
  let score = diff > tolerance ? diff : 0;

  if (diff > tolerance) {
    score += diff - tolerance;
  }

  if (Number.isFinite(start)) {
    const earlyThreshold = start >= 0 ? Math.max(0, start - tolerance) : start;
    if (visitAgeM < earlyThreshold) {
      score += (earlyThreshold - visitAgeM) * 10;
    }
  }

  return score;
}

export function assignLessons(visits, participant, lessons) {
  const rows = [];
  const lessonPool = Array.isArray(lessons) ? [...lessons] : [];

  const lessonsByCode = new Map(
    lessonPool.filter((lesson) => typeof lesson?.code === 'string').map((lesson) => [lesson.code, lesson]),
  );

  const visitInfos = visits.map((visitDate, index) => {
    const blackoutReason = getHolidayBlackoutReason(visitDate);
    return {
      index,
      date: visitDate,
      ageM: monthsBetween(participant.birth, visitDate),
      assignments: [],
      totalMinutes: 0,
      maxSlots: 1,
      blocked: Boolean(blackoutReason),
      blackoutReason,
    };
  });

  visitInfos.forEach((visit) => {
    if (visit.blocked) {
      visit.maxSlots = 0;
    }
  });

  const activeVisits = visitInfos.filter((visit) => !visit.blocked);
  const firstVisitAgeM =
    activeVisits.length > 0 ? Math.min(...activeVisits.map((visit) => visit.ageM)) : null;
  const participantCtx = { ...participant, firstVisitAgeM };
  const topics = participantCtx?.topics ?? {};

  const eligibleCodes = new Set();
  const markEligibility = (lesson) => {
    if (!lesson?.code) {
      return;
    }
    for (const visit of visitInfos) {
      if (visit.blocked) {
        continue;
      }
      if (shouldPull(lesson, participantCtx, topics, visit.ageM)) {
        eligibleCodes.add(lesson.code);
        return;
      }
    }
  };

  lessonPool.forEach(markEligibility);

  const finalLessonIndex = lessonPool.findIndex((lesson) => lesson.code === 'YGC11');
  let finalLesson = null;

  if (finalLessonIndex >= 0) {
    [finalLesson] = lessonPool.splice(finalLessonIndex, 1);
    const lastEligibleVisit = [...visitInfos]
      .reverse()
      .find((visit) => canPlaceLesson(visit, finalLesson, participantCtx, topics));

    if (lastEligibleVisit) {
      addLessonToVisit(lastEligibleVisit, finalLesson);
    }
  }

  const lessonsToSchedule = lessonPool.slice().sort((a, b) => getTargetAge(a) - getTargetAge(b));
  const unscheduled = new Set(lessonsToSchedule.map((lesson) => lesson.code));

  let availableSlots = activeVisits.reduce(
    (total, visit) => total + Math.max(visit.maxSlots - visit.assignments.length, 0),
    0,
  );
  let shortage = lessonsToSchedule.length - availableSlots;

  if (shortage > 0 && activeVisits.length > 0) {
    let indexOffset = 0;
    while (shortage > 0) {
      const targetVisit = activeVisits[indexOffset % activeVisits.length];
      targetVisit.maxSlots += 1;
      shortage -= 1;
      indexOffset += 1;
    }
  }


  for (const lesson of lessonsToSchedule) {
    let bestVisit = null;
    let bestScore = Infinity;
    let bestProjectedMinutes = Infinity;
    let bestAssignmentCount = Infinity;

    let fallbackVisit = null;
    let fallbackScore = Infinity;
    let fallbackProjectedMinutes = Infinity;
    let fallbackAssignmentCount = Infinity;

    for (const visit of visitInfos) {
      if (!canPullLesson(visit, lesson, participantCtx, topics)) {
        continue;
      }

      const score = calculateScore(lesson, visit.ageM);
      const projectedMinutes = visit.totalMinutes + getLessonMinutes(lesson);
      const assignmentCount = visit.assignments.length;

      if (assignmentCount < visit.maxSlots) {
        const shouldSelect =
          score < bestScore ||
          (score === bestScore &&
            (projectedMinutes < bestProjectedMinutes ||
              (projectedMinutes === bestProjectedMinutes &&
                (assignmentCount < bestAssignmentCount ||
                  (assignmentCount === bestAssignmentCount &&
                    (!bestVisit || visit.index < bestVisit.index))))));

        if (shouldSelect) {
          bestScore = score;
          bestVisit = visit;
          bestProjectedMinutes = projectedMinutes;
          bestAssignmentCount = assignmentCount;
        }
        continue;
      }

      const shouldFallback =
        score < fallbackScore ||
        (score === fallbackScore &&
          (projectedMinutes < fallbackProjectedMinutes ||
            (projectedMinutes === fallbackProjectedMinutes &&
              (assignmentCount < fallbackAssignmentCount ||
                (assignmentCount === fallbackAssignmentCount &&
                  (!fallbackVisit || visit.index < fallbackVisit.index))))));

      if (shouldFallback) {
        fallbackScore = score;
        fallbackVisit = visit;
        fallbackProjectedMinutes = projectedMinutes;
        fallbackAssignmentCount = assignmentCount;
      }
    }

    if (!bestVisit && fallbackVisit) {
      fallbackVisit.maxSlots += 1;
      bestVisit = fallbackVisit;
    }

    if (!bestVisit) {
      continue;
    }

    addLessonToVisit(bestVisit, lesson);
    unscheduled.delete(lesson.code);
  }

  ensureEarlyVisitLessons(visitInfos, unscheduled, lessonsByCode, participantCtx, topics);
  distributeExcessCapacity(visitInfos, unscheduled, lessonsByCode, participantCtx, topics);
  ensureNoConsecutiveEmptyVisits(visitInfos, unscheduled, lessonsByCode, participantCtx, topics);
  ensureLessonsInCloseIntervals(visitInfos, participantCtx, unscheduled, lessonsByCode, topics);
  ensureEarlyDecemberLesson(visitInfos, unscheduled, lessonsByCode, participantCtx, topics);

  for (const visit of visitInfos) {
    if (!visit.assignments.length) {
      const message =
        visit.blackoutReason ??
        (isLateDecember(visit.date)
          ? 'No lesson scheduled (end of year holidays)'
          : 'No lesson scheduled (excess capacity)');
      rows.push({
        visit: visit.index + 1,
        date: visit.date,
        ageM: visit.ageM,
        code: 'No lesson scheduled',
        subject: message,
        minutes: 0,
        placeholder: true,
        standardAgeM: null,
      });
      continue;
    }

    for (const lesson of visit.assignments) {
      const standardAge = getTargetAge(lesson);
      rows.push({
        visit: visit.index + 1,
        date: visit.date,
        ageM: visit.ageM,
        code: lesson.code,
        subject: lesson.subject,
        minutes: Number.isFinite(lesson?.minutes) ? lesson.minutes : 0,
        standardAgeM: Number.isFinite(standardAge) ? standardAge : null,
      });
    }
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (rows.length) {
    const visitOrder = [...new Set(rows.map((row) => row.date.getTime()))]
      .sort((a, b) => a - b)
      .reduce((acc, time, index) => {
        acc[time] = index + 1;
        return acc;
      }, {});

    rows.forEach((row) => {
      row.visit = visitOrder[row.date.getTime()];
    });
  }

  const uniqueVisitCount = new Set(rows.map((row) => row.date.getTime())).size;
  const placeholderVisitCount = new Set(
    rows.filter((row) => row.placeholder).map((row) => row.date.getTime()),
  ).size;
  const scheduledFinal = finalLesson ? rows.some((row) => row.code === finalLesson.code) : false;

  let overflowCount = 0;
  let skippedCount = 0;

  for (const code of unscheduled) {
    if (eligibleCodes.has(code)) {
      overflowCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  if (finalLesson && !scheduledFinal) {
    if (eligibleCodes.has(finalLesson.code)) {
      overflowCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  return {
    rows,
    visitsUsed: uniqueVisitCount,
    totalVisits: visits.length,
    overflowCount,
    skippedCount,
    removedVisits: placeholderVisitCount,
  };
}
