import { monthsBetween, parseDate } from './dates.js';

const pacingEl = document.getElementById('pacing');
const definedEl = document.getElementById('definedPref');
const birthEl = document.getElementById('birthDate');
const pregEl = document.getElementById('pregnant');
const anticipatedEl = document.getElementById('anticipatedBirth');
const ageLabel = document.getElementById('ageLabel');
const statusEl = document.getElementById('status');

function updateDefinedState() {
  if (!pacingEl || !definedEl) return;
  definedEl.disabled = pacingEl.value !== 'defined';
}

function updateAgeLabel() {
  if (!ageLabel) return;

  const isPregnant = pregEl?.value === 'yes';
  const birth = parseDate(isPregnant ? anticipatedEl?.value : birthEl?.value);

  if (!birth) {
    ageLabel.textContent = '—';
    return;
  }

  const today = new Date();
  const months = monthsBetween(birth, today);
  ageLabel.textContent = months < 0 ? 'Prenatal' : `${months} months`;
}

export function initUI() {
  updateDefinedState();
  updateAgeLabel();

  pacingEl?.addEventListener('change', () => {
    updateDefinedState();
  });

  [pregEl, birthEl, anticipatedEl].forEach((el) => {
    el?.addEventListener('change', updateAgeLabel);
  });
}

export function readSelections() {
  const isFTP = document.getElementById('ftp')?.value === 'yes';
  const isPregnant = pregEl?.value === 'yes';

  const birth = parseDate(isPregnant ? anticipatedEl?.value : birthEl?.value);
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
