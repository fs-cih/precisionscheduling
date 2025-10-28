import { addDays, addMonths } from './dates.js';

export function generateVisits(pacing, definedPref, birth, first, duration = 'up_to_3rd_birthday') {
  const thirdBirthday = addMonths(birth, 36);
  const endDate = (() => {
    switch (duration) {
      case 'up_to_due_date':
        return new Date(birth);
      case '6_months':
        return addMonths(first, 6);
      case '12_months':
        return addMonths(first, 12);
      default:
        return thirdBirthday;
    }
  })();

  if (first.getTime() >= thirdBirthday.getTime() || first.getTime() >= endDate.getTime()) {
    return [];
  }

  const visits = [new Date(first)];
  let current = visits[0];

  const postpartum3 = addMonths(birth, 3);
  const postpartum6 = addMonths(birth, 6);
  const postpartum22 = addMonths(birth, 22);

  const useDefinedPacing = pacing === 'defined';

  const stepFor = (date) => {
    if (useDefinedPacing) {
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
    if (candidate.getTime() >= endDate.getTime()) {
      break;
    }

    visits.push(candidate);
    current = candidate;
  }

  return visits;
}
