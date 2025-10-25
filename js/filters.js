const YES = 'yes';

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

export function shouldPull(lesson, participant, topics, childAgeM) {
  if (!isLessonRelevant(lesson, participant, topics)) {
    return false;
  }

  const { start, end } = getLessonAgeRange(lesson);

  if (!participant?.isPregnant && start < 0) {
    return false;
  }

  const priority = participant?.agePriority ?? 'standard';
  const meetsLowerBound = childAgeM >= start;
  const meetsUpperBound = childAgeM <= end;

  if (priority === 'appropriate') {
    return meetsLowerBound && meetsUpperBound;
  }

  if (!meetsUpperBound) {
    return false;
  }

  return meetsLowerBound;
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
