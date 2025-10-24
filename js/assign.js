import { monthsBetween } from './dates.js';

export function assignLessons(visits, birth, lessons) {
  const rows = [];
  let lessonIndex = 0;

  for (let visitIndex = 0; visitIndex < visits.length && lessonIndex < lessons.length; visitIndex += 1) {
    const visitDate = visits[visitIndex];
    const ageMonths = monthsBetween(birth, visitDate);
    let totalMinutes = 0;
    let lessonCount = 0;

    while (lessonIndex < lessons.length && lessonCount < 3) {
      const lesson = lessons[lessonIndex];
      const withinAge = (lesson.seqAge == null || lesson.seqAge <= ageMonths) &&
                        (lesson.upToAge == null || ageMonths <= lesson.upToAge);
      const fitsTime = (totalMinutes + lesson.minutes) <= 120;

      if (withinAge && fitsTime) {
        rows.push({
          visit: visitIndex + 1,
          date: visitDate,
          ageM: ageMonths,
          code: lesson.code,
          subject: lesson.subject,
          minutes: lesson.minutes,
        });

        totalMinutes += lesson.minutes;
        lessonCount += 1;
        lessonIndex += 1;
      } else {
        break;
      }
    }

    if (lessonCount === 0 && lessonIndex < lessons.length && lessons[lessonIndex].minutes > 120) {
      const lesson = lessons[lessonIndex];
      rows.push({
        visit: visitIndex + 1,
        date: visitDate,
        ageM: ageMonths,
        code: lesson.code,
        subject: lesson.subject,
        minutes: lesson.minutes,
      });
      lessonIndex += 1;
    }
  }

  return rows;
}
