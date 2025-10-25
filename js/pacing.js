import { addDays, addMonths } from './dates.js';

export function generateVisits(pacing, definedPref, birth, first) {
  const thirdBirthday = addMonths(birth, 36);

  const visits = [new Date(thirdBirthday)];
  let current = new Date(thirdBirthday);

  const postpartum3 = addMonths(birth, 3);
  const postpartum6 = addMonths(birth, 6);
  const postpartum22 = addMonths(birth, 22);

  const stepFor = (date) => {
    if (pacing === 'defined') {
      switch (definedPref) {
        case 'weekly':
          return 7;
        case 'biweekly':
          return 14;
        case 'monthly':
          return 30;
        case 'bimonthly':
          return 60;
        default:
          return 30;
      }
    }

    if (date <= postpartum3) return 7;
    if (date <= postpartum6) return 14;
    if (date <= postpartum22) return 30;
    return 60;
  };

  if (pacing === 'defined') {
    const step = stepFor(first);
    if (Number.isFinite(step) && step > 0) {
      while (true) {
        const candidate = addDays(current, -step);
        if (candidate.getTime() < first.getTime()) {
          break;
        }
        visits.push(new Date(candidate));
        current = candidate;
      }
    }
  } else {
    const candidateSteps = [7, 14, 30, 60];
    while (current.getTime() > first.getTime()) {
      let matched = false;
      for (const step of candidateSteps) {
        const candidate = addDays(current, -step);
        if (candidate.getTime() < first.getTime()) {
          continue;
        }
        if (stepFor(candidate) === step) {
          visits.push(new Date(candidate));
          current = candidate;
          matched = true;
          break;
        }
      }
      if (!matched) {
        break;
      }
    }
  }

  const includeFirst = visits.some((visit) => visit.getTime() === first.getTime());
  if (!includeFirst) {
    visits.push(new Date(first));
  }

  visits.sort((a, b) => a.getTime() - b.getTime());

  return visits;
}
