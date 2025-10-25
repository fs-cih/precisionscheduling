import { monthsBetween } from './dates.js';
import { getLessonAgeRange, shouldPull } from './filters.js';

export function assignLessons(visits, participant, lessons) {
  const rows = [];
  const availableLessons = Array.isArray(lessons) ? [...lessons] : [];
  let lessonIndex = 0;

  const topics = participant?.topics ?? {};
  const finalVisitIndex = visits.length - 1;
  const finalLessonIndex = availableLessons.findIndex((lesson) => lesson.code === 'YGC11');
  let finalLesson = null;

  if (finalLessonIndex >= 0) {
    [finalLesson] = availableLessons.splice(finalLessonIndex, 1);
  }

  for (let visitIndex = 0; visitIndex < visits.length && lessonIndex < availableLessons.length; visitIndex += 1) {
    const visitDate = visits[visitIndex];
    const childAgeM = monthsBetween(participant.birth, visitDate);
    let totalMinutes = 0;
    let lessonCount = 0;
    const isFinalVisit = visitIndex === finalVisitIndex;
    const reservedMinutes = isFinalVisit && finalLesson ? finalLesson.minutes : 0;
    const visitCapacity = Math.max(0, 120 - reservedMinutes);

    while (lessonIndex < availableLessons.length && lessonCount < 3) {
      const lesson = availableLessons[lessonIndex];
      const { start } = getLessonAgeRange(lesson);

      if (!shouldPull(lesson, participant, topics, childAgeM)) {
        if (childAgeM < start) {
          break;
        }
        lessonIndex += 1;
        continue;
      }

      const fitsTime = (totalMinutes + lesson.minutes) <= visitCapacity;

      if (!fitsTime) {
        break;
      }

      rows.push({
        visit: visitIndex + 1,
        date: visitDate,
        ageM: childAgeM,
        code: lesson.code,
        subject: lesson.subject,
        minutes: lesson.minutes,
      });

      totalMinutes += lesson.minutes;
      lessonCount += 1;
      lessonIndex += 1;
    }

    if (lessonCount === 0) {
      let scheduledLongLesson = false;
      while (lessonIndex < availableLessons.length) {
        const lesson = availableLessons[lessonIndex];
        const { start } = getLessonAgeRange(lesson);

        if (!shouldPull(lesson, participant, topics, childAgeM)) {
          if (childAgeM < start) {
            break;
          }
          lessonIndex += 1;
          continue;
        }

        if (lesson.minutes > 120 && (!isFinalVisit || reservedMinutes === 0)) {
          rows.push({
            visit: visitIndex + 1,
            date: visitDate,
            ageM: childAgeM,
            code: lesson.code,
            subject: lesson.subject,
            minutes: lesson.minutes,
          });
          lessonIndex += 1;
          scheduledLongLesson = true;
        }
        break;
      }

      if (!scheduledLongLesson && lessonIndex >= availableLessons.length) {
        break;
      }
    }
  }

  if (finalLesson && visits.length) {
    const visitDate = visits[finalVisitIndex];
    const childAgeM = monthsBetween(participant.birth, visitDate);
    rows.push({
      visit: finalVisitIndex + 1,
      date: visitDate,
      ageM: childAgeM,
      code: finalLesson.code,
      subject: finalLesson.subject,
      minutes: finalLesson.minutes,
    });
  }

  const scheduledTimes = new Set(rows.map((row) => row.date.getTime()));

  visits.forEach((visitDate, index) => {
    const time = visitDate.getTime();
    if (!scheduledTimes.has(time)) {
      const childAgeM = monthsBetween(participant.birth, visitDate);
      rows.push({
        visit: index + 1,
        date: visitDate,
        ageM: childAgeM,
        code: '',
        subject: 'No lessons scheduled',
        minutes: 0,
        placeholder: true,
      });
      scheduledTimes.add(time);
    }
  });

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

  return rows;
}
