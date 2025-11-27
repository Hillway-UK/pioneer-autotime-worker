import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, differenceInMinutes, parseISO, addDays } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const UK_TIMEZONE = 'Europe/London';
import { Calendar, Clock, Edit2, Plus, ChevronLeft, ChevronRight, AlertCircle, DollarSign, ArrowLeft, Construction, Save, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import OrganizationLogo from '@/components/OrganizationLogo';
import { useWorker } from '@/contexts/WorkerContext';
import ExportTimesheetDialog from '@/components/ExportTimesheetDialog';
import { formatOvertimeStatus, getOvertimeStatusColor } from '@/lib/overtimeUtils';

export default function Timesheets() {
  const navigate = useNavigate();
  const { worker: contextWorker, loading: workerLoading } = useWorker();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showAmendmentDialog, setShowAmendmentDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [amendmentReason, setAmendmentReason] = useState('');
  const [newClockIn, setNewClockIn] = useState('');
  const [newClockOut, setNewClockOut] = useState('');
  const [expenseTypes, setExpenseTypes] = useState<any[]>([]);
  const [selectedExpenses, setSelectedExpenses] = useState<{description: string, amount: number, expense_type_id?: string, isCustom?: boolean, calculation_type?: string}[]>([]);
  const [existingAmendments, setExistingAmendments] = useState<any[]>([]);
  const [savingExpenses, setSavingExpenses] = useState(false);
  const [workerHourlyRate, setWorkerHourlyRate] = useState<number>(0);
  const [organizationName, setOrganizationName] = useState<string>('');
  const [organizationLogoUrl, setOrganizationLogoUrl] = useState<string | null>(null);
  const [editingAmendmentId, setEditingAmendmentId] = useState<string | null>(null);
  
  // Manual entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    job_id: '',
    clock_in_time: '09:00',
    clock_out_time: '17:00',
    notes: ''
  });
  const [jobs, setJobs] = useState<any[]>([]);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [worker, setWorker] = useState<any>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Set worker data from context
  useEffect(() => {
    if (contextWorker) {
      setWorker(contextWorker);
      setWorkerHourlyRate(contextWorker.hourly_rate || 0);
      setOrganizationName(contextWorker.organizations?.name || '');
      setOrganizationLogoUrl(contextWorker.organizations?.logo_url || null);
    }
  }, [contextWorker]);

  // Fetch timesheet entries for current week
  const fetchEntries = async () => {
    if (!contextWorker) {
      setLoading(false);
      return;
    }

    try {
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

      console.log('Fetching entries for worker:', contextWorker.id, 'week:', weekStart, 'to', weekEnd);

      const { data, error } = await supabase
        .from('clock_entries')
        .select(`
          *,
          jobs (name, code),
          additional_costs (amount, description)
        `)
        .eq('worker_id', contextWorker.id)
        .gte('clock_in', weekStart.toISOString())
        .lte('clock_in', weekEnd.toISOString())
        .order('clock_in', { ascending: false });

      if (error) {
        console.error('Error fetching entries:', error);
        toast.error('Failed to load timesheet entries');
      } else {
        console.log('Found entries:', data?.length || 0);
        setEntries(data || []);
      }
    } catch (error) {
      console.error('Error in fetchEntries:', error);
      toast.error('Failed to load timesheet data');
    }
    setLoading(false);
  };

  // Fetch existing amendments
  const fetchAmendments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // First get worker profile by email
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (workerError || !workerData) return;

      const { data } = await supabase
        .from('time_amendments')
        .select('*')
        .eq('worker_id', workerData.id);

      if (data) {
        setExistingAmendments(data);
      }
    } catch (error) {
      console.error('Error fetching amendments:', error);
    }
  };

  // Fetch expense types
  const fetchExpenseTypes = async () => {
    const { data } = await supabase
      .from('expense_types')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (data) {
      setExpenseTypes(data);
    }
  };

  // Fetch worker data
  const fetchWorker = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('email', user.email)
        .single();

      if (error) throw error;
      setWorker(data);
    } catch (error) {
      console.error('Error fetching worker:', error);
    }
  };

  // Fetch jobs for manual entry
  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  useEffect(() => {
    fetchWorker();
    fetchJobs();
    fetchEntries();
    fetchAmendments();
    fetchExpenseTypes();
  }, [currentWeek]);

  // Group entries by day
  const entriesByDay = entries.reduce((acc, entry) => {
    const day = format(parseISO(entry.clock_in), 'yyyy-MM-dd');
    if (!acc[day]) acc[day] = [];
    acc[day].push(entry);
    return acc;
  }, {} as Record<string, any[]>);

  // Calculate daily and weekly totals
  const calculateHours = (clockIn: string, clockOut: string | null, totalHours?: number | null) => {
    // Use stored total_hours if available (important for OT entries with limits)
    if (totalHours !== null && totalHours !== undefined) {
      return totalHours;
    }
    if (!clockOut) return 0;
    return differenceInMinutes(parseISO(clockOut), parseISO(clockIn)) / 60;
  };

  const weeklyTotal = entries.reduce((total, entry) => {
    // Exclude pending/rejected OT from total
    if (entry.is_overtime && entry.ot_status !== 'approved') {
      return total;
    }
    return total + calculateHours(entry.clock_in, entry.clock_out, entry.total_hours);
  }, 0);

  // Calculate pay totals
  const calculateWeeklyHoursPay = () => weeklyTotal * workerHourlyRate;
  
  const calculateWeeklyExpenses = () => {
    return entries.reduce((total, entry) => {
      if (entry.additional_costs && Array.isArray(entry.additional_costs)) {
        return total + entry.additional_costs.reduce((sum: number, cost: any) => 
          sum + parseFloat(cost.amount), 0);
      }
      return total;
    }, 0);
  };

  const calculateWeeklyTotalPay = () => calculateWeeklyHoursPay() + calculateWeeklyExpenses();

  const calculateDayHours = (dayEntries: any[]) => {
    return dayEntries.reduce((total, entry) => 
      total + calculateHours(entry.clock_in, entry.clock_out, entry.total_hours), 0);
  };

  const calculateDayHoursPay = (dayEntries: any[]) => {
    return calculateDayHours(dayEntries) * workerHourlyRate;
  };

  const calculateDayExpenses = (dayEntries: any[]) => {
    return dayEntries.reduce((total, entry) => {
      if (entry.additional_costs && Array.isArray(entry.additional_costs)) {
        return total + entry.additional_costs.reduce((sum: number, cost: any) => 
          sum + parseFloat(cost.amount), 0);
      }
      return total;
    }, 0);
  };

  const calculateDayTotalPay = (dayEntries: any[]) => {
    return calculateDayHoursPay(dayEntries) + calculateDayExpenses(dayEntries);
  };

  // Submit amendment request
  const handleAmendmentSubmit = async () => {
    if (!selectedEntry || !amendmentReason) {
      toast.error('Please provide a reason for the amendment');
      return;
    }

    // Validate that clock out is after clock in
    if (newClockIn && newClockOut) {
      const clockInDate = new Date(newClockIn);
      const clockOutDate = new Date(newClockOut);
      
      // Check if dates are the same day
      const clockInDay = format(clockInDate, 'yyyy-MM-dd');
      const clockOutDay = format(clockOutDate, 'yyyy-MM-dd');
      
      if (clockInDay !== clockOutDay) {
        toast.error('Invalid date: Clock in and clock out must be on the same day. Please ensure both times are on the same date.');
        return;
      }
      
      // Check if clock out is after clock in
      if (clockOutDate <= clockInDate) {
        toast.error('Invalid hours: New clock out time must be greater than new clock in time. Please select a later clock out time.');
        return;
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Get worker ID by email
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (workerError || !workerData) {
        toast.error('Worker profile not found');
        return;
      }
      
      // Convert datetime-local input (UK time) to proper ISO timestamp
      let requestedClockIn = selectedEntry.clock_in;
      let requestedClockOut = selectedEntry.clock_out;
      
      if (newClockIn) {
        requestedClockIn = formatInTimeZone(
          newClockIn,
          UK_TIMEZONE,
          "yyyy-MM-dd'T'HH:mm:ssXXX"
        );
      }
      
      if (newClockOut) {
        requestedClockOut = formatInTimeZone(
          newClockOut,
          UK_TIMEZONE,
          "yyyy-MM-dd'T'HH:mm:ssXXX"
        );
      }
      
      // Check if we're updating an existing pending amendment
      if (editingAmendmentId) {
        // SECURITY: Verify the amendment belongs to this worker before updating
        const { data: existingAmendment, error: verifyError } = await supabase
          .from('time_amendments')
          .select('worker_id, status')
          .eq('id', editingAmendmentId)
          .single();
        
        if (verifyError || !existingAmendment) {
          toast.error('Amendment not found');
          return;
        }
        
        if (existingAmendment.worker_id !== workerData.id) {
          toast.error('Unauthorized: This amendment does not belong to you');
          console.error('Authorization violation: Worker attempted to update another worker\'s amendment');
          return;
        }
        
        if (existingAmendment.status !== 'pending') {
          toast.error('Cannot update amendment: Status is not pending');
          return;
        }
        
        // Now update with both id AND worker_id for defense-in-depth
        const { error } = await supabase
          .from('time_amendments')
          .update({
            requested_clock_in: requestedClockIn,
            requested_clock_out: requestedClockOut,
            reason: amendmentReason
          })
          .eq('id', editingAmendmentId)
          .eq('worker_id', workerData.id);
      
        if (error) {
          toast.error('Failed to update amendment');
        } else {
          toast.success('Amendment request updated');
          setShowAmendmentDialog(false);
          setAmendmentReason('');
          setNewClockIn('');
          setNewClockOut('');
          setEditingAmendmentId(null);
          fetchAmendments();
        }
      } else {
        // Insert new amendment
        const { error } = await supabase
          .from('time_amendments')
          .insert({
            worker_id: workerData.id,
            clock_entry_id: selectedEntry.id,
            requested_clock_in: requestedClockIn,
            requested_clock_out: requestedClockOut,
            reason: amendmentReason,
            status: 'pending'
          });
      
        if (error) {
          toast.error('Failed to submit amendment');
        } else {
          toast.success('Amendment request submitted for approval');
          setShowAmendmentDialog(false);
          setAmendmentReason('');
          setNewClockIn('');
          setNewClockOut('');
          fetchAmendments();
        }
      }
    } catch (error) {
      console.error('Error submitting amendment:', error);
      toast.error('Failed to submit amendment');
    }
  };

  // Add expenses to past entry
  const handleExpenseSubmit = async () => {
    if (selectedExpenses.length === 0) {
      setShowExpenseDialog(false);
      return;
    }

    setSavingExpenses(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Get worker ID by email  
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (workerError || !workerData) {
        toast.error('Worker profile not found');
        setSavingExpenses(false);
        return;
      }

      let successCount = 0;

      for (const expense of selectedExpenses) {
        // Improved validation
        const trimmedDescription = expense.description?.trim();
        const numericAmount = typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount;
        
        if (!trimmedDescription || trimmedDescription === '') {
          console.error('Expense missing description:', expense);
          continue; // Skip this expense
        }
        
        if (!numericAmount || numericAmount <= 0) {
          console.error('Expense missing or invalid amount:', expense);
          continue; // Skip this expense
        }
        
        console.log('Inserting expense:', {
          worker_id: workerData.id,
          clock_entry_id: selectedEntry.id,
          date: format(parseISO(selectedEntry.clock_in), 'yyyy-MM-dd'),
          description: trimmedDescription,
          amount: numericAmount,
          cost_type: 'other',
          expense_type_id: expense.expense_type_id || null
        });
        
        const { error } = await supabase
          .from('additional_costs')
          .insert({
            worker_id: workerData.id,
            clock_entry_id: selectedEntry.id,
            date: format(parseISO(selectedEntry.clock_in), 'yyyy-MM-dd'),
            description: trimmedDescription,
            amount: numericAmount,
            cost_type: 'other',
            expense_type_id: expense.expense_type_id || null
          });

        if (error) {
          console.error('❌ Supabase insert error:', error);
          toast.error(`Failed to add expense: ${error.message}`);
        } else {
          console.log('✅ Expense inserted successfully');
          successCount++;
        }
      }

      setSavingExpenses(false);
      toast.success(`${successCount} expense(s) added`);
      setShowExpenseDialog(false);
      setSelectedExpenses([]);
      fetchEntries();
    } catch (error) {
      console.error('Error adding expenses:', error);
      toast.error('Failed to add expenses');
      setSavingExpenses(false);
    }
  };

  // Check if amendment exists for entry
  const hasAmendment = (entryId: string) => {
    return existingAmendments.some(a => a.clock_entry_id === entryId);
  };

  const getAmendmentStatus = (entryId: string) => {
    const amendment = existingAmendments.find(a => a.clock_entry_id === entryId);
    return amendment?.status;
  };

  // Submit manual entry
  const submitManualEntry = async () => {
    if (!manualEntry.job_id) {
      toast.error('Please select a job site');
      return;
    }

    if (!worker?.id) {
      toast.error('Worker profile not found');
      return;
    }

    setSubmittingManual(true);
    try {
      // Combine date and time for timestamps
      const clockInDateTime = new Date(`${manualEntry.date}T${manualEntry.clock_in_time}:00`);
      const clockOutDateTime = new Date(`${manualEntry.date}T${manualEntry.clock_out_time}:00`);

      // Validate times
      if (clockOutDateTime <= clockInDateTime) {
        toast.error('Clock out time must be after clock in time');
        setSubmittingManual(false);
        return;
      }

      // Check for existing entries on this date
      const { data: existingEntries, error: checkError } = await supabase
        .from('clock_entries')
        .select('*')
        .eq('worker_id', worker.id)
        .gte('clock_in', `${manualEntry.date}T00:00:00`)
        .lte('clock_in', `${manualEntry.date}T23:59:59`);

      if (checkError) throw checkError;

      if (existingEntries && existingEntries.length > 0) {
        toast.error('You already have an entry for this date');
        setSubmittingManual(false);
        return;
      }

      // Calculate total hours
      const totalHours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);

      // Create the manual entry
      const { error } = await supabase
        .from('clock_entries')
        .insert({
          worker_id: worker.id,
          job_id: manualEntry.job_id,
          clock_in: clockInDateTime.toISOString(),
          clock_out: clockOutDateTime.toISOString(),
          total_hours: Math.round(totalHours * 100) / 100,
          manual_entry: true,
          notes: manualEntry.notes || `Manual entry added on ${format(new Date(), 'dd/MM/yyyy')}`
        });

      if (error) throw error;

      toast.success('Manual entry added successfully');
      setShowManualEntry(false);
      setManualEntry({
        date: format(new Date(), 'yyyy-MM-dd'),
        job_id: '',
        clock_in_time: '09:00',
        clock_out_time: '17:00',
        notes: ''
      });
      fetchEntries(); // Refresh the timesheet
    } catch (error: any) {
      console.error('Error adding manual entry:', error);
      toast.error(error.message || 'Failed to add manual entry');
    } finally {
      setSubmittingManual(false);
    }
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  const groupEntriesByDay = () => entriesByDay;
  const calculateWeeklyHours = () => weeklyTotal.toFixed(2);
  const getAmendmentForEntry = (entryId: string) => existingAmendments.find(a => a.clock_entry_id === entryId);
  const getPendingAmendmentForEntry = (entryId: string) => 
    existingAmendments.find(a => a.clock_entry_id === entryId && a.status === 'pending');
  const calculateEntryHours = (entry: any) => calculateHours(entry.clock_in, entry.clock_out, entry.total_hours).toFixed(2);
  const calculateEntryPay = (entry: any) => (calculateHours(entry.clock_in, entry.clock_out, entry.total_hours) * workerHourlyRate).toFixed(2);
  const changeWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(addDays(currentWeek, direction === 'prev' ? -7 : 7));
  };
  // Dialog helper functions
  const openAmendmentDialog = (entry: any) => {
    setSelectedEntry(entry);
    
    // Check if there's a pending amendment for this entry
    const pendingAmendment = getPendingAmendmentForEntry(entry.id);
    
    if (pendingAmendment) {
      // Pre-fill with existing pending amendment data
      setEditingAmendmentId(pendingAmendment.id);
      setAmendmentReason(pendingAmendment.reason);
      
      if (pendingAmendment.requested_clock_in) {
        const ukClockIn = toZonedTime(pendingAmendment.requested_clock_in, UK_TIMEZONE);
        setNewClockIn(format(ukClockIn, "yyyy-MM-dd'T'HH:mm"));
      }
      
      if (pendingAmendment.requested_clock_out) {
        const ukClockOut = toZonedTime(pendingAmendment.requested_clock_out, UK_TIMEZONE);
        setNewClockOut(format(ukClockOut, "yyyy-MM-dd'T'HH:mm"));
      }
    } else {
      // New amendment - use original entry times
      setEditingAmendmentId(null);
      setAmendmentReason('');
      
      if (entry.clock_in) {
        const ukClockIn = toZonedTime(entry.clock_in, UK_TIMEZONE);
        setNewClockIn(format(ukClockIn, "yyyy-MM-dd'T'HH:mm"));
      }
      
      if (entry.clock_out) {
        const ukClockOut = toZonedTime(entry.clock_out, UK_TIMEZONE);
        setNewClockOut(format(ukClockOut, "yyyy-MM-dd'T'HH:mm"));
      }
    }
    
    setShowAmendmentDialog(true);
  };
  
  const openExpenseDialog = (entry: any) => {
    setSelectedEntry(entry);
    setShowExpenseDialog(true);
  };

  // Add expense functions
  const addExpense = () => {
    setSelectedExpenses([...selectedExpenses, { description: '', amount: 0, isCustom: false }]);
  };

  const updateExpense = (index: number, field: string, value: any) => {
    const updated = [...selectedExpenses];
    
    // If changing expense type selection
    if (field === 'expense_type_id') {
      if (value === 'custom') {
        // Switch to custom mode
        updated[index] = { ...updated[index], isCustom: true, expense_type_id: undefined, description: '', amount: 0 };
      } else {
        // Pre-fill from expense type
        const expenseType = expenseTypes.find(et => et.id === value);
        if (expenseType) {
          let finalAmount = parseFloat(expenseType.amount);
          
          // Calculate amount based on calculation_type
          if (expenseType.calculation_type === 'hourly_multiplied' && selectedEntry) {
            const entryHours = calculateHours(selectedEntry.clock_in, selectedEntry.clock_out, selectedEntry.total_hours);
            finalAmount = expenseType.amount * entryHours;
          }
          
          updated[index] = { 
            ...updated[index], 
            isCustom: false, 
            expense_type_id: value, 
            description: expenseType.name,
            amount: finalAmount,
            calculation_type: expenseType.calculation_type
          };
        }
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    
    setSelectedExpenses(updated);
  };

  const removeExpense = (index: number) => {
    setSelectedExpenses(selectedExpenses.filter((_, i) => i !== index));
  };

  // Amendment submission (alias for existing function)
  const submitAmendment = handleAmendmentSubmit;

  // Export function to fetch entries for a date range
  const fetchEntriesForExport = async (startDate: Date, endDate: Date) => {
    if (!contextWorker) return [];

    try {
      const { data, error } = await supabase
        .from('clock_entries')
        .select(`
          *,
          jobs (name, code),
          additional_costs (
            amount, 
            description,
            expense_types (name)
          )
        `)
        .eq('worker_id', contextWorker.id)
        .gte('clock_in', startDate.toISOString())
        .lte('clock_in', endDate.toISOString())
        .order('clock_in', { ascending: true });

      if (error) throw error;
      
      // Filter out pending and rejected OT entries
      const filteredData = (data || []).filter((entry: any) => {
        // Include if it's not an OT entry
        if (!entry.is_overtime) return true;
        
        // For OT entries, only include if status is 'approved'
        return entry.ot_status === 'approved';
      });
      
      return filteredData;
    } catch (error) {
      console.error('Error fetching entries for export:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary shadow-lg sticky top-0 z-50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <OrganizationLogo 
                organizationLogoUrl={organizationLogoUrl}
                size="medium" 
                showText={false} 
              />
              <div>
                <h1 className="text-xl font-bold text-primary-foreground">AutoTime</h1>
                <p className="text-sm text-primary-foreground/80">Timesheets</p>
              </div>
            </div>
            
            <button
              onClick={() => navigate('/clock')}
              className="h-9 w-9 flex items-center justify-center text-primary-foreground hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-white border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => changeWeek('prev')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <div className="text-center">
              <p className="font-semibold text-gray-900">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </p>
              <p className="text-sm text-gray-500">
                Total: {calculateWeeklyHours()} hours | £{calculateWeeklyTotalPay().toFixed(2)}
              </p>
            </div>
            
            <button
              onClick={() => changeWeek('next')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          
          {/* Export Button */}
          <div className="flex justify-center mt-2">
            <Button
              onClick={() => setShowExportDialog(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export Timesheet
            </Button>
          </div>
        </div>
      </div>

      {/* Timesheet Entries */}
      <div className="p-4">
        {loading ? (
          <div className="animate-pulse">Loading timesheets...</div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No timesheet entries for this week</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Group entries by day */}
            {Object.entries(groupEntriesByDay()).map(([date, dayEntries]) => (
              <div key={date} className="bg-white rounded-xl shadow-sm">
                <div className="px-4 py-3 border-b bg-gray-50 rounded-t-xl">
                  <p className="font-semibold text-gray-900">
                    {format(new Date(date), 'EEEE, MMM d')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {calculateDayHours(dayEntries as any[]).toFixed(2)} hours | £{calculateDayTotalPay(dayEntries as any[]).toFixed(2)}
                  </p>
                </div>
                
                <div className="divide-y">
                  {(dayEntries as any[]).map((entry: any) => (
                    <div key={entry.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">
                              {entry.jobs?.name || 'Unknown Job'}
                            </p>
                            {entry.is_overtime && (
                              <Badge 
                                variant="secondary" 
                                className={getOvertimeStatusColor(entry.ot_status)}
                              >
                                OT: {formatOvertimeStatus(entry.ot_status)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {format(new Date(entry.clock_in), 'h:mm a')} - 
                            {entry.clock_out 
                              ? format(new Date(entry.clock_out), 'h:mm a')
                              : 'In Progress'}
                          </p>
                          {entry.auto_clocked_out && entry.auto_clockout_reason && (
                            <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {entry.auto_clockout_reason}
                            </p>
                          )}
                          {entry.additional_costs?.length > 0 && (
                            <p className="text-sm text-gray-500 mt-1">
                              Expenses: £{entry.additional_costs.reduce((sum: number, cost: any) => 
                                sum + (cost.amount || 0), 0).toFixed(2)}
                            </p>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <p className="font-medium text-gray-900">
                            {calculateEntryHours(entry)} hrs
                          </p>
                          <p className="text-sm text-gray-600">
                            £{calculateEntryPay(entry)}
                          </p>
                          
                          {/* Amendment Status Badge */}
                          {getAmendmentForEntry(entry.id) && (
                            <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${
                              getAmendmentForEntry(entry.id)?.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : getAmendmentForEntry(entry.id)?.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {getAmendmentForEntry(entry.id)?.status}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Rejection Reason for OT */}
                      {entry.is_overtime && entry.ot_status === 'rejected' && entry.ot_rejection_reason && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                          <strong>Rejection reason:</strong> {entry.ot_rejection_reason}
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div className="mt-3 flex space-x-2">
                        {entry.clock_out && !(entry.is_overtime && entry.ot_status === 'rejected') && (() => {
                          const pendingAmendment = getPendingAmendmentForEntry(entry.id);
                          const amendment = getAmendmentForEntry(entry.id);
                          
                          // Show "Update Amendment" if there's a pending amendment
                          if (pendingAmendment) {
                            return (
                              <button
                                onClick={() => openAmendmentDialog(entry)}
                                className="text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded-lg text-blue-700"
                              >
                                Update Pending Amendment
                              </button>
                            );
                          }
                          
                          // Show "Request Amendment" if no amendment or if last was approved/rejected
                          if (!amendment || amendment.status === 'approved' || amendment.status === 'rejected') {
                            return (
                              <button
                                onClick={() => openAmendmentDialog(entry)}
                                className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                              >
                                Request Amendment
                              </button>
                            );
                          }
                          
                          return null;
                        })()}
                        
                        {!entry.additional_costs?.length && entry.clock_out && !(entry.is_overtime && entry.ot_status === 'rejected') && (
                          <button
                            onClick={() => openExpenseDialog(entry)}
                            className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                          >
                            Add Expense
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Amendment Dialog */}
      <Dialog open={showAmendmentDialog} onOpenChange={setShowAmendmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAmendmentId ? 'Update Pending Amendment' : 'Request Amendment'}
            </DialogTitle>
          </DialogHeader>
          {editingAmendmentId && (
            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm">
              You're updating your pending amendment request
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason for Amendment</label>
              <textarea
                value={amendmentReason}
                onChange={(e) => setAmendmentReason(e.target.value)}
                className="w-full p-2 border rounded-lg mt-1"
                rows={3}
                placeholder="Please explain why you need to amend this entry..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">New Clock In Time (UK Time)</label>
                <p className="text-xs text-muted-foreground mt-1">
                  Note: Cannot select future dates. Both times must be on the same day.
                </p>
                <input
                  type="datetime-local"
                  value={newClockIn}
                  onChange={(e) => setNewClockIn(e.target.value)}
                  max={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                  className="w-full p-2 border rounded-lg mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">New Clock Out Time (UK Time)</label>
                <p className="text-xs text-muted-foreground mt-1">
                  Clock out time must be greater than clock in time on the same day.
                </p>
                <input
                  type="datetime-local"
                  value={newClockOut}
                  onChange={(e) => setNewClockOut(e.target.value)}
                  max={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                  className="w-full p-2 border rounded-lg mt-1"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              All times are in UK timezone (Europe/London)
            </p>
            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setShowAmendmentDialog(false)}
                className="flex-1 px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submitAmendment}
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                {editingAmendmentId ? 'Update Request' : 'Submit Request'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Expenses</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedExpenses.map((expense, index) => (
              <div key={index} className="space-y-2 p-3 border rounded-lg bg-gray-50">
                <div className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    {/* Expense Type Selector */}
                    <div>
                      <Label className="text-sm font-medium">Expense Type</Label>
                      <Select
                        value={expense.isCustom ? 'custom' : (expense.expense_type_id || '')}
                        onValueChange={(value) => updateExpense(index, 'expense_type_id', value)}
                      >
                        <SelectTrigger className="w-full mt-1 bg-white">
                          <SelectValue placeholder="Select expense type..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-[100]">
                          {expenseTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name} (£{parseFloat(type.amount).toFixed(2)} {type.calculation_type === 'hourly_multiplied' ? '- per hour' : '- flat rate'})
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">Custom (Other)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Description Input (shown only when custom is selected) */}
                    {expense.isCustom && (
                      <div>
                        <Label className="text-sm font-medium">Description</Label>
                        <Input
                          type="text"
                          value={expense.description}
                          onChange={(e) => updateExpense(index, 'description', e.target.value)}
                          className="w-full mt-1"
                          placeholder="Enter custom expense description..."
                        />
                      </div>
                    )}

                    {/* Amount Input */}
                    <div>
                      <Label className="text-sm font-medium">
                        Amount (£)
                        {!expense.isCustom && expense.calculation_type === 'hourly_multiplied' && selectedEntry && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (£{expenseTypes.find(et => et.id === expense.expense_type_id)?.amount || 0}/hr × {calculateHours(selectedEntry.clock_in, selectedEntry.clock_out, selectedEntry.total_hours).toFixed(2)} hrs)
                          </span>
                        )}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={expense.amount || 0}
                        onChange={(e) => updateExpense(index, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full mt-1"
                        placeholder="0.00"
                        readOnly={!expense.isCustom && expense.calculation_type === 'hourly_multiplied'}
                        disabled={!expense.isCustom && expense.calculation_type === 'hourly_multiplied'}
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removeExpense(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg mt-6"
                    title="Remove expense"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            
            <button
              onClick={addExpense}
              className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              + Add Another Expense
            </button>
            
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => {
                  setShowExpenseDialog(false);
                  setSelectedExpenses([]);
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExpenseSubmit}
                disabled={savingExpenses || selectedExpenses.length === 0}
                className="flex-1"
              >
                {savingExpenses ? 'Saving...' : 'Save Expenses'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Timesheet Dialog */}
      <ExportTimesheetDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        workerName={
          worker?.first_name && worker?.last_name 
            ? `${worker.first_name} ${worker.last_name}` 
            : worker?.name || worker?.email?.split('@')[0] || 'Worker'
        }
        workerId={worker?.id || ''}
        onExport={fetchEntriesForExport}
        hourlyRate={workerHourlyRate}
      />
    </div>
  );
}