import { fmtDate } from './dates.js';

/**
 * Generates a PDF checklist with participant information and simplified schedule
 * @param {Object} scheduleData - The schedule data object containing rows
 * @param {Object} formData - The form data with all user selections
 */
export function generatePdfChecklist(scheduleData, formData) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 54; // 0.75 inches = 54 points
  const lineGap = 6;
  let yPos = margin;
  let currentPage = 1;

  // Title
  const advanceLine = (multiplier = 1) => {
    const fontSize = doc.currentPage?.fontSize ?? 10;
    yPos += (fontSize + lineGap) * multiplier;
  };

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text('Precision Schedule', margin, yPos);
  advanceLine(1.8);

  // Helper to add a section heading
  const addSectionHeading = (text) => {
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(text, margin, yPos);
    advanceLine();
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
  };

  // Helper to add a field
  const addField = (label, value) => {
    const text = `${label}: ${value || '______'}`;
    doc.text(text, margin, yPos);
    advanceLine();
  };

  // Helper to check if we need a new page
  const checkNewPage = (spaceNeeded = 20) => {
    if (yPos + spaceNeeded > pageHeight - margin) {
      doc.addPage();
      currentPage++;
      yPos = margin;
      // Add header on new pages
      addPageHeader(doc, formData.pid, currentPage);
    }
  };

  // Affiliate Scheduling Information
  addSectionHeading('Affiliate Scheduling Information');
  
  const today = new Date();
  addField('Date Generated', today.toLocaleDateString());
  addField('Participant ID', formData.pid);
  addField('Date of First Lesson', formData.firstLesson ? fmtDate(formData.firstLesson) : '');
  
  // Duration of schedule
  const durationMap = {
    'up_to_3rd_birthday': "Up to youngest child's 3rd birthday",
    'up_to_due_date': 'Up to due date',
    '6_months': '6 months from first visit',
    '12_months': '12 months from first visit'
  };
  addField('Duration of Schedule', durationMap[formData.scheduleDuration] || formData.scheduleDuration);
  
  // Pacing
  let pacingText = formData.pacing === 'standard' ? 'Standard' : 'Defined';
  if (formData.pacing === 'defined' && formData.definedPref) {
    const prefMap = {
      'weekly': 'Weekly',
      'biweekly': 'Every 2 weeks',
      'monthly': 'Monthly',
      'bimonthly': 'Every 2 months'
    };
    pacingText += ` (${prefMap[formData.definedPref] || formData.definedPref})`;
  }
  addField('Pacing', pacingText);
  
  advanceLine(0.8);
  checkNewPage();

  // Child Information
  addSectionHeading('Child Information');
  addField('Birth or Due Date of Youngest Child', formData.birthDate ? fmtDate(formData.birthDate) : '');
  
  advanceLine(0.8);
  checkNewPage();

  // Participant (Primary Adult) Information
  addSectionHeading('Participant (Primary Adult) Information');
  addField('Participant is First-Time Parent', formData.isFirstTimeParent ? 'Yes' : 'No');
  addField('Is the Participant Pregnant', formData.isPregnant ? 'Yes' : 'No');
  
  advanceLine(0.8);
  checkNewPage();

  // Topics of Interest to Family
  addSectionHeading('Topics of Interest to Family');
  const topics = formData.topics || {};
  const selectedTopics = [];
  const topicLabels = {
    cfw: 'Caregiver & Family Wellbeing',
    fp: 'Family Planning',
    nutrition: 'Nutrition',
    sti: 'Sexually Transmitted Infections',
    substance: 'Substance Use'
  };
  
  Object.keys(topicLabels).forEach(key => {
    if (topics[key]) {
      selectedTopics.push(topicLabels[key]);
    }
  });

  if (selectedTopics.length > 0) {
    selectedTopics.forEach(topic => {
      doc.text(`• ${topic}`, margin + 5, yPos);
      advanceLine();
    });
  } else {
    doc.text('None selected', margin, yPos);
    advanceLine();
  }
  
  advanceLine();
  checkNewPage(60);

  // Simplified Schedule
  addSectionHeading('Schedule');
  advanceLine(0.8);

  // Group rows by visit
  const rows = scheduleData.rows || [];
  const visitGroups = new Map();
  
  rows.forEach(row => {
    if (!visitGroups.has(row.visit)) {
      visitGroups.set(row.visit, []);
    }
    visitGroups.get(row.visit).push(row);
  });

  // Render each visit
  visitGroups.forEach((visitRows, visitNum) => {
    checkNewPage(40);
    
    // Draw a bold line above the lesson
    doc.setLineWidth(1);
    doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    advanceLine(0.8);

    // Visit date
    doc.setFont(undefined, 'bold');
    doc.text(`Visit ${visitNum} - ${fmtDate(visitRows[0].date)}`, margin, yPos);
    advanceLine();

    // Lessons
    doc.setFont(undefined, 'normal');
    visitRows.forEach(row => {
      const lessonText = row.placeholder 
        ? row.subject 
        : `${row.code}: ${row.subject}`;
      doc.text(lessonText, margin + 5, yPos);
      advanceLine();
    });

    advanceLine(0.8);

    // Space for notes
    doc.setFontSize(9);
    doc.text('Date Delivered: _______________', margin + 5, yPos);
    advanceLine();
    doc.text('Notes:', margin + 5, yPos);
    advanceLine();
    advanceLine();
    advanceLine();
    advanceLine(1.5);
    doc.setFontSize(10);
  });

  return doc;
}

/**
 * Adds header with participant ID and page number to pages 2+
 */
function addPageHeader(doc, pid, pageNum) {
  if (pageNum > 1) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    const pageWidth = doc.internal.pageSize.getWidth();
    const headerText = `Participant ID: ${pid || 'N/A'} | Page ${pageNum}`;
    const textWidth = doc.getTextWidth(headerText);
    doc.text(headerText, pageWidth - textWidth - 54, 15); // Changed from 20 to 54
  }
}
