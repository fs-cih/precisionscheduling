# jsPDF Setup Instructions

To enable the "Download PDF Checklist" feature, you need to include the jsPDF library.

## Option 1: Download Manually

1. Download jsPDF from: https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
2. Save it as `jspdf.umd.min.js` in the root directory of this project

## Option 2: Use CDN (if internet is available when hosting)

Replace the script tag in index.html:
```html
<script src="jspdf.umd.min.js"></script>
```

With:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```

## Verification

After adding the library, refresh the page and click "Generate Schedule". The "Download PDF Checklist" button should now work and generate a PDF with all participant information and the schedule.
