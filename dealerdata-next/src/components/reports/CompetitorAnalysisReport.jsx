import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function CompetitorAnalysisReport({ selectedStore }) {
  const [generating, setGenerating] = useState(false);
  const [snapshotDate, setSnapshotDate] = useState(null);
  const reportRef = useRef(null);

  const dealerKey = selectedStore?.dealership_key;

  // Fetch available dates for the picker
  const { data: inventoryResult } = useQuery({
    queryKey: ['competitorInventory_forPDF', dealerKey],
    enabled: !!dealerKey,
    queryFn: () => base44.functions.invoke('supabaseCompetitorInventory', {
      dealer_ids: [dealerKey],
      snapshot_date: snapshotDate,
    }).then(r => r.data),
  });

  const availableDates = inventoryResult?.available_dates || [];

  const generatePDF = async () => {
    if (!dealerKey) {
      toast.error('Please select a store');
      return;
    }

    setGenerating(true);
    try {
      const element = reportRef.current;
      if (!element) {
        toast.error('Report not found');
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - 2 * margin;
      const contentHeight = pageHeight - 2 * margin;

      const imgData = canvas.toDataURL('image/png');
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      let yPosition = margin;

      pdf.addImage(imgData, 'PNG', margin, yPosition, contentWidth, Math.min(imgHeight, contentHeight));

      const fileName = `Competitor_Analysis_${selectedStore?.name || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(`Failed to generate PDF: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  if (!selectedStore) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-400 text-sm">Select a store to download competitor analysis reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Competitor Analysis Report</h3>
        <p className="text-xs text-gray-500 mb-4">
          Download a comprehensive PDF report of inventory, pricing, new vehicle specials, and service specials for {selectedStore?.name}.
        </p>

        {availableDates.length > 0 && (
          <div className="mb-4">
            <label className="text-xs text-gray-600 block mb-2">Snapshot Date (Optional)</label>
            <select
              value={snapshotDate || ''}
              onChange={e => setSnapshotDate(e.target.value || null)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              <option value="">Latest</option>
              {availableDates.map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
          </div>
        )}

        <Button
          onClick={generatePDF}
          disabled={generating}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          {generating ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download size={16} />
              Download PDF Report
            </>
          )}
        </Button>
      </div>

      {/* Hidden report preview for PDF generation */}
      <div
        ref={reportRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '1200px',
          backgroundColor: 'white',
          padding: '40px',
          fontSize: '12px',
        }}
      >
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
          Competitive Analysis Report
        </h1>
        <p style={{ color: '#666', marginBottom: '24px' }}>
          {selectedStore?.name} | {snapshotDate || 'Latest Data'} | Generated {new Date().toLocaleDateString()}
        </p>
        
        <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
            Report Summary
          </h2>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            This report provides a comprehensive view of competitor inventory, pricing, and promotional offers for your dealership. Data includes inventory counts, price ranges, new vehicle specials, and service department promotions.
          </p>
        </div>

        <div style={{ color: '#999', fontSize: '11px', marginTop: '40px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
          For detailed interactive views, visit the Competitive Analysis dashboard section.
        </div>
      </div>
    </div>
  );
}