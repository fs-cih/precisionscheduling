import { fmtDate } from './dates.js';

const scheduleBody = document.getElementById('scheduleBody');
const resultsCard = document.getElementById('resultsCard');
const summaryEl = document.getElementById('summary');
const exportBtn = document.getElementById('exportBtn');

function resetExport() {
  exportBtn.disabled = true;
  exportBtn.onclick = null;
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatVariance(standardAge, actualAge) {
  if (!Number.isFinite(standardAge) || !Number.isFinite(actualAge)) {
    return '';
  }

  let diff = Math.round((standardAge - actualAge) * 10) / 10;

  if (Object.is(diff, -0)) {
    diff = 0;
  }

  if (Math.abs(diff) < 1e-6) {
    return '0';
  }

  const display = Number.isInteger(diff)
    ? diff.toString()
    : diff.toFixed(1).replace(/\.0$/, '');

  return diff > 0 ? `+${display}` : display;
}

function renderRows(rows) {
  scheduleBody.innerHTML = '';

  let currentVisit = null;
  let visitTotal = 0;

  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    const isLastOfVisit = index === rows.length - 1 || rows[index + 1].visit !== row.visit;

    visitTotal = currentVisit === row.visit ? visitTotal + row.minutes : row.minutes;
    currentVisit = row.visit;

    const tdVisit = document.createElement('td');
    tdVisit.textContent = row.visit;
    const tdDate = document.createElement('td');
    tdDate.textContent = fmtDate(row.date);
    const tdAge = document.createElement('td');
    tdAge.textContent = row.ageM < 0 ? 'Prenatal' : row.ageM;
    const tdVariance = document.createElement('td');
    tdVariance.textContent = formatVariance(row.standardAgeM, row.ageM);
    const tdCode = document.createElement('td');
    tdCode.textContent = row.placeholder ? '—' : row.code;
    const tdSubject = document.createElement('td');
    tdSubject.textContent = row.subject;
    const tdMinutes = document.createElement('td');
    tdMinutes.textContent = row.minutes;
    const tdTotal = document.createElement('td');
    tdTotal.textContent = isLastOfVisit ? visitTotal : '';

    tr.append(tdVisit, tdDate, tdAge, tdVariance, tdCode, tdSubject, tdMinutes, tdTotal);
    scheduleBody.appendChild(tr);

    if (isLastOfVisit) {
      visitTotal = 0;
    }
  });
}

function buildCsv(rows, pid) {
  const header = [
    'Participant ID',
    'Visit #',
    'Visit Date',
    'Child Age (months)',
    'Variance from Standard Sequence',
    'Lesson Code',
    'Lesson Subject',
    'Minutes',
  ];
  const lines = [header.join(',')];

  rows.forEach((row) => {
    const age = row.ageM < 0 ? 'Prenatal' : row.ageM;
    const subject = `"${row.subject.replace(/"/g, '""')}"`;
    const variance = formatVariance(row.standardAgeM, row.ageM);
    lines.push([pid, row.visit, fmtDate(row.date), age, variance, row.code, subject, row.minutes].join(','));
  });

  return lines.join('\n');
}

export function updateSchedule(schedule, pid) {
  const {
    rows = [],
    overflowCount = 0,
    skippedCount = 0,
    removedVisits = 0,
    expectedLessonCount = 0,
  } = schedule ?? {};

  renderRows(rows);

  const scheduledLessons = rows.filter((row) => !row.placeholder);
  const lessonCount = scheduledLessons.length;
  const expectedLessons = Number.isFinite(expectedLessonCount)
    ? expectedLessonCount
    : 0;

  const visitLessonCounts = scheduledLessons.reduce((counts, row) => {
    const currentCount = counts.get(row.visit) ?? 0;
    counts.set(row.visit, currentCount + 1);
    return counts;
  }, new Map());

  const visitsScheduled = visitLessonCounts.size;
  const visitsWithMultipleLessons = Array.from(visitLessonCounts.values()).filter(
    (count) => count >= 2,
  ).length;

  const summaryLines = [
    `Visits scheduled: ${visitsScheduled}`,
    `Lessons expected to be scheduled based on selected parameters: ${expectedLessons}`,
    `Lessons actually scheduled: ${lessonCount}`,
    `Visits with 2+ lessons scheduled: ${visitsWithMultipleLessons}`,
  ];

  if (removedVisits > 0) {
    summaryLines.push(`Visits with no lessons scheduled: ${removedVisits}`);
  }

  if (overflowCount > 0) {
    summaryLines.push(`Lessons not scheduled due to visit capacity: ${overflowCount}`);
  }

  if (skippedCount > 0) {
    summaryLines.push(`Lessons skipped; no eligible visits: ${skippedCount}`);
  }

  if (summaryEl) {
    summaryEl.innerHTML = summaryLines.map((line) => `<div>${line}</div>`).join('');
    const hasWarning = overflowCount > 0 || skippedCount > 0 || lessonCount !== expectedLessons;
    summaryEl.classList.toggle('warn', hasWarning);
    summaryEl.classList.toggle('muted', !hasWarning);
  }

  if (resultsCard) {
    const shouldShow = rows.length > 0 || overflowCount > 0 || removedVisits > 0 || skippedCount > 0;
    resultsCard.style.display = shouldShow ? 'block' : 'none';
  }

  if (rows.length) {
    exportBtn.disabled = false;
    exportBtn.onclick = () => download('schedule.csv', buildCsv(rows, pid));
  } else {
    resetExport();
  }
}

export function clearSchedule() {
  if (scheduleBody) {
    scheduleBody.innerHTML = '';
  }
  if (resultsCard) {
    resultsCard.style.display = 'none';
  }
  if (summaryEl) {
    summaryEl.innerHTML = '';
  }
  if (exportBtn) {
    resetExport();
  }
}
