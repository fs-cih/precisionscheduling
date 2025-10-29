import { parseDate } from './dates.js';
import { getLessons } from './lessons.js';

const pacingEl = document.getElementById('pacing');
const definedEl = document.getElementById('definedPref');
const birthEl = document.getElementById('birthDate');
const pregEl = document.getElementById('pregnant');
const statusEl = document.getElementById('status');
const completedLessonsEl = document.getElementById('completedLessons');
const scheduleDurationEl = document.getElementById('scheduleDuration');

function updateDefinedState() {
  if (!pacingEl || !definedEl) return;
  definedEl.disabled = pacingEl.value !== 'defined';
}

function updatePregnancyState() {
  if (!birthEl || !pregEl) return;

  const birthDate = parseDate(birthEl.value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (birthDate && birthDate.getTime() > today.getTime()) {
    pregEl.value = 'yes';
    pregEl.disabled = true;
    pregEl.dataset.locked = 'true';
  } else {
    const wasLocked = pregEl.dataset.locked === 'true';
    pregEl.disabled = false;
    if (wasLocked) {
      pregEl.value = 'no';
    }
    delete pregEl.dataset.locked;
  }
}

export function initUI() {
  updateDefinedState();
  updatePregnancyState();

  pacingEl?.addEventListener('change', () => {
    updateDefinedState();
  });

  birthEl?.addEventListener('change', updatePregnancyState);
  birthEl?.addEventListener('input', updatePregnancyState);

  populateCompletedLessons();
}

export function resetForm() {
  const pidEl = document.getElementById('pid');
  if (pidEl) pidEl.value = '';

  const firstLessonEl = document.getElementById('firstLesson');
  if (firstLessonEl) firstLessonEl.value = '';

  if (pacingEl) pacingEl.value = 'standard';
  if (definedEl) definedEl.value = '';

  const ftpEl = document.getElementById('ftp');
  if (ftpEl) ftpEl.value = 'no';

  if (pregEl) {
    pregEl.value = 'no';
    pregEl.disabled = false;
    delete pregEl.dataset.locked;
  }

  if (birthEl) birthEl.value = '';

  if (scheduleDurationEl) scheduleDurationEl.value = 'up_to_3rd_birthday';

  const topicIds = ['topic_cfw', 'topic_fp', 'topic_nutrition', 'topic_sti', 'topic_substance'];
  topicIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });

  if (completedLessonsEl) {
    Array.from(completedLessonsEl.options).forEach((option) => {
      option.selected = false;
    });
  }

  updateDefinedState();
}

export function readSelections() {
  const isFTP = document.getElementById('ftp')?.value === 'yes';
  const isPregnant = pregEl?.value === 'yes';

  const birth = parseDate(birthEl?.value);
  const first = parseDate(document.getElementById('firstLesson')?.value);
  return {
    pid: document.getElementById('pid')?.value.trim() ?? '',
    pacing: pacingEl?.value ?? 'standard',
    definedPref: definedEl?.value || null,
    scheduleDuration: scheduleDurationEl?.value ?? 'up_to_3rd_birthday',
    isFTP: Boolean(isFTP),
    isPregnant: Boolean(isPregnant),
    birth,
    first,
    topics: {
      cfw: Boolean(document.getElementById('topic_cfw')?.checked),
      fp: Boolean(document.getElementById('topic_fp')?.checked),
      nutrition: Boolean(document.getElementById('topic_nutrition')?.checked),
      sti: Boolean(document.getElementById('topic_sti')?.checked),
      substance: Boolean(document.getElementById('topic_substance')?.checked),
    },
    completedLessons: completedLessonsEl
      ? Array.from(completedLessonsEl.selectedOptions).map((option) => option.value)
      : [],
  };
}

export function setStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message;
}

async function populateCompletedLessons() {
  if (!completedLessonsEl) return;

  try {
    const lessons = await getLessons();
    const sortedLessons = [...lessons].sort((a, b) => {
      const subjectA = (a?.subject ?? '').toLowerCase();
      const subjectB = (b?.subject ?? '').toLowerCase();
      if (subjectA < subjectB) return -1;
      if (subjectA > subjectB) return 1;
      return (a?.code ?? '').localeCompare(b?.code ?? '');
    });

    completedLessonsEl.innerHTML = '';

    sortedLessons.forEach((lesson) => {
      if (!lesson?.code || !lesson?.subject) return;

      const option = document.createElement('option');
      option.value = lesson.code;
      option.textContent = `${lesson.subject} (${lesson.code})`;
      completedLessonsEl.appendChild(option);
    });
  } catch (error) {
    console.error('Unable to load lessons for completed list', error);
    completedLessonsEl.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Unable to load lessons';
    option.disabled = true;
    completedLessonsEl.appendChild(option);
  }
}
