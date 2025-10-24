export function parseDate(value) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const usFormat = /^\d{2}\/\d{2}\/\d{4}$/;
  if (usFormat.test(trimmed)) {
    const [month, day, year] = trimmed.split('/').map(Number);
    const date = new Date(year, month - 1, day, 12);

    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }

    return date;
  }

  const iso = new Date(`${trimmed}T12:00:00`);
  return Number.isNaN(iso.getTime()) ? null : iso;
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
