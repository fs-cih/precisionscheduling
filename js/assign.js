import { monthsBetween } from './dates.js';
import { getLessonAgeRange, shouldPull } from './filters.js';

export function assignLessons(visits, participant, lessons) {
  const rows = [];
  let lessonIndex = 0;

  const topics = participant?.topics ?? {};

  for (let visitIndex = 0; visitIndex < visits.length && lessonIndex < lessons.length; visitIndex += 1) {
    const visitDate = visits[visitIndex];
    const childAgeM = monthsBetween(participant.birth, visitDate);
    let totalMinutes = 0;
    let lessonCount = 0;

    while (lessonIndex < lessons.length && lessonCount < 3) {
      const lesson = lessons[lessonIndex];
      const { start } = getLessonAgeRange(lesson);

      if (!shouldPull(lesson, participant, topics, childAgeM)) {
        if (childAgeM < start) {
          break;
        }
        lessonIndex += 1;
        continue;
      }

      const fitsTime = (totalMinutes + lesson.minutes) <= 120;

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
      while (lessonIndex < lessons.length) {
        const lesson = lessons[lessonIndex];
        const { start } = getLessonAgeRange(lesson);

        if (!shouldPull(lesson, participant, topics, childAgeM)) {
          if (childAgeM < start) {
            break;
          }
          lessonIndex += 1;
          continue;
        }

        if (lesson.minutes > 120) {
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

      if (!scheduledLongLesson && lessonIndex >= lessons.length) {
        break;
      }
    }
  }

  return rows;
}
