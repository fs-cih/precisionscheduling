import { addDays } from './dates.js';

export function generateVisits(pacing, definedPref, birth, first) {
  const end = new Date(birth);
  end.setMonth(end.getMonth() + 36);

  const visits = [];
  let current = new Date(first);

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

    if (date <= addDays(birth, 90)) return 7;
    if (date <= addDays(birth, 210)) return 14;
    if (date <= addDays(birth, 670)) return 30;
    return 60;
  };

  while (current <= end) {
    visits.push(new Date(current));
    const step = stepFor(current);
    current = addDays(current, step);
  }

  return visits;
}
