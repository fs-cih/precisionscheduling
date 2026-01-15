import { fmtDate } from './dates.js';
import { generatePdfChecklist } from './pdf.js';
import { generateTextChecklist } from './text-checklist.js';

const scheduleBody = document.getElementById('scheduleBody');
const resultsCard = document.getElementById('resultsCard');
const instructionsCard = document.getElementById('instructionsCard');
const summaryEl = document.getElementById('summary');
const exportBtn = document.getElementById('exportBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const exportTextBtn = document.getElementById('exportTextBtn');
const exportZipBtn = document.getElementById('exportZipBtn');
const logBtn = document.getElementById('logBtn');

function resetExport() {
  exportBtn.disabled = true;
  exportBtn.onclick = null;
}

function resetPdfExport() {
  if (!exportPdfBtn) {
    return;
  }
  exportPdfBtn.disabled = true;
  exportPdfBtn.onclick = null;
}

function resetTextExport() {
  if (!exportTextBtn) {
    return;
  }
  exportTextBtn.disabled = true;
  exportTextBtn.onclick = null;
}

function resetZipExport() {
  if (!exportZipBtn) {
    return;
  }
  exportZipBtn.disabled = true;
  exportZipBtn.onclick = null;
}

function resetLog() {
  if (!logBtn) {
    return;
  }
  logBtn.disabled = true;
  logBtn.onclick = null;
}

function download(filename, text, mimeType = 'text/plain') {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(filename, blob, mimeType = 'application/octet-stream') {
  const resolvedBlob = blob instanceof Blob ? blob : new Blob([blob], { type: mimeType });
  const url = URL.createObjectURL(resolvedBlob);
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
    'Date Delivered',
    'Notes',
  ];
  const lines = [header.join(',')];

  rows.forEach((row) => {
    const age = row.ageM < 0 ? 'Prenatal' : row.ageM;
    const subject = `"${row.subject.replace(/"/g, '""')}"`;
    const variance = formatVariance(row.standardAgeM, row.ageM);
    lines.push([pid, row.visit, fmtDate(row.date), age, variance, row.code, subject, row.minutes, '', ''].join(','));
  });

  return lines.join('\n');
}

function escapeCsv(value) {
  if (typeof value !== 'string') {
    return value ?? '';
  }

  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function escapeHtml(value) {
  if (typeof value !== 'string') {
    return value ?? '';
  }

  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

const textEncoder = new TextEncoder();
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

function toUint8(data) {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (typeof data === 'string') {
    return textEncoder.encode(data);
  }
  return new Uint8Array();
}

function crc32(data) {
  let crc = 0xffffffff;
  data.forEach((byte) => {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  });
  return (crc ^ 0xffffffff) >>> 0;
}

function concatUint8(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function buildZip(files) {
  let offset = 0;
  const localChunks = [];
  const centralChunks = [];

  files.forEach((file) => {
    const nameBytes = textEncoder.encode(file.name);
    const data = toUint8(file.data);
    const crc = crc32(data);
    const localHeader = new ArrayBuffer(30 + nameBytes.length);
    const localView = new DataView(localHeader);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    new Uint8Array(localHeader, 30).set(nameBytes);

    const localHeaderBytes = new Uint8Array(localHeader);
    localChunks.push(localHeaderBytes, data);

    const centralHeader = new ArrayBuffer(46 + nameBytes.length);
    const centralView = new DataView(centralHeader);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    new Uint8Array(centralHeader, 46).set(nameBytes);

    centralChunks.push(new Uint8Array(centralHeader));
    offset += localHeaderBytes.length + data.length;
  });

  const centralDir = concatUint8(centralChunks);
  const endRecord = new ArrayBuffer(22);
  const endView = new DataView(endRecord);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDir.length, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return concatUint8([...localChunks, centralDir, new Uint8Array(endRecord)]);
}

function buildLogCsv(eligibleScheduled, eligibleNotScheduled, notEligibleNotScheduled) {
  const header = [
    'Eligible Scheduled',
    'Eligible Not Scheduled',
    'Not Eligible Not Scheduled',
  ];
  const maxLength = Math.max(
    eligibleScheduled.length,
    eligibleNotScheduled.length,
    notEligibleNotScheduled.length,
  );
  const lines = [header.join(',')];

  for (let index = 0; index < maxLength; index += 1) {
    const row = [
      eligibleScheduled[index] ?? '',
      eligibleNotScheduled[index] ?? '',
      notEligibleNotScheduled[index] ?? '',
    ].map(escapeCsv);
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

export function updateSchedule(schedule, pid, formData = null) {
  const {
    rows = [],
    overflowCount = 0,
    skippedCount = 0,
    removedVisits = 0,
    expectedLessonCount = 0,
    eligibleScheduled = [],
    eligibleNotScheduled = [],
    notEligibleNotScheduled = [],
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
    if (eligibleNotScheduled.length > 0) {
      summaryLines.push(`<ul>${eligibleNotScheduled.map((code) => `<li>${escapeHtml(code)}</li>`).join('')}</ul>`);
    }
  }

  if (skippedCount > 0) {
    summaryLines.push(`Some selected parameters exclude these potential lessons: ${skippedCount}`);
    if (notEligibleNotScheduled.length > 0) {
      summaryLines.push(`<ul>${notEligibleNotScheduled.map((code) => `<li>${escapeHtml(code)}</li>`).join('')}</ul>`);
    }
  }

  if (summaryEl) {
    if (summaryLines.length) {
      summaryEl.innerHTML = summaryLines.map((line) => `<div>${line}</div>`).join('');
    } else {
      summaryEl.innerHTML = '';
    }
  }

  const shouldShow =
    rows.length > 0 || overflowCount > 0 || removedVisits > 0 || skippedCount > 0;

  if (instructionsCard) {
    instructionsCard.style.display = shouldShow ? 'block' : 'none';
  }

  if (resultsCard) {
    resultsCard.style.display = shouldShow ? 'block' : 'none';
  }

  if (rows.length) {
    exportBtn.disabled = false;
    exportBtn.onclick = () => download('schedule.csv', buildCsv(rows, pid), 'text/csv');
    
    if (exportPdfBtn && formData) {
      exportPdfBtn.disabled = false;
      exportPdfBtn.onclick = () => {
        const pdfDoc = generatePdfChecklist(schedule, formData);
        pdfDoc.save('precision-schedule-checklist.pdf');
      };
    }

    if (exportTextBtn && formData) {
      exportTextBtn.disabled = false;
      exportTextBtn.onclick = () => {
        const textDoc = generateTextChecklist(schedule, formData);
        download('precision-schedule-checklist.doc', textDoc, 'text/html');
      };
    }

    if (exportZipBtn && formData) {
      exportZipBtn.disabled = false;
      exportZipBtn.onclick = () => {
        const pdfDoc = generatePdfChecklist(schedule, formData);
        const pdfBytes = pdfDoc.output('arraybuffer');
        const textDoc = generateTextChecklist(schedule, formData);
        const csvDoc = buildCsv(rows, pid);
        const zipBytes = buildZip([
          { name: 'precision-schedule-checklist.pdf', data: pdfBytes },
          { name: 'precision-schedule-checklist.doc', data: textDoc },
          { name: 'schedule.csv', data: csvDoc },
        ]);
        downloadBlob('precision-schedule-files.zip', zipBytes, 'application/zip');
      };
    } else if (exportZipBtn) {
      resetZipExport();
    }
  } else {
    resetExport();
    resetPdfExport();
    resetTextExport();
    resetZipExport();
  }

  if (logBtn) {
    if (shouldShow) {
      logBtn.disabled = false;
      logBtn.onclick = () =>
        download(
          'scheduling-log.csv',
          buildLogCsv(eligibleScheduled, eligibleNotScheduled, notEligibleNotScheduled),
          'text/csv',
        );
    } else {
      resetLog();
    }
  }
}

export function clearSchedule() {
  if (scheduleBody) {
    scheduleBody.innerHTML = '';
  }
  if (instructionsCard) {
    instructionsCard.style.display = 'none';
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
  resetPdfExport();
  resetTextExport();
  resetZipExport();
  resetLog();
}
