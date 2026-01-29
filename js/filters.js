const YES = 'yes';
export const AGE_TOLERANCE_MONTHS = 4;
const PRENATAL_TOLERANCE_MONTHS = 1;

function toBool(value) {
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === YES;
  }
  return Boolean(value);
}

function getLessonAgeRange(lesson) {
  const start = Number.isFinite(lesson?.seqAge) ? lesson.seqAge : 0;
  const end = Number.isFinite(lesson?.upToAge) ? lesson.upToAge : 36;
  return { start, end };
}

export function isLessonRelevant(lesson, participant, topics) {
  const foundation = toBool(lesson?.foundation);
  if (foundation) {
    return true;
  }

  const isFirstTimeParent = Boolean(participant?.isFirstTimeParent);
  const isPregnant = Boolean(participant?.isPregnant);

  if (isFirstTimeParent && toBool(lesson?.firstTimeParent)) {
    return true;
  }

  if (isPregnant && toBool(lesson?.pregnant)) {
    return true;
  }

  const topicSelections = topics ?? {};

  if (topicSelections.cfw && toBool(lesson?.caregiverWellbeing)) {
    return true;
  }

  if (topicSelections.fp && toBool(lesson?.familyPlanning)) {
    return true;
  }

  if (topicSelections.nutrition && toBool(lesson?.nutrition)) {
    return true;
  }

  if (topicSelections.sti && toBool(lesson?.sti)) {
    return true;
  }

  if (topicSelections.substance && toBool(lesson?.substanceUse)) {
    return true;
  }

  return false;
}

export function shouldPull(lesson, participant, topics, childAgeM, options = {}) {
  if (!isLessonRelevant(lesson, participant, topics)) {
    return false;
  }

  const { start, end } = getLessonAgeRange(lesson);
  const ignoreAgeRange = options?.ignoreAgeRange === true;
  const useTolerance = true;
  const foundationCatchUp =
    toBool(lesson?.foundation) &&
    Number.isFinite(lesson?.seqAge) &&
    lesson.seqAge < 0 &&
    Number.isFinite(lesson?.upToAge) &&
    lesson.upToAge > 0;
  const hasPostBirthVisit =
    Number.isFinite(participant?.firstVisitAgeM) &&
    participant.firstVisitAgeM >= 0 &&
    Number.isFinite(childAgeM) &&
    childAgeM >= 0;

  if (!participant?.isPregnant && start < 0) {
    if (!(foundationCatchUp && hasPostBirthVisit)) {
      return false;
    }
  }

  if (ignoreAgeRange) {
    return true;
  }

  if (Number.isFinite(end)) {
    if (childAgeM > end) {
      return false;
    }
  }

  if (Number.isFinite(start)) {
    const baseStart = foundationCatchUp && hasPostBirthVisit ? 0 : start;
    let effectiveStart = baseStart;

    if (baseStart >= 0) {
      if (useTolerance) {
        effectiveStart = Math.max(0, baseStart - AGE_TOLERANCE_MONTHS);
      }
    } else if (Number.isFinite(childAgeM)) {
      if (childAgeM < 0) {
        const tolerance = useTolerance
          ? Math.max(AGE_TOLERANCE_MONTHS, PRENATAL_TOLERANCE_MONTHS)
          : PRENATAL_TOLERANCE_MONTHS;
        let earliest = baseStart - tolerance;

        if (Number.isFinite(end) && end <= 0) {
          const prenatalWindow = Math.abs(end - baseStart);
          if (prenatalWindow > 0) {
            earliest = Math.min(earliest, baseStart - prenatalWindow);
          }
        }

        effectiveStart = Math.min(effectiveStart, earliest);
      } else {
        effectiveStart = baseStart;
      }
    }

    return childAgeM >= effectiveStart;
  }

  return true;
}

export function filterLessons(allLessons, participant) {
  const completed = new Set(
    Array.isArray(participant?.completedLessons)
      ? participant.completedLessons.filter((code) => typeof code === 'string' && code.trim() !== '')
      : [],
  );

  return allLessons
    .filter((lesson) => !completed.has(lesson?.code))
    .filter((lesson) => isLessonRelevant(lesson, participant, participant?.topics))
    .sort((a, b) => {
      const { start: startA } = getLessonAgeRange(a);
      const { start: startB } = getLessonAgeRange(b);
      return startA - startB;
    });
}

export { getLessonAgeRange };
