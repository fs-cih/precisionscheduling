import { initUI, readSelections, resetForm, setStatus } from './ui.js';
import { generateVisits } from './pacing.js';
import { filterLessons } from './filters.js';
import { assignLessons } from './assign.js';
import { clearSchedule, updateSchedule } from './schedule.js';

let lessonsCache = null;

async function fetchLessons() {
  if (!lessonsCache) {
    const response = await fetch('lessons.json');
    if (!response.ok) {
      throw new Error('Could not load lessons.json');
    }
    lessonsCache = await response.json();
  }
  return lessonsCache;
}

async function handleGenerate() {
  try {
    const selection = readSelections();

    if (!selection.first || !selection.birth) {
      setStatus('Please fill First Lesson Date and Birth Date (or Due Date).');
      return;
    }

    setStatus('Building schedule…');

    const lessons = await fetchLessons();
    const visits = generateVisits(selection.pacing, selection.definedPref, selection.birth, selection.first);
    const participant = {
      birth: selection.birth,
      isFirstTimeParent: selection.isFTP,
      isPregnant: selection.isPregnant,
      pacing: selection.pacing,
      topics: selection.topics,
    };
    const queue = filterLessons(lessons, participant);
    const rows = assignLessons(visits, participant, queue);

    updateSchedule(rows, visits.length, selection.pid);
    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus(`Error: ${error.message}`);
  }
}

function boot() {
  initUI();
  document.getElementById('generateBtn')?.addEventListener('click', handleGenerate);
  document.getElementById('resetBtn')?.addEventListener('click', () => {
    resetForm();
    clearSchedule();
    setStatus('');
  });
}

boot();
