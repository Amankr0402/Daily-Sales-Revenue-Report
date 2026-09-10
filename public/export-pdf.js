/**
 * Universal PDF & CSV Export Utility for The Elefant Reports
 * Supports jsPDF + autoTable for direct PDF download and window.print fallback
 */

(function(window) {
  // Inject jsPDF and autoTable scripts dynamically if not already present
  function ensureJsPDF(callback) {
    if (window.jspdf && window.jspdf.jsPDF) {
      if (typeof callback === 'function') callback();
      return;
    }

    // Check if script tags already exist
    if (document.getElementById('jspdf-script')) {
      const checkInterval = setInterval(() => {
        if (window.jspdf && window.jspdf.jsPDF) {
          clearInterval(checkInterval);
          if (typeof callback === 'function') callback();
        }
      }, 50);
      return;
    }

    const script1 = document.createElement('script');
    script1.id = 'jspdf-script';
    script1.src = 'vendor/jspdf.umd.min.js';
    script1.onload = () => {
      const script2 = document.createElement('script');
      script2.id = 'jspdf-autotable-script';
      script2.src = 'vendor/jspdf.plugin.autotable.min.js';
      script2.onload = () => {
        if (typeof callback === 'function') callback();
      };
      script2.onerror = () => {
        // Fallback to CDN
        const cdnScript = document.createElement('script');
        cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
        cdnScript.onload = () => { if (typeof callback === 'function') callback(); };
        document.head.appendChild(cdnScript);
      };
      document.head.appendChild(script2);
    };
    script1.onerror = () => {
      // Fallback to CDN
      const cdnScript1 = document.createElement('script');
      cdnScript1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      cdnScript1.onload = () => {
        const cdnScript2 = document.createElement('script');
        cdnScript2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
        cdnScript2.onload = () => { if (typeof callback === 'function') callback(); };
        document.head.appendChild(cdnScript2);
      };
      document.head.appendChild(cdnScript1);
    };
    document.head.appendChild(script1);
  }

  // Pre-load jsPDF when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensureJsPDF());
  } else {
    ensureJsPDF();
  }

  /**
   * Main Export Table to PDF function
   */
  function exportTableToPDF(options) {
    options = options || {};
    const title = options.title || document.title.replace('— The Elefant', '').trim() || 'Report';
    const subtitle = options.subtitle || `Generated on ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}`;
    const filename = options.filename || `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    const orientation = options.orientation || 'landscape'; // default landscape for wide data tables

    ensureJsPDF(() => {
      try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
          console.warn('jsPDF not loaded, falling back to window.print()');
          window.print();
          return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
          orientation: orientation,
          unit: 'pt',
          format: 'a4'
        });

        // Add Header
        doc.setFillColor(91, 62, 155); // #5b3e9b
        doc.rect(0, 0, doc.internal.pageSize.getWidth(), 45, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text('THE ELEFANT', 30, 28);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('EXECUTIVE DATA REPORT', doc.internal.pageSize.getWidth() - 30, 28, { align: 'right' });

        // Report Title & Subtitle
        doc.setTextColor(15, 23, 42); // #0f172a
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 30, 72);

        doc.setTextColor(100, 116, 139); // #64748b
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.text(subtitle, 30, 88);

        // Extract or prepare table data
        let head = options.head;
        let body = options.body;

        if (!head || !body) {
          const table = options.tableEl || document.querySelector('table');
          if (!table) {
            alert('No table found to export.');
            return;
          }

          head = [];
          const ths = table.querySelectorAll('thead tr th');
          const headerRow = [];
          ths.forEach(th => {
            const txt = th.innerText.trim();
            // Skip action columns or buttons
            if (txt !== '#' && !txt.toLowerCase().includes('action') && txt !== '') {
              headerRow.push(txt);
            }
          });
          if (headerRow.length > 0) head.push(headerRow);

          body = [];
          const trs = table.querySelectorAll('tbody tr');
          trs.forEach(tr => {
            // Skip empty or loading states
            if (tr.children.length === 1 && tr.children[0].colSpan > 1) return;
            const rowData = [];
            const tds = tr.querySelectorAll('td');
            tds.forEach((td, idx) => {
              const thText = ths[idx] ? ths[idx].innerText.trim() : '';
              if (thText !== '#' && !thText.toLowerCase().includes('action')) {
                let cellText = td.innerText.replace(/📋|↗|⚡|📱|👤|🛍️|✓|✕/g, '').trim();
                cellText = cellText.replace(/\s+/g, ' ');
                rowData.push(cellText);
              }
            });
            if (rowData.length > 0) body.push(rowData);
          });
        }

        if (!body || body.length === 0) {
          alert('No records available to export.');
          return;
        }

        // AutoTable configuration
        doc.autoTable({
          head: head,
          body: body,
          startY: 102,
          margin: { left: 30, right: 30, bottom: 40 },
          styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: 6,
            textColor: [15, 23, 42],
            lineColor: [226, 232, 240],
            lineWidth: 0.5,
            overflow: 'linebreak'
          },
          headStyles: {
            fillColor: [91, 62, 155],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          didDrawPage: function(data) {
            // Footer
            const pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
            const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();

            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.setFont('helvetica', 'normal');
            doc.text('Confidential — The Elefant Daily Sales & Revenue Management System', 30, pageHeight - 15);
            doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 30, pageHeight - 15, { align: 'right' });
          }
        });

        // Save PDF
        doc.save(filename);
      } catch (err) {
        console.error('Error generating PDF:', err);
        // Fallback to print dialog
        window.print();
      }
    });
  }

  // Attach to window
  window.exportTableToPDF = exportTableToPDF;
  window.downloadCurrentPagePDF = function(customTitle, filename) {
    exportTableToPDF({
      title: customTitle,
      filename: filename
    });
  };

})(window);
