import { addDays, addMonths } from './dates.js';

export function generateVisits(pacing, definedPref, birth, first) {
  const end = new Date(birth);
  end.setMonth(end.getMonth() + 36);

  const visits = [];
  let current = new Date(first);

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

  while (current <= end) {
    visits.push(new Date(current));
    const step = stepFor(current);
    current = addDays(current, step);
  }

  if (pacing !== 'defined') {
    const thirdBirthday = new Date(birth);
    thirdBirthday.setMonth(thirdBirthday.getMonth() + 36);
    const lastVisit = visits[visits.length - 1];
    if (!lastVisit || lastVisit.getTime() !== thirdBirthday.getTime()) {
      visits.push(thirdBirthday);
    }
  }

  return visits;
}
