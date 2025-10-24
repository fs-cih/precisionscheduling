import { parseDate } from './dates.js';

const pacingEl = document.getElementById('pacing');
const definedEl = document.getElementById('definedPref');
const birthEl = document.getElementById('birthDate');
const pregEl = document.getElementById('pregnant');
const dueDateEl = document.getElementById('dueDate');
const statusEl = document.getElementById('status');

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

export function readSelections() {
  const isFTP = document.getElementById('ftp')?.value === 'yes';
  const isPregnant = pregEl?.value === 'yes';

  const birth = parseDate(isPregnant ? dueDateEl?.value : birthEl?.value);
  const first = parseDate(document.getElementById('firstLesson')?.value);

  return {
    pid: document.getElementById('pid')?.value.trim() ?? '',
    pacing: pacingEl?.value ?? 'standard',
    definedPref: definedEl?.value || null,
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
  };
}

export function setStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message;
}
