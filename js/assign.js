import { monthsBetween } from './dates.js';
import { getLessonAgeRange, shouldPull } from './filters.js';

export function assignLessons(visits, participant, lessons) {
  const rows = [];
  const availableLessons = Array.isArray(lessons) ? [...lessons] : [];
  const topics = participant?.topics ?? {};

  const parsedLimit = Number.parseInt(participant?.maxLessonsPerVisit, 10);
  const maxLessonsPerVisit = Number.isNaN(parsedLimit) ? 3 : Math.max(1, parsedLimit);

  const finalVisitIndex = Math.max(0, visits.length - 1);
  const finalLessonIndex = availableLessons.findIndex((lesson) => lesson.code === 'YGC11');
  let finalLesson = null;

  if (finalLessonIndex >= 0) {
    [finalLesson] = availableLessons.splice(finalLessonIndex, 1);
  }

  for (let visitIndex = visits.length - 1; visitIndex >= 0; visitIndex -= 1) {
    const visitDate = visits[visitIndex];
    const childAgeM = monthsBetween(participant.birth, visitDate);
    const isFinalVisit = visitIndex === finalVisitIndex;
    const reservedMinutes = isFinalVisit && finalLesson ? finalLesson.minutes : 0;
    const visitCapacity = Math.max(0, 90 - reservedMinutes);
    const baseMaxLessons = maxLessonsPerVisit;
    const maxLessons = isFinalVisit && finalLesson
      ? Math.max(1, baseMaxLessons - 1)
      : baseMaxLessons;

    const visitRows = [];
    let totalMinutes = 0;
    let searchIndex = availableLessons.length - 1;

    while (visitRows.length < maxLessons && searchIndex >= 0) {
      const lesson = availableLessons[searchIndex];
      const { start } = getLessonAgeRange(lesson);

      if (!shouldPull(lesson, participant, topics, childAgeM)) {
        if (childAgeM < start) {
          searchIndex -= 1;
          continue;
        }
        availableLessons.splice(searchIndex, 1);
        searchIndex -= 1;
        continue;
      }

      if (totalMinutes + lesson.minutes > visitCapacity) {
        searchIndex -= 1;
        continue;
      }

      visitRows.push({
        visit: visitIndex + 1,
        date: visitDate,
        ageM: childAgeM,
        code: lesson.code,
        subject: lesson.subject,
        minutes: lesson.minutes,
      });

      totalMinutes += lesson.minutes;
      availableLessons.splice(searchIndex, 1);
      searchIndex -= 1;
    }

    if (isFinalVisit && finalLesson) {
      visitRows.push({
        visit: visitIndex + 1,
        date: visitDate,
        ageM: childAgeM,
        code: finalLesson.code,
        subject: finalLesson.subject,
        minutes: finalLesson.minutes,
      });
    }

    if (!visitRows.length) {
      visitRows.push({
        visit: visitIndex + 1,
        date: visitDate,
        ageM: childAgeM,
        code: 'No lesson scheduled',
        subject: 'No lesson scheduled',
        minutes: 0,
        placeholder: true,
      });
    }

    rows.push(...visitRows);
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
    overflowCount: availableLessons.length + (finalLesson && !scheduledFinal ? 1 : 0),
    removedVisits: placeholderVisitCount,
  };
}
