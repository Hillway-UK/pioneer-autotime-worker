import React, { useState } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Download, FileSpreadsheet, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportTimesheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerName: string;
  workerId: string;
  onExport: (startDate: Date, endDate: Date) => Promise<any[]>;
  hourlyRate: number;
}

type RangeType = 'weekly' | 'monthly' | 'custom';
type ExportFormat = 'excel' | 'pdf';

export default function ExportTimesheetDialog({
  open,
  onOpenChange,
  workerName,
  workerId,
  onExport,
  hourlyRate
}: ExportTimesheetDialogProps) {
  const [rangeType, setRangeType] = useState<RangeType>('weekly');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const [exporting, setExporting] = useState(false);

  const getDateRange = (): { start: Date; end: Date } => {
    if (rangeType === 'weekly') {
      return {
        start: startOfWeek(referenceDate, { weekStartsOn: 1 }),
        end: endOfWeek(referenceDate, { weekStartsOn: 1 })
      };
    } else if (rangeType === 'monthly') {
      return {
        start: startOfMonth(referenceDate),
        end: endOfMonth(referenceDate)
      };
    } else {
      return {
        start: customStartDate || new Date(),
        end: customEndDate || new Date()
      };
    }
  };

  const formatDateRange = () => {
    const { start, end } = getDateRange();
    
    if (rangeType === 'weekly') {
      return `Week of ${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    } else if (rangeType === 'monthly') {
      return `${format(start, 'MMMM yyyy')} (Monthly Export)`;
    } else {
      return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
    }
  };

  const generateExcel = (entries: any[], dateRangeStr: string) => {
    const wb = XLSX.utils.book_new();
    
    // Prepare data rows
    const rows = [
      ['My Timesheet'],
      [],
      ['Name:', workerName],
      ['Date Range:', dateRangeStr],
      [],
      ['Job Site Code', 'Job Name', 'Clock In', 'Clock Out', 'Total Hours', 'Rate', 'Note']
    ];

    let totalHours = 0;
    let totalEarnings = 0;

    entries.forEach(entry => {
      const hours = entry.total_hours || 0;
      const earnings = hours * hourlyRate;
      totalHours += hours;
      totalEarnings += earnings;

      let note = '';
      if (entry.manual_entry) note = 'Manual Entry';
      if (entry.auto_clocked_out) note = note ? `${note}, Auto Clock-Out` : 'Auto Clock-Out';
      if (entry.notes) note = note ? `${note}, ${entry.notes}` : entry.notes;

      rows.push([
        entry.jobs?.code || '',
        entry.jobs?.name || 'Unknown Job',
        entry.clock_in ? format(new Date(entry.clock_in), 'h:mm a') : '',
        entry.clock_out ? format(new Date(entry.clock_out), 'h:mm a') : 'In Progress',
        hours.toFixed(2),
        `£${hourlyRate.toFixed(2)}`,
        note
      ]);
    });

    rows.push([]);
    rows.push(['', '', '', 'Total Hours:', totalHours.toFixed(2), '', '']);
    rows.push(['', '', '', 'Total Earnings:', `£${totalEarnings.toFixed(2)}`, '', '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 30 }
    ];

    // Add borders to all cells
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const borderStyle = {
      style: 'thin',
      color: { rgb: '000000' }
    };
    
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;
        
        if (!ws[cellAddress].s) ws[cellAddress].s = {};
        ws[cellAddress].s.border = {
          top: borderStyle,
          bottom: borderStyle,
          left: borderStyle,
          right: borderStyle
        };
        
        // Style header row (row 6, index 5)
        if (R === 5) {
          ws[cellAddress].s.font = { bold: true };
          ws[cellAddress].s.fill = { fgColor: { rgb: 'DDDDDD' } };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Timesheet');
    
    const { start, end } = getDateRange();
    const filename = `timesheet_${workerName.replace(/\s+/g, '_')}_${format(start, 'yyyy-MM-dd')}_to_${format(end, 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const generatePDF = (entries: any[], dateRangeStr: string) => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('My Timesheet', 14, 20);
    
    // Worker info
    doc.setFontSize(11);
    doc.text(`Name: ${workerName}`, 14, 30);
    doc.text(`Date Range: ${dateRangeStr}`, 14, 37);
    
    // Prepare table data
    const tableData = entries.map(entry => {
      const hours = entry.total_hours || 0;
      const earnings = hours * hourlyRate;

      let note = '';
      if (entry.manual_entry) note = 'Manual Entry';
      if (entry.auto_clocked_out) note = note ? `${note}, Auto Clock-Out` : 'Auto Clock-Out';
      if (entry.notes) note = note ? `${note}, ${entry.notes}` : entry.notes;

      return [
        entry.jobs?.code || '',
        entry.jobs?.name || 'Unknown Job',
        entry.clock_in ? format(new Date(entry.clock_in), 'h:mm a') : '',
        entry.clock_out ? format(new Date(entry.clock_out), 'h:mm a') : 'In Progress',
        hours.toFixed(2),
        `£${hourlyRate.toFixed(2)}`,
        note
      ];
    });

    let totalHours = 0;
    let totalEarnings = 0;
    entries.forEach(entry => {
      const hours = entry.total_hours || 0;
      totalHours += hours;
      totalEarnings += hours * hourlyRate;
    });

    autoTable(doc, {
      head: [['Job Site Code', 'Job Name', 'Clock In', 'Clock Out', 'Total Hours', 'Rate', 'Note']],
      body: tableData,
      startY: 45,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [128, 0, 0] }, // Maroon color
      foot: [
        ['', '', '', 'Total Hours:', totalHours.toFixed(2), '', ''],
        ['', '', '', 'Total Earnings:', `£${totalEarnings.toFixed(2)}`, '', '']
      ],
      footStyles: { 
        fillColor: [128, 0, 0], // Maroon background
        textColor: [255, 255, 255], // White text
        fontStyle: 'bold',
        fontSize: 10
      }
    });

    const { start, end } = getDateRange();
    const filename = `timesheet_${workerName.replace(/\s+/g, '_')}_${format(start, 'yyyy-MM-dd')}_to_${format(end, 'yyyy-MM-dd')}.pdf`;
    doc.save(filename);
  };

  const handleExport = async () => {
    if (rangeType === 'custom' && (!customStartDate || !customEndDate)) {
      return;
    }

    setExporting(true);
    try {
      const { start, end } = getDateRange();
      const entries = await onExport(start, end);
      
      if (entries.length === 0) {
        alert('No entries found for the selected date range.');
        setExporting(false);
        return;
      }

      const dateRangeStr = formatDateRange();

      if (exportFormat === 'excel') {
        generateExcel(entries, dateRangeStr);
      } else {
        generatePDF(entries, dateRangeStr);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export timesheet');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Timesheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Range Type Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Select range type:</Label>
            <RadioGroup value={rangeType} onValueChange={(v) => setRangeType(v as RangeType)}>
              <div className="flex items-center space-x-2 mb-2">
                <RadioGroupItem value="weekly" id="weekly" />
                <Label htmlFor="weekly" className="cursor-pointer font-normal">
                  🗓️ Weekly
                </Label>
              </div>
              <div className="flex items-center space-x-2 mb-2">
                <RadioGroupItem value="monthly" id="monthly" />
                <Label htmlFor="monthly" className="cursor-pointer font-normal">
                  📅 Monthly
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="cursor-pointer font-normal">
                  📆 Custom Range
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Date Selection based on Range Type */}
          {rangeType !== 'custom' ? (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Select {rangeType === 'weekly' ? 'week' : 'month'}:
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !referenceDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {referenceDate ? format(referenceDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={referenceDate}
                    onSelect={(date) => date && setReferenceDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium mb-2 block">Start Date:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "PPP") : <span>Pick start date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">End Date:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "PPP") : <span>Pick end date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Selected Range Display */}
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm font-medium text-muted-foreground">Selected Range:</p>
            <p className="text-sm font-semibold mt-1">{formatDateRange()}</p>
          </div>

          {/* Export Format Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Format:</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={exportFormat === 'excel' ? 'default' : 'outline'}
                onClick={() => setExportFormat('excel')}
                className="flex-1"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button
                type="button"
                variant={exportFormat === 'pdf' ? 'default' : 'outline'}
                onClick={() => setExportFormat('pdf')}
                className="flex-1"
              >
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>

          {/* Export Button */}
          <Button 
            onClick={handleExport} 
            disabled={exporting || (rangeType === 'custom' && (!customStartDate || !customEndDate))}
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? 'Generating...' : 'Generate Export'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
