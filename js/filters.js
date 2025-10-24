export function filterLessons(allLessons, selection) {
  return allLessons
    .filter((lesson) => {
      const passFoundation = !lesson.foundation || true;
      const passFTP = !lesson.firstTimeParent || selection.isFTP;
      const passPreg = !lesson.pregnant || selection.isPregnant;

      const topics = selection.topics;
      const passTopic =
        (!topics.cfw && !lesson.caregiverWellbeing ? true : topics.cfw || !lesson.caregiverWellbeing) &&
        (!topics.fp && !lesson.familyPlanning ? true : topics.fp || !lesson.familyPlanning) &&
        (!topics.nutrition && !lesson.nutrition ? true : topics.nutrition || !lesson.nutrition) &&
        (!topics.sti && !lesson.sti ? true : topics.sti || !lesson.sti) &&
        (!topics.substance && !lesson.substanceUse ? true : topics.substance || !lesson.substanceUse);

      return passFoundation && passFTP && passPreg && passTopic;
    })
    .sort((a, b) => (a.seqAge ?? 999) - (b.seqAge ?? 999));
}
