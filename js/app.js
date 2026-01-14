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
      setStatus('Please fill the First Lesson Date and the Birth or Due Date.');
      return;
    }

    setStatus('Building schedule…');

    const lessons = await getLessons();
    const visits = generateVisits(
      selection.pacing,
      selection.definedPref,
      selection.birth,
      selection.first,
      selection.scheduleDuration,
    );
    const participant = {
      birth: selection.birth,
      isFirstTimeParent: selection.isFTP,
      isPregnant: selection.isPregnant,
      pacing: selection.pacing,
      topics: selection.topics,
      completedLessons: selection.completedLessons,
    };
    const queue = filterLessons(lessons, participant);
    const schedule = assignLessons(visits, participant, queue);

    // Prepare form data for PDF generation
    const formData = {
      pid: selection.pid,
      firstLesson: selection.first,
      scheduleDuration: selection.scheduleDuration,
      pacing: selection.pacing,
      definedPref: selection.definedPref,
      birthDate: selection.birth,
      isFirstTimeParent: selection.isFTP,
      isPregnant: selection.isPregnant,
      topics: selection.topics,
    };

    updateSchedule(schedule, selection.pid, formData);
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
