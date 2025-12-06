// Types for the unified amendment request system

export type AmendmentRequestType = 'normal_shift' | 'overtime';
export type AmendmentRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// Payload for normal shift amendment
export interface ShiftAmendmentPayload {
  clock_in: string;  // ISO timestamp
  clock_out: string; // ISO timestamp
}

// Payload for overtime request
export interface OvertimeRequestPayload {
  hours: number;     // OT hours (0.5 increments, max 3)
  shift_date: string; // Date OT is being claimed for (yyyy-MM-dd)
}

export type AmendmentPayload = ShiftAmendmentPayload | OvertimeRequestPayload;

export interface AmendmentRequest {
  id: string;
  group_id: string;
  worker_id: string;
  clock_entry_id: string | null;
  type: AmendmentRequestType;
  status: AmendmentRequestStatus;
  payload: AmendmentPayload;
  reason: string;
  processed_by: string | null;
  processed_at: string | null;
  manager_notes: string | null;
  created_at: string;
  updated_at: string;
  created_clock_entry_id: string | null;
}

// Form state for the unified dialog
export interface UnifiedAmendmentFormState {
  requestShiftAmendment: boolean;
  requestOvertime: boolean;
  // Shift amendment fields
  shiftReason: string;
  newClockIn: string;
  newClockOut: string;
  // OT fields
  otHours: number;
  otReason: string;
}

// Helper type guards
export function isShiftAmendmentPayload(payload: AmendmentPayload): payload is ShiftAmendmentPayload {
  return 'clock_in' in payload && 'clock_out' in payload;
}

export function isOvertimeRequestPayload(payload: AmendmentPayload): payload is OvertimeRequestPayload {
  return 'hours' in payload && 'shift_date' in payload;
}
