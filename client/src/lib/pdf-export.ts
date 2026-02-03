import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';

interface MenuItem {
  day: string;
  mealType: string;
  description: string;
  side1?: string | null;
  side2?: string | null;
  side3?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fats?: number | null;
  sugar?: number | null;
}

interface Menu {
  id: number;
  weekOf: string;
  fraternity: string;
  status: string;
  items?: MenuItem[];
}

export function exportMenuToPDF(menu: Menu): void {
  const doc = new jsPDF();
  const weekDate = format(parseISO(menu.weekOf), "MMMM d, yyyy");
  
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text("REBEL CHEFS", 105, 20, { align: "center" });
  
  doc.setFontSize(16);
  doc.text(`Weekly Menu - ${menu.fraternity}`, 105, 32, { align: "center" });
  
  doc.setFontSize(12);
  doc.text(`Week of ${weekDate}`, 105, 40, { align: "center" });
  
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const mealTypes = ["Lunch", "Dinner"];
  
  const items = menu.items || [];
  
  const tableData: (string | number)[][] = [];
  
  for (const day of days) {
    for (const mealType of mealTypes) {
      const item = items.find((i: MenuItem) => i.day === day && i.mealType === mealType);
      if (item) {
        const sides = [item.side1, item.side2, item.side3].filter(Boolean).join(", ");
        const macros = [
          item.calories ? `${item.calories} cal` : null,
          item.protein ? `${item.protein}g protein` : null,
          item.carbs ? `${item.carbs}g carbs` : null,
          item.fats ? `${item.fats}g fat` : null,
        ].filter(Boolean).join(" | ");
        
        tableData.push([
          day,
          mealType,
          item.description || "-",
          sides || "-",
          macros || "-",
        ]);
      } else {
        tableData.push([day, mealType, "-", "-", "-"]);
      }
    }
  }
  
  autoTable(doc, {
    head: [["Day", "Meal", "Main Item", "Sides", "Nutrition"]],
    body: tableData,
    startY: 50,
    theme: "grid",
    headStyles: {
      fillColor: [51, 51, 51],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 25, fontStyle: "bold" },
      1: { cellWidth: 20 },
      2: { cellWidth: 50 },
      3: { cellWidth: 45 },
      4: { cellWidth: 45 },
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    didParseCell: function(data) {
      if (data.row.index % 2 === 0 && data.section === 'body') {
        data.cell.styles.fillColor = [255, 255, 255];
      }
    },
  });
  
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generated on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`,
      105,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }
  
  const filename = `menu-${menu.fraternity.replace(/\s+/g, "-").toLowerCase()}-${format(parseISO(menu.weekOf), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}
