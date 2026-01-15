# Precision Scheduling Tool

This project generates customized lesson schedules from the lesson catalog in `lessons.json`. The user interface lives in `index.html`, and all presentation styles and application logic have been modularized for clarity and reuse.

## File structure

- `index.html` – Markup for the scheduling form and results table. Loads the stylesheet and initializes the JavaScript application.
- `styles.css` – Global styles for layout, typography, form controls, and table presentation.
- `lessons.json` – Source data that contains the full set of lessons.
- `js/app.js` – Application entry point. Wires up the Generate button, orchestrates data fetching, and coordinates the scheduling pipeline.
- `js/ui.js` – Manages form dynamics (pacing toggle, age calculations), exposes helpers to read the user's selections, and updates UI status messages.
- `js/dates.js` – Date utilities used throughout the app (`parseDate`, `fmtDate`, `addDays`, `monthsBetween`).
- `js/pacing.js` – Builds the visit cadence according to the selected pacing rules.
- `js/filters.js` – Filters lessons by participant traits and selected topics.
- `js/assign.js` – Packs filtered lessons into scheduled visits while respecting time and age constraints.
- `js/schedule.js` – Renders the schedule table, summary details, and CSV export functionality.

## Development

Open `index.html` in a browser or serve the directory with a static file server (for example, `python -m http.server`) to run the tool locally.

### Age tolerance logic

Participants scheduled with the standard (non-"appropriate") priority can now receive lessons up to four months before a lesson's recommended starting age. The same four month tolerance is used by the scoring logic so that visits in this early window are treated as on time while still applying steep penalties to lessons scheduled more than four months early or late. This helps ensure the initial visits populate with lessons immediately after birth in realistic scenarios.
