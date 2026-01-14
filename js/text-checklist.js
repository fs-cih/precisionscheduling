import { fmtDate } from './dates.js';

export function generateTextChecklist(scheduleData, formData) {
  const lines = [];
  const today = new Date();

  const addHeading = (text) => {
    lines.push(text);
    lines.push('-'.repeat(text.length));
  };

  const addField = (label, value) => {
    lines.push(`${label}: ${value || '______'}`);
  };

  const addBlankLine = () => lines.push('');

  lines.push('Precision Schedule');
  addBlankLine();

  addHeading('Affiliate Scheduling Information');
  addField('Date Generated', today.toLocaleDateString());
  addField('Participant ID', formData.pid);
  addField('Date of First Lesson', formData.firstLesson ? fmtDate(formData.firstLesson) : '');

  const durationMap = {
    'up_to_3rd_birthday': "Up to youngest child's 3rd birthday",
    'up_to_due_date': 'Up to due date',
    '6_months': '6 months from first visit',
    '12_months': '12 months from first visit',
  };
  addField(
    'Duration of Schedule',
    durationMap[formData.scheduleDuration] || formData.scheduleDuration,
  );

  let pacingText = formData.pacing === 'standard' ? 'Standard' : 'Defined';
  if (formData.pacing === 'defined' && formData.definedPref) {
    const prefMap = {
      weekly: 'Weekly',
      biweekly: 'Every 2 weeks',
      monthly: 'Monthly',
      bimonthly: 'Every 2 months',
    };
    pacingText += ` (${prefMap[formData.definedPref] || formData.definedPref})`;
  }
  addField('Pacing', pacingText);
  addBlankLine();

  addHeading('Child Information');
  addField(
    'Birth or Due Date of Youngest Child',
    formData.birthDate ? fmtDate(formData.birthDate) : '',
  );
  addBlankLine();

  addHeading('Participant (Primary Adult) Information');
  addField('Participant is First-Time Parent', formData.isFirstTimeParent ? 'Yes' : 'No');
  addField('Is the Participant Pregnant', formData.isPregnant ? 'Yes' : 'No');
  addBlankLine();

  addHeading('Topics of Interest to Family');
  const topics = formData.topics || {};
  const topicLabels = {
    cfw: 'Caregiver & Family Wellbeing',
    fp: 'Family Planning',
    nutrition: 'Nutrition',
    sti: 'Sexually Transmitted Infections',
    substance: 'Substance Use',
  };
  const selectedTopics = Object.keys(topicLabels)
    .filter((key) => topics[key])
    .map((key) => topicLabels[key]);
  if (selectedTopics.length) {
    selectedTopics.forEach((topic) => lines.push(`• ${topic}`));
  } else {
    lines.push('None selected');
  }
  addBlankLine();

  addHeading('Schedule');

  const rows = scheduleData.rows || [];
  const visitGroups = new Map();

  rows.forEach((row) => {
    if (!visitGroups.has(row.visit)) {
      visitGroups.set(row.visit, []);
    }
    visitGroups.get(row.visit).push(row);
  });

  visitGroups.forEach((visitRows, visitNum) => {
    addBlankLine();
    lines.push(`Visit ${visitNum} - ${fmtDate(visitRows[0].date)}`);
    visitRows.forEach((row) => {
      const lessonText = row.placeholder ? row.subject : `${row.code}: ${row.subject}`;
      lines.push(`- ${lessonText}`);
    });
    addBlankLine();
    lines.push('Date Delivered: _______________');
    lines.push('Notes:');
    lines.push('');
    lines.push('');
  });

  return lines.join('\n');
}
