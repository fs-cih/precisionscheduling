import { initUI, readSelections, resetForm, setStatus } from './ui.js';
import { generateVisits } from './pacing.js';
import { filterLessons } from './filters.js';
import { assignLessons } from './assign.js';
import { clearSchedule, updateSchedule } from './schedule.js';
import { getLessons } from './lessons.js';

async function handleGenerate() {
  try {
    const selection = readSelections();

    if (!selection.first || !selection.birth) {
      setStatus('Please fill First Lesson Date and Birth Date (or Due Date).');
      return;
    }

    setStatus('Building schedule…');

    const lessons = await getLessons();
    const visits = generateVisits(selection.pacing, selection.definedPref, selection.birth, selection.first);
    const participant = {
      birth: selection.birth,
      isFirstTimeParent: selection.isFTP,
      isPregnant: selection.isPregnant,
      pacing: selection.pacing,
      agePriority: selection.agePriority,
      topics: selection.topics,
      preferredVisitDuration: selection.preferredVisitDuration,
      completedLessons: selection.completedLessons,
    };
    const queue = filterLessons(lessons, participant);
    const schedule = assignLessons(visits, participant, queue);

    updateSchedule(schedule, selection.pid);
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
