import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface InvoiceData {
  id: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  serviceName: string;
  amount: number;
  status: string;
  createdAt: string;
  orderNumber?: string;
}

export const generateInvoicePDF = (data: InvoiceData) => {
  try {
    const doc = new jsPDF();
    const primaryColor = [110, 167, 234]; // Noya Blue
    const darkColor = [6, 8, 13]; // Noya Black
    const accentColor = [43, 198, 115]; // Noya Green
    
    // --- Header Design ---
    doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.rect(0, 0, 210, 60, 'F');
    
    // Logo Simulation (Premium Stylized)
    doc.setFontSize(26);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('NOYA', 15, 25);
    doc.setTextColor(255, 255, 255);
    doc.text('INDUSTRIES', 45, 25);
    
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(1.5);
    doc.line(15, 30, 95, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(141, 152, 170);
    doc.setFont('helvetica', 'normal');
    doc.text('INFINITE CORE — ECOSYSTÈME DE GESTION ERP', 15, 40);
    doc.text('Abidjan, Côte d\'Ivoire • Plateaux, Rue des Banques', 15, 45);
    doc.text('contact@noya-industries.com • www.noya-industries.com', 15, 50);

    // --- Invoice Info Block (Right Side) ---
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURE', 140, 25);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`REF: ${data.id.substring(0, 12).toUpperCase()}`, 140, 32);
    
    doc.setTextColor(255, 255, 255);
    doc.text(`Date : ${format(new Date(data.createdAt), 'dd MMMM yyyy', { locale: fr })}`, 140, 42);
    doc.text(`Statut : ${data.status.toUpperCase()}`, 140, 47);
    
    // --- Client Details ---
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DESTINATAIRE', 15, 75);
    
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.line(15, 78, 100, 78);
    
    doc.setFontSize(11);
    doc.text(data.clientName || 'Client Particulier', 15, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(data.clientEmail || '', 15, 90);
    doc.text(data.clientPhone || '', 15, 94);
    if (data.clientAddress) {
      doc.text(data.clientAddress, 15, 98);
    } else {
      doc.text('Abidjan, CI', 15, 98);
    }

    // --- Billing Details Table ---
    autoTable(doc, {
      startY: 110,
      head: [['Désignation', 'Quantité', 'Prix Unitaire', 'TVA', 'Total (FCFA)']],
      body: [
        [
          data.serviceName,
          '1',
          `${data.amount.toLocaleString()} FCFA`,
          '0%',
          `${data.amount.toLocaleString()} FCFA`
        ]
      ],
      headStyles: { 
        fillColor: [6, 8, 13], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'center' },
        4: { halign: 'right', fontStyle: 'bold' }
      },
      styles: { 
        fontSize: 9, 
        cellPadding: 5,
        font: 'helvetica'
      },
      alternateRowStyles: { fillColor: [250, 252, 255] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;

    // --- Summary Section ---
    doc.setFillColor(250, 250, 250);
    doc.rect(120, finalY, 75, 40, 'F');
    doc.setDrawColor(230, 230, 230);
    doc.rect(120, finalY, 75, 40, 'D');

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Sous-total :', 125, finalY + 10);
    doc.text(`${data.amount.toLocaleString()} FCFA`, 190, finalY + 10, { align: 'right' });
    
    doc.text('TVA (0%) :', 125, finalY + 18);
    doc.text('0 FCFA', 190, finalY + 18, { align: 'right' });
    
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.line(125, finalY + 22, 190, finalY + 22);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('TOTAL NET :', 125, finalY + 32);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${data.amount.toLocaleString()} FCFA`, 190, finalY + 32, { align: 'right' });

    // --- Footer & Legal ---
    const pageHeight = doc.internal.pageSize.height;
    
    // Watermark if paid
    if (data.status.toLowerCase() === 'validé' || data.status.toLowerCase() === 'payé') {
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
      doc.setFontSize(60);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text('PAYÉ', 105, pageHeight / 2, { align: 'center', angle: 45 });
      doc.restoreGraphicsState();
    }

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'italic');
    doc.text('Noya Industries SARL — Capital Social 1.000.000 FCFA', 105, pageHeight - 15, { align: 'center' });
    doc.text('RCCM: CI-ABJ-03-202X-B12-XXXXX • CC: XXXXXXX X', 105, pageHeight - 10, { align: 'center' });
    doc.text('Régime d\'Imposition : Réel Simplifié', 105, pageHeight - 5, { align: 'center' });

    doc.save(`Facture_NOYA_${data.id.substring(0, 8)}.pdf`);
    return true;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return false;
  }
};
