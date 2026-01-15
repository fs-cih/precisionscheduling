import { fmtDate } from './dates.js';

export function generateTextChecklist(scheduleData, formData) {
  const parts = [];
  const today = new Date();

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const addSection = (title, content) => {
    parts.push(`<section class="section"><h2>${escapeHtml(title)}</h2>${content}</section>`);
  };

  const addDefinitionList = (items) =>
    `<dl>${items
      .map(
        ({ label, value }) =>
          `<div class="field"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(
            value || '______',
          )}</dd></div>`,
      )
      .join('')}</dl>`;

  const durationMap = {
    'up_to_3rd_birthday': "Up to youngest child's 3rd birthday",
    'up_to_due_date': 'Up to due date',
    '6_months': '6 months from first visit',
    '12_months': '12 months from first visit',
  };

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

  parts.push(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Precision Schedule Checklist</title>
    <style>
      body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1a1a; margin: 32px; }
      h1 { font-size: 24px; margin-bottom: 8px; }
      h2 { font-size: 18px; margin: 24px 0 8px; border-bottom: 2px solid #1a1a1a; padding-bottom: 4px; }
      .field { display: grid; grid-template-columns: 220px 1fr; gap: 12px; margin-bottom: 6px; }
      dt { font-weight: 600; }
      dd { margin: 0; }
      ul { margin: 0 0 0 18px; }
      .visit { margin-top: 16px; }
      .visit h3 { font-size: 16px; margin: 12px 0 6px; }
      .notes { margin-top: 8px; }
      .line { display: inline-block; min-width: 240px; border-bottom: 1px solid #333; }
    </style>
  </head>
  <body>
    <h1>Precision Schedule</h1>
  `);

  addSection(
    'Affiliate Scheduling Information',
    addDefinitionList([
      { label: 'Date Generated', value: today.toLocaleDateString() },
      { label: 'Participant ID', value: formData.pid },
      { label: 'Date of First Lesson', value: formData.firstLesson ? fmtDate(formData.firstLesson) : '' },
      {
        label: 'Duration of Schedule',
        value: durationMap[formData.scheduleDuration] || formData.scheduleDuration,
      },
      { label: 'Pacing', value: pacingText },
    ]),
  );

  addSection(
    'Child Information',
    addDefinitionList([
      {
        label: 'Birth or Due Date of Youngest Child',
        value: formData.birthDate ? fmtDate(formData.birthDate) : '',
      },
    ]),
  );

  addSection(
    'Participant (Primary Adult) Information',
    addDefinitionList([
      { label: 'Participant is First-Time Parent', value: formData.isFirstTimeParent ? 'Yes' : 'No' },
      { label: 'Is the Participant Pregnant', value: formData.isPregnant ? 'Yes' : 'No' },
    ]),
  );

  addSection(
    'Topics of Interest to Family',
    selectedTopics.length
      ? `<ul>${selectedTopics.map((topic) => `<li>${escapeHtml(topic)}</li>`).join('')}</ul>`
      : '<p>None selected</p>',
  );

  const rows = scheduleData.rows || [];
  const visitGroups = new Map();

  rows.forEach((row) => {
    if (!visitGroups.has(row.visit)) {
      visitGroups.set(row.visit, []);
    }
    visitGroups.get(row.visit).push(row);
  });

  const scheduleHtml = [];
  visitGroups.forEach((visitRows, visitNum) => {
    const lessons = visitRows
      .map((row) => {
        const lessonText = row.placeholder ? row.subject : `${row.code}: ${row.subject}`;
        return `<li>${escapeHtml(lessonText)}</li>`;
      })
      .join('');
    scheduleHtml.push(`
      <div class="visit">
        <h3>Visit ${escapeHtml(visitNum)} - ${escapeHtml(fmtDate(visitRows[0].date))}</h3>
        <ul>${lessons}</ul>
        <p class="notes">Date Delivered: <span class="line">&nbsp;</span></p>
        <p class="notes">Notes:</p>
        <p class="notes"><span class="line" style="width: 100%">&nbsp;</span></p>
        <p class="notes"><span class="line" style="width: 100%">&nbsp;</span></p>
      </div>
    `);
  });

  addSection('Schedule', scheduleHtml.join(''));

  parts.push(`
  </body>
</html>
  `);

  return parts.join('');
}
