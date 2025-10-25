import { parseDate } from './dates.js';

const pacingEl = document.getElementById('pacing');
const agePriorityEl = document.getElementById('agePriority');
const definedEl = document.getElementById('definedPref');
const birthEl = document.getElementById('birthDate');
const pregEl = document.getElementById('pregnant');
const dueDateEl = document.getElementById('dueDate');
const statusEl = document.getElementById('status');
const maxLessonsEl = document.getElementById('maxLessons');

function updateDefinedState() {
  if (!pacingEl || !definedEl) return;
  definedEl.disabled = pacingEl.value !== 'defined';
}

function updateDueDateState() {
  if (!dueDateEl) return;

  const isPregnant = pregEl?.value === 'yes';

  if (isPregnant) {
    dueDateEl.disabled = false;
    dueDateEl.required = true;
  } else {
    dueDateEl.value = '';
    dueDateEl.disabled = true;
    dueDateEl.required = false;
  }
}

export function initUI() {
  updateDefinedState();
  updateDueDateState();

  pacingEl?.addEventListener('change', () => {
    updateDefinedState();
  });

  pregEl?.addEventListener('change', () => {
    updateDueDateState();
  });
}

export function resetForm() {
  const pidEl = document.getElementById('pid');
  if (pidEl) pidEl.value = '';

  const firstLessonEl = document.getElementById('firstLesson');
  if (firstLessonEl) firstLessonEl.value = '';

  if (agePriorityEl) agePriorityEl.value = 'standard';

  if (pacingEl) pacingEl.value = 'standard';
  if (definedEl) definedEl.value = '';

  if (maxLessonsEl) maxLessonsEl.value = '3';

  const ftpEl = document.getElementById('ftp');
  if (ftpEl) ftpEl.value = 'no';

  if (pregEl) pregEl.value = 'no';

  if (birthEl) birthEl.value = '';
  if (dueDateEl) dueDateEl.value = '';

  const topicIds = ['topic_cfw', 'topic_fp', 'topic_nutrition', 'topic_sti', 'topic_substance'];
  topicIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });

  updateDefinedState();
  updateDueDateState();
}

export function readSelections() {
  const isFTP = document.getElementById('ftp')?.value === 'yes';
  const isPregnant = pregEl?.value === 'yes';

  const birth = parseDate(isPregnant ? dueDateEl?.value : birthEl?.value);
  const first = parseDate(document.getElementById('firstLesson')?.value);
  const parsedLimit = Number.parseInt(maxLessonsEl?.value ?? '', 10);
  const maxLessonsPerVisit = Number.isNaN(parsedLimit) ? 3 : Math.max(1, parsedLimit);

  return {
    pid: document.getElementById('pid')?.value.trim() ?? '',
    pacing: pacingEl?.value ?? 'standard',
    definedPref: definedEl?.value || null,
    isFTP: Boolean(isFTP),
    isPregnant: Boolean(isPregnant),
    agePriority: agePriorityEl?.value ?? 'standard',
    birth,
    first,
    topics: {
      cfw: Boolean(document.getElementById('topic_cfw')?.checked),
      fp: Boolean(document.getElementById('topic_fp')?.checked),
      nutrition: Boolean(document.getElementById('topic_nutrition')?.checked),
      sti: Boolean(document.getElementById('topic_sti')?.checked),
      substance: Boolean(document.getElementById('topic_substance')?.checked),
    },
    maxLessonsPerVisit,
  };
}

export function setStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message;
}
