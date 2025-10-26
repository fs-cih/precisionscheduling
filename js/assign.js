import { monthsBetween } from './dates.js';
import { getLessonAgeRange, shouldPull } from './filters.js';

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
  const tolerance = 3;

  const diff = Math.abs(visitAgeM - target);
  let score = diff;

  if (diff > tolerance) {
    score += diff - tolerance;
  }

  if (priority !== 'appropriate' && Number.isFinite(start) && visitAgeM < start) {
    score += (start - visitAgeM) * 10;
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

  const preferredDuration = Math.max(0, toNumber(participant?.preferredVisitDuration, 90));

  const visitInfos = visits.map((visitDate, index) => ({
    index,
    date: visitDate,
    ageM: monthsBetween(participant.birth, visitDate),
    assignments: [],
    remainingMinutes: preferredDuration,
    maxSlots: 1,
  }));

  const finalLessonIndex = lessonPool.findIndex((lesson) => lesson.code === 'YGC11');
  let finalLesson = null;

  if (finalLessonIndex >= 0) {
    [finalLesson] = lessonPool.splice(finalLessonIndex, 1);
    const lastVisit = visitInfos[visitInfos.length - 1];
    if (lastVisit) {
      lastVisit.assignments.push(finalLesson);
      const minutes = Number.isFinite(finalLesson?.minutes) ? finalLesson.minutes : 0;
      lastVisit.remainingMinutes = Math.max(0, lastVisit.remainingMinutes - minutes);
    }
  }

  const lessonsToSchedule = lessonPool.slice().sort((a, b) => getTargetAge(a) - getTargetAge(b));
  const unscheduled = new Set(lessonsToSchedule.map((lesson) => lesson.code));

  const minLessonMinutes = lessonsToSchedule.reduce((min, lesson) => {
    const minutes = Number.isFinite(lesson?.minutes) ? lesson.minutes : 0;
    return Math.min(min, minutes);
  }, Infinity);

  const effectiveMinMinutes = Number.isFinite(minLessonMinutes) ? minLessonMinutes : 0;

  let availableSlots = visitInfos.reduce(
    (total, visit) => total + Math.max(visit.maxSlots - visit.assignments.length, 0),
    0,
  );
  let shortage = lessonsToSchedule.length - availableSlots;

  if (shortage > 0) {
    const expandableVisits = visitInfos
      .slice()
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
    const lessonMinutes = Number.isFinite(lesson?.minutes) ? lesson.minutes : 0;
    let bestVisit = null;
    let bestScore = Infinity;

    for (const visit of visitInfos) {
      if (visit.assignments.length >= visit.maxSlots) {
        continue;
      }

      if (lessonMinutes > visit.remainingMinutes) {
        continue;
      }

      if (!shouldPull(lesson, participant, topics, visit.ageM)) {
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

    bestVisit.assignments.push(lesson);
    bestVisit.remainingMinutes = Math.max(0, bestVisit.remainingMinutes - lessonMinutes);
    unscheduled.delete(lesson.code);
  }

  for (const visit of visitInfos) {
    if (!visit.assignments.length) {
      rows.push({
        visit: visit.index + 1,
        date: visit.date,
        ageM: visit.ageM,
        code: 'No lesson scheduled',
        subject: 'No lesson scheduled',
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

  return {
    rows,
    visitsUsed: uniqueVisitCount,
    totalVisits: visits.length,
    overflowCount: unscheduled.size + (finalLesson && !scheduledFinal ? 1 : 0),
    removedVisits: placeholderVisitCount,
  };
}
