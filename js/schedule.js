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
    const tdCode = document.createElement('td');
    tdCode.textContent = row.code;
    const tdSubject = document.createElement('td');
    tdSubject.textContent = row.subject;
    const tdMinutes = document.createElement('td');
    tdMinutes.textContent = row.minutes;
    const tdTotal = document.createElement('td');
    tdTotal.textContent = isLastOfVisit ? visitTotal : '';

    tr.append(tdVisit, tdDate, tdAge, tdCode, tdSubject, tdMinutes, tdTotal);
    scheduleBody.appendChild(tr);

    if (isLastOfVisit) {
      visitTotal = 0;
    }
  });
}

function buildCsv(rows, pid) {
  const header = ['Participant ID', 'Visit #', 'Visit Date', 'Child Age (months)', 'Lesson Code', 'Lesson Subject', 'Minutes'];
  const lines = [header.join(',')];

  rows.forEach((row) => {
    const age = row.ageM < 0 ? 'Prenatal' : row.ageM;
    const subject = `"${row.subject.replace(/"/g, '""')}"`;
    lines.push([pid, row.visit, fmtDate(row.date), age, row.code, subject, row.minutes].join(','));
  });

  return lines.join('\n');
}

export function updateSchedule(schedule, pid) {
  const {
    rows = [],
    totalVisits = 0,
    visitsUsed = 0,
    overflowCount = 0,
    removedVisits = 0,
  } = schedule ?? {};

  renderRows(rows);

  let summaryText = '';
  if (rows.length) {
    const lessonsWord = rows.length === 1 ? 'lesson' : 'lessons';
    const visitWord = visitsUsed === 1 ? 'visit' : 'visits';
    summaryText = `Scheduled ${rows.length} ${lessonsWord} across ${visitsUsed} ${visitWord} (planned: ${totalVisits}).`;

    if (removedVisits > 0) {
      const removedWord = removedVisits === 1 ? 'visit' : 'visits';
      summaryText += ` Removed ${removedVisits} ${removedWord} with no lessons.`;
    }

    if (overflowCount > 0) {
      const overflowWord = overflowCount === 1 ? 'lesson' : 'lessons';
      summaryText += ` Unable to place ${overflowCount} ${overflowWord}; visit capacity exceeded.`;
    }
  } else {
    summaryText = totalVisits
      ? `No lessons could be scheduled. Planned visits: ${totalVisits}.`
      : 'No lessons could be scheduled.';
  }

  if (summaryEl) {
    summaryEl.textContent = summaryText;
    summaryEl.classList.toggle('warn', overflowCount > 0);
    summaryEl.classList.toggle('muted', overflowCount === 0);
  }

  if (resultsCard) {
    const shouldShow = rows.length > 0 || overflowCount > 0 || removedVisits > 0;
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
    summaryEl.textContent = '';
  }
  if (exportBtn) {
    resetExport();
  }
}
