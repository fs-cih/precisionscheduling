export function parseDate(value) {
  return value ? new Date(`${value}T12:00:00`) : null;
}

export function fmtDate(date) {
  return date.toLocaleDateString();
}

export function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function monthsBetween(birth, current) {
  let months = (current.getFullYear() - birth.getFullYear()) * 12 +
               (current.getMonth() - birth.getMonth());
  if (current.getDate() < birth.getDate()) {
    months -= 1;
  }
  return months;
}
