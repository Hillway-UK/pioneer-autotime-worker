import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  AmendmentRequest,
  AmendmentRequestType,
  ShiftAmendmentPayload,
  OvertimeRequestPayload,
} from '@/types/amendment';

const UK_TIMEZONE = 'Europe/London';

interface SubmitAmendmentParams {
  workerId: string;
  clockEntryId: string;
  clockEntryClockOut: string;
  requestShiftAmendment: boolean;
  requestOvertime: boolean;
  // Shift fields
  shiftReason: string;
  newClockIn: string;
  newClockOut: string;
  // OT fields
  otHours: number;
  otReason: string;
}

interface UpdateAmendmentParams {
  requestId: string;
  workerId: string;
  type: AmendmentRequestType;
  // Shift fields (if type is normal_shift)
  shiftReason?: string;
  newClockIn?: string;
  newClockOut?: string;
  // OT fields (if type is overtime)
  otHours?: number;
  otReason?: string;
}

export function useAmendmentRequests() {
  const [loading, setLoading] = useState(false);
  const [amendmentRequests, setAmendmentRequests] = useState<AmendmentRequest[]>([]);

  // Fetch all amendment requests for the current worker
  const fetchAmendmentRequests = useCallback(async (workerId: string) => {
    try {
      // Use raw query since types may not be generated yet
      const { data, error } = await (supabase as any)
        .from('amendment_requests')
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false });

      if (error) {
        // Table might not exist yet
        console.warn('amendment_requests table may not exist:', error.message);
        return [];
      }
      
      // Parse the JSONB payload
      const parsedData = (data || []).map((item: any) => ({
        ...item,
        payload: typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload
      })) as AmendmentRequest[];
      
      setAmendmentRequests(parsedData);
      return parsedData;
    } catch (error) {
      console.error('Error fetching amendment requests:', error);
      return [];
    }
  }, []);

  // Get pending requests for a specific clock entry
  const getPendingRequestsForEntry = useCallback((clockEntryId: string) => {
    return amendmentRequests.filter(
      req => req.clock_entry_id === clockEntryId && req.status === 'pending'
    );
  }, [amendmentRequests]);

  // Get all requests for a specific clock entry
  const getRequestsForEntry = useCallback((clockEntryId: string) => {
    return amendmentRequests.filter(req => req.clock_entry_id === clockEntryId);
  }, [amendmentRequests]);

  // Submit new amendment request(s)
  const submitAmendmentRequest = useCallback(async (params: SubmitAmendmentParams) => {
    const {
      workerId,
      clockEntryId,
      clockEntryClockOut,
      requestShiftAmendment,
      requestOvertime,
      shiftReason,
      newClockIn,
      newClockOut,
      otHours,
      otReason,
    } = params;

    if (!requestShiftAmendment && !requestOvertime) {
      toast.error('Please select at least one request type');
      return false;
    }

    setLoading(true);

    try {
      // Generate a shared group_id for linked requests
      const groupId = crypto.randomUUID();
      const requests: any[] = [];

      // Build shift amendment request
      if (requestShiftAmendment) {
        if (!shiftReason.trim()) {
          toast.error('Please provide a reason for the shift amendment');
          setLoading(false);
          return false;
        }

        // Validate times
        const clockInDate = new Date(newClockIn);
        const clockOutDate = new Date(newClockOut);
        const clockInDay = format(clockInDate, 'yyyy-MM-dd');
        const clockOutDay = format(clockOutDate, 'yyyy-MM-dd');

        if (clockInDay !== clockOutDay) {
          toast.error('Clock in and clock out must be on the same day');
          setLoading(false);
          return false;
        }

        if (clockOutDate <= clockInDate) {
          toast.error('Clock out time must be after clock in time');
          setLoading(false);
          return false;
        }

        const payload: ShiftAmendmentPayload = {
          clock_in: formatInTimeZone(newClockIn, UK_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"),
          clock_out: formatInTimeZone(newClockOut, UK_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"),
        };

        requests.push({
          group_id: groupId,
          worker_id: workerId,
          clock_entry_id: clockEntryId,
          type: 'normal_shift' as AmendmentRequestType,
          status: 'pending',
          payload,
          reason: shiftReason.trim(),
        });
      }

      // Build overtime request
      if (requestOvertime) {
        if (!otReason.trim()) {
          toast.error('Please provide a reason for the overtime request');
          setLoading(false);
          return false;
        }

        if (otHours < 0.5 || otHours > 3) {
          toast.error('Overtime hours must be between 0.5 and 3');
          setLoading(false);
          return false;
        }

        const shiftDate = clockEntryClockOut 
          ? format(parseISO(clockEntryClockOut), 'yyyy-MM-dd')
          : format(new Date(), 'yyyy-MM-dd');

        const payload: OvertimeRequestPayload = {
          hours: otHours,
          shift_date: shiftDate,
        };

        requests.push({
          group_id: groupId,
          worker_id: workerId,
          clock_entry_id: clockEntryId,
          type: 'overtime' as AmendmentRequestType,
          status: 'pending',
          payload,
          reason: otReason.trim(),
        });
      }

      // Insert all requests
      const { error } = await (supabase as any)
        .from('amendment_requests')
        .insert(requests);

      if (error) throw error;

      const requestTypes = [];
      if (requestShiftAmendment) requestTypes.push('shift amendment');
      if (requestOvertime) requestTypes.push('overtime');
      
      toast.success(`${requestTypes.join(' and ')} request submitted for approval`);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Error submitting amendment request:', error);
      toast.error('Failed to submit request');
      setLoading(false);
      return false;
    }
  }, []);

  // Update an existing pending request
  const updateAmendmentRequest = useCallback(async (params: UpdateAmendmentParams) => {
    const { requestId, workerId, type, shiftReason, newClockIn, newClockOut, otHours, otReason } = params;

    setLoading(true);

    try {
      // Verify ownership and status
      const { data: existing, error: verifyError } = await (supabase as any)
        .from('amendment_requests')
        .select('worker_id, status, type, payload')
        .eq('id', requestId)
        .single();

      if (verifyError || !existing) {
        toast.error('Request not found');
        setLoading(false);
        return false;
      }

      if (existing.worker_id !== workerId) {
        toast.error('Unauthorized: This request does not belong to you');
        setLoading(false);
        return false;
      }

      if (existing.status !== 'pending') {
        toast.error('Cannot update: Request is not pending');
        setLoading(false);
        return false;
      }

      let payload: any;
      let reason: string;

      if (type === 'normal_shift') {
        if (!shiftReason?.trim()) {
          toast.error('Please provide a reason');
          setLoading(false);
          return false;
        }

        const clockInDate = new Date(newClockIn!);
        const clockOutDate = new Date(newClockOut!);

        if (format(clockInDate, 'yyyy-MM-dd') !== format(clockOutDate, 'yyyy-MM-dd')) {
          toast.error('Clock in and clock out must be on the same day');
          setLoading(false);
          return false;
        }

        if (clockOutDate <= clockInDate) {
          toast.error('Clock out time must be after clock in time');
          setLoading(false);
          return false;
        }

        payload = {
          clock_in: formatInTimeZone(newClockIn!, UK_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"),
          clock_out: formatInTimeZone(newClockOut!, UK_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"),
        };
        reason = shiftReason.trim();
      } else {
        if (!otReason?.trim()) {
          toast.error('Please provide a reason');
          setLoading(false);
          return false;
        }

        if (!otHours || otHours < 0.5 || otHours > 3) {
          toast.error('Overtime hours must be between 0.5 and 3');
          setLoading(false);
          return false;
        }

        // Keep the original shift_date from the existing request
        const existingPayload = typeof existing.payload === 'string' 
          ? JSON.parse(existing.payload) 
          : existing.payload;

        payload = {
          hours: otHours,
          shift_date: existingPayload?.shift_date || format(new Date(), 'yyyy-MM-dd'),
        };
        reason = otReason.trim();
      }

      const { error } = await (supabase as any)
        .from('amendment_requests')
        .update({ payload, reason })
        .eq('id', requestId)
        .eq('worker_id', workerId);

      if (error) throw error;

      toast.success('Request updated');
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Error updating amendment request:', error);
      toast.error('Failed to update request');
      setLoading(false);
      return false;
    }
  }, []);

  return {
    loading,
    amendmentRequests,
    fetchAmendmentRequests,
    getPendingRequestsForEntry,
    getRequestsForEntry,
    submitAmendmentRequest,
    updateAmendmentRequest,
  };
}
