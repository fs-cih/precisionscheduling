import { addDays, addMonths } from './dates.js';

export function generateVisits(pacing, definedPref, birth, first) {
  const thirdBirthday = addMonths(birth, 36);

  if (first.getTime() >= thirdBirthday.getTime()) {
    return [];
  }

  const visits = [new Date(first)];
  let current = visits[0];

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

  while (true) {
    const step = stepFor(current);
    if (!Number.isFinite(step) || step <= 0) {
      break;
    }

    const candidate = addDays(current, step);
    if (candidate.getTime() >= thirdBirthday.getTime()) {
      break;
    }

    visits.push(candidate);
    current = candidate;
  }

  return visits;
}
