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
    return 'No Lessons Scheduled (Thanksgiving Week)';
  }

  if (isLateDecember(date)) {
    return 'No lesson scheduled';
  }

  return null;
}

function isFirstHalfOfDecember(date) {
  return date.getMonth() === 11 && date.getDate() <= 14;
}

function canPlaceLesson(visit, lesson, participant, topics) {
  if (!visit || visit.blocked) {
    return false;
  }

  if (visit.assignments.length >= visit.maxSlots) {
    return false;
  }

  const lessonMinutes = getLessonMinutes(lesson);
  if (lessonMinutes > visit.remainingMinutes) {
    return false;
  }

  return shouldPull(lesson, participant, topics, visit.ageM);
}

function addLessonToVisit(visit, lesson) {
  visit.assignments.push(lesson);
  visit.remainingMinutes = Math.max(0, visit.remainingMinutes - getLessonMinutes(lesson));
}

function removeLessonFromVisit(visit, index) {
  const [removed] = visit.assignments.splice(index, 1);
  if (removed) {
    visit.remainingMinutes += getLessonMinutes(removed);
  }
  return removed;
}

function tryFillVisitWithLesson(targetVisit, unscheduledCodes, lessonsByCode, participant, topics, donorVisits) {
  if (!targetVisit || targetVisit.blocked || targetVisit.assignments.length >= targetVisit.maxSlots) {
    return false;
  }

  const unscheduledLessons = Array.from(unscheduledCodes)
    .map((code) => lessonsByCode.get(code))
    .filter(Boolean);

  for (const lesson of unscheduledLessons) {
    if (canPlaceLesson(targetVisit, lesson, participant, topics)) {
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
      if (!canPlaceLesson(targetVisit, lesson, participant, topics)) {
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
      return preferLater ? b.index - a.index : a.index - b.index;
    });
}

function ensureEarlyVisitLessons(visitInfos, unscheduledCodes, lessonsByCode, participant, topics) {
  if (participant?.pacing !== 'standard') {
    return;
  }

  const earlyVisits = visitInfos.filter((visit) => !visit.blocked).slice(0, 6);

  for (const visit of earlyVisits) {
    if (visit.assignments.length > 0) {
      continue;
    }

    const donors = getDonorVisits(visitInfos, [visit], true);
    tryFillVisitWithLesson(visit, unscheduledCodes, lessonsByCode, participant, topics, donors);
  }
}

function ensureNoConsecutiveEmptyVisits(visitInfos, unscheduledCodes, lessonsByCode, participant, topics) {
  if (participant?.pacing !== 'standard') {
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
      tryFillVisitWithLesson(current, unscheduledCodes, lessonsByCode, participant, topics, donors);
    }

    if (next.assignments.length === 0) {
      const donors = getDonorVisits(visitInfos, [current, next], true);
      tryFillVisitWithLesson(next, unscheduledCodes, lessonsByCode, participant, topics, donors);
    }
  }
}

function ensureEarlyDecemberLesson(visitInfos, unscheduledCodes, lessonsByCode, participant, topics) {
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
    if (tryFillVisitWithLesson(target, unscheduledCodes, lessonsByCode, participant, topics, donorVisits)) {
      return;
    }
  }
}

function ensureLessonsInCloseIntervals(visitInfos, participant, unscheduledCodes, lessonsByCode, topics) {
  if (participant?.pacing !== 'standard') {
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

    if (tryFillVisitWithLesson(current, unscheduledCodes, lessonsByCode, participant, topics, donorVisits)) {
      continue;
    }

    tryFillVisitWithLesson(next, unscheduledCodes, lessonsByCode, participant, topics, donorVisits);
  }
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function getTargetAge(lesson) {
  if (Number.isFinite(lesson?.seqAge)) {
    return lesson.seqAge;
  }
  const { start } = getLessonAgeRange(lesson);
  return start;
}

function calculateScore(lesson, visitAgeM, priority) {
  const { start, end } = getLessonAgeRange(lesson);
  const target = getTargetAge(lesson);
  const tolerance = AGE_TOLERANCE_MONTHS;

  const diff = Math.abs(visitAgeM - target);
  let score = diff > tolerance ? diff : 0;

  if (diff > tolerance) {
    score += diff - tolerance;
  }

  if (priority !== 'appropriate' && Number.isFinite(start)) {
    const earlyThreshold = start >= 0 ? Math.max(0, start - tolerance) : start;
    if (visitAgeM < earlyThreshold) {
      score += (earlyThreshold - visitAgeM) * 10;
    }
  }

  if (priority === 'appropriate' && Number.isFinite(end) && visitAgeM > end) {
    score += (visitAgeM - end) * 10;
  }

  return score;
}

export function assignLessons(visits, participant, lessons) {
  const rows = [];
  const lessonPool = Array.isArray(lessons) ? [...lessons] : [];
  const topics = participant?.topics ?? {};

  const lessonsByCode = new Map(
    lessonPool.filter((lesson) => typeof lesson?.code === 'string').map((lesson) => [lesson.code, lesson]),
  );

  const preferredDuration = Math.max(0, toNumber(participant?.preferredVisitDuration, 90));

  const visitInfos = visits.map((visitDate, index) => {
    const blackoutReason = getHolidayBlackoutReason(visitDate);
    return {
      index,
      date: visitDate,
      ageM: monthsBetween(participant.birth, visitDate),
      assignments: [],
      remainingMinutes: 0,
      maxSlots: 1,
      blocked: Boolean(blackoutReason),
      blackoutReason,
    };
  });

  visitInfos.forEach((visit) => {
    if (visit.blocked) {
      visit.maxSlots = 0;
      visit.remainingMinutes = 0;
    } else {
      visit.remainingMinutes = preferredDuration;
    }
  });

  const eligibleCodes = new Set();
  const markEligibility = (lesson) => {
    if (!lesson?.code) {
      return;
    }
    for (const visit of visitInfos) {
      if (visit.blocked) {
        continue;
      }
      if (shouldPull(lesson, participant, topics, visit.ageM)) {
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
      .find((visit) => canPlaceLesson(visit, finalLesson, participant, topics));

    if (lastEligibleVisit) {
      addLessonToVisit(lastEligibleVisit, finalLesson);
    }
  }

  const lessonsToSchedule = lessonPool.slice().sort((a, b) => getTargetAge(a) - getTargetAge(b));
  const unscheduled = new Set(lessonsToSchedule.map((lesson) => lesson.code));

  const minLessonMinutes = lessonsToSchedule.reduce((min, lesson) => {
    const minutes = Number.isFinite(lesson?.minutes) ? lesson.minutes : 0;
    return Math.min(min, minutes);
  }, Infinity);

  const effectiveMinMinutes = Number.isFinite(minLessonMinutes) ? minLessonMinutes : 0;

  let availableSlots = visitInfos.reduce((total, visit) => {
    if (visit.blocked) {
      return total;
    }
    return total + Math.max(visit.maxSlots - visit.assignments.length, 0);
  }, 0);
  let shortage = lessonsToSchedule.length - availableSlots;

  if (shortage > 0) {
    const expandableVisits = visitInfos
      .slice()
      .filter((visit) => !visit.blocked)
      .sort((a, b) => b.remainingMinutes - a.remainingMinutes);

    for (const visit of expandableVisits) {
      if (shortage <= 0) {
        break;
      }
      if (visit.maxSlots >= 2) {
        continue;
      }
      if (visit.remainingMinutes <= 0) {
        continue;
      }
      if (Number.isFinite(effectiveMinMinutes) && visit.remainingMinutes < effectiveMinMinutes) {
        continue;
      }
      visit.maxSlots = 2;
      shortage -= 1;
    }
  }

  const priority = participant?.agePriority ?? 'standard';

  for (const lesson of lessonsToSchedule) {
    let bestVisit = null;
    let bestScore = Infinity;

    for (const visit of visitInfos) {
      if (!canPlaceLesson(visit, lesson, participant, topics)) {
        continue;
      }

      const score = calculateScore(lesson, visit.ageM, priority);

      if (score < bestScore) {
        bestScore = score;
        bestVisit = visit;
      }
    }

    if (!bestVisit) {
      continue;
    }

    addLessonToVisit(bestVisit, lesson);
    unscheduled.delete(lesson.code);
  }

  ensureEarlyVisitLessons(visitInfos, unscheduled, lessonsByCode, participant, topics);
  ensureNoConsecutiveEmptyVisits(visitInfos, unscheduled, lessonsByCode, participant, topics);
  ensureLessonsInCloseIntervals(visitInfos, participant, unscheduled, lessonsByCode, topics);
  ensureEarlyDecemberLesson(visitInfos, unscheduled, lessonsByCode, participant, topics);

  for (const visit of visitInfos) {
    if (!visit.assignments.length) {
      const message = visit.blackoutReason ?? 'No lesson scheduled';
      rows.push({
        visit: visit.index + 1,
        date: visit.date,
        ageM: visit.ageM,
        code: 'No lesson scheduled',
        subject: message,
        minutes: 0,
        placeholder: true,
      });
      continue;
    }

    for (const lesson of visit.assignments) {
      rows.push({
        visit: visit.index + 1,
        date: visit.date,
        ageM: visit.ageM,
        code: lesson.code,
        subject: lesson.subject,
        minutes: Number.isFinite(lesson?.minutes) ? lesson.minutes : 0,
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
