import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Clock, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAmendmentRequests } from '@/hooks/useAmendmentRequests';
import {
  AmendmentRequest,
  isShiftAmendmentPayload,
  isOvertimeRequestPayload,
} from '@/types/amendment';

const UK_TIMEZONE = 'Europe/London';

// OT hours options (0.5 increments up to 3 hours)
const OT_HOURS_OPTIONS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

interface UnifiedAmendmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: any; // The clock entry
  workerId: string;
  pendingRequests: AmendmentRequest[];
  onSuccess: () => void;
}

export default function UnifiedAmendmentDialog({
  open,
  onOpenChange,
  entry,
  workerId,
  pendingRequests,
  onSuccess,
}: UnifiedAmendmentDialogProps) {
  const { loading, submitAmendmentRequest, updateAmendmentRequest } = useAmendmentRequests();

  // Determine if we're editing existing requests
  const pendingShiftRequest = pendingRequests.find(r => r.type === 'normal_shift');
  const pendingOtRequest = pendingRequests.find(r => r.type === 'overtime');
  const isEditing = pendingShiftRequest || pendingOtRequest;

  // Form state
  const [requestShiftAmendment, setRequestShiftAmendment] = useState(false);
  const [requestOvertime, setRequestOvertime] = useState(false);
  
  // Shift amendment fields
  const [shiftReason, setShiftReason] = useState('');
  const [newClockIn, setNewClockIn] = useState('');
  const [newClockOut, setNewClockOut] = useState('');
  
  // OT fields
  const [otHours, setOtHours] = useState<number>(1.0);
  const [otReason, setOtReason] = useState('');

  // Initialize form when dialog opens
  useEffect(() => {
    if (open && entry) {
      // Check for pending requests to pre-fill
      if (pendingShiftRequest) {
        setRequestShiftAmendment(true);
        setShiftReason(pendingShiftRequest.reason);
        
        if (isShiftAmendmentPayload(pendingShiftRequest.payload)) {
          const ukClockIn = toZonedTime(pendingShiftRequest.payload.clock_in, UK_TIMEZONE);
          const ukClockOut = toZonedTime(pendingShiftRequest.payload.clock_out, UK_TIMEZONE);
          setNewClockIn(format(ukClockIn, "yyyy-MM-dd'T'HH:mm"));
          setNewClockOut(format(ukClockOut, "yyyy-MM-dd'T'HH:mm"));
        }
      } else {
        setRequestShiftAmendment(false);
        setShiftReason('');
        // Set default times from entry
        if (entry.clock_in) {
          const ukClockIn = toZonedTime(entry.clock_in, UK_TIMEZONE);
          setNewClockIn(format(ukClockIn, "yyyy-MM-dd'T'HH:mm"));
        }
        if (entry.clock_out) {
          const ukClockOut = toZonedTime(entry.clock_out, UK_TIMEZONE);
          setNewClockOut(format(ukClockOut, "yyyy-MM-dd'T'HH:mm"));
        }
      }

      if (pendingOtRequest) {
        setRequestOvertime(true);
        setOtReason(pendingOtRequest.reason);
        
        if (isOvertimeRequestPayload(pendingOtRequest.payload)) {
          setOtHours(pendingOtRequest.payload.hours);
        }
      } else {
        setRequestOvertime(false);
        setOtReason('');
        setOtHours(1.0);
      }
    }
  }, [open, entry, pendingShiftRequest, pendingOtRequest]);

  const handleSubmit = async () => {
    if (!requestShiftAmendment && !requestOvertime) {
      return;
    }

    // If editing, update individual requests
    if (isEditing) {
      let success = true;

      // Update shift amendment if checked and has pending request
      if (requestShiftAmendment && pendingShiftRequest) {
        success = await updateAmendmentRequest({
          requestId: pendingShiftRequest.id,
          workerId,
          type: 'normal_shift',
          shiftReason,
          newClockIn,
          newClockOut,
        });
        if (!success) return;
      }

      // Update OT request if checked and has pending request
      if (requestOvertime && pendingOtRequest) {
        success = await updateAmendmentRequest({
          requestId: pendingOtRequest.id,
          workerId,
          type: 'overtime',
          otHours,
          otReason,
        });
        if (!success) return;
      }

      // Handle case where user is adding a NEW request type to an existing group
      if (requestShiftAmendment && !pendingShiftRequest) {
        // Submit new shift amendment with existing group_id
        success = await submitAmendmentRequest({
          workerId,
          clockEntryId: entry.id,
          clockEntryClockOut: entry.clock_out,
          requestShiftAmendment: true,
          requestOvertime: false,
          shiftReason,
          newClockIn,
          newClockOut,
          otHours: 0,
          otReason: '',
        });
        if (!success) return;
      }

      if (requestOvertime && !pendingOtRequest) {
        // Submit new OT request
        success = await submitAmendmentRequest({
          workerId,
          clockEntryId: entry.id,
          clockEntryClockOut: entry.clock_out,
          requestShiftAmendment: false,
          requestOvertime: true,
          shiftReason: '',
          newClockIn: '',
          newClockOut: '',
          otHours,
          otReason,
        });
        if (!success) return;
      }

      if (success) {
        onOpenChange(false);
        onSuccess();
      }
    } else {
      // New submission
      const success = await submitAmendmentRequest({
        workerId,
        clockEntryId: entry.id,
        clockEntryClockOut: entry.clock_out,
        requestShiftAmendment,
        requestOvertime,
        shiftReason,
        newClockIn,
        newClockOut,
        otHours,
        otReason,
      });

      if (success) {
        onOpenChange(false);
        onSuccess();
      }
    }
  };

  const hasAnySelection = requestShiftAmendment || requestOvertime;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {isEditing ? 'Update Request' : 'Request Amendment / Overtime'}
          </DialogTitle>
        </DialogHeader>

        {isEditing && (
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm">
            You're updating your pending request(s)
          </div>
        )}

        <div className="space-y-6">
          {/* Request Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">
              What are you requesting?
            </Label>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="shift-amendment"
                  checked={requestShiftAmendment}
                  onCheckedChange={(checked) => setRequestShiftAmendment(checked === true)}
                />
                <Label 
                  htmlFor="shift-amendment" 
                  className="text-sm font-medium cursor-pointer"
                >
                  Normal Shift Amendment
                </Label>
                {pendingShiftRequest && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                    Pending
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="overtime-request"
                  checked={requestOvertime}
                  onCheckedChange={(checked) => setRequestOvertime(checked === true)}
                />
                <Label 
                  htmlFor="overtime-request" 
                  className="text-sm font-medium cursor-pointer"
                >
                  Overtime Request
                </Label>
                {pendingOtRequest && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                    Pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Shift Amendment Fields */}
          {requestShiftAmendment && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-sm">Shift Amendment Details</h4>
              
              <div>
                <Label className="text-sm font-medium">Reason for Amendment</Label>
                <textarea
                  value={shiftReason}
                  onChange={(e) => setShiftReason(e.target.value)}
                  className="w-full p-2 border rounded-lg mt-1 text-sm"
                  rows={2}
                  placeholder="Please explain why you need to amend this entry..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">New Clock In (UK)</Label>
                  <input
                    type="datetime-local"
                    value={newClockIn}
                    onChange={(e) => setNewClockIn(e.target.value)}
                    max={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                    className="w-full p-2 border rounded-lg mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">New Clock Out (UK)</Label>
                  <input
                    type="datetime-local"
                    value={newClockOut}
                    onChange={(e) => setNewClockOut(e.target.value)}
                    max={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                    className="w-full p-2 border rounded-lg mt-1 text-sm"
                  />
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Both times must be on the same day. Clock out must be after clock in.
              </p>
            </div>
          )}

          {/* Overtime Request Fields */}
          {requestOvertime && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-sm">Overtime Request Details</h4>
              
              <div>
                <Label className="text-sm font-medium">Hours of Overtime Worked</Label>
                <Select
                  value={otHours.toString()}
                  onValueChange={(value) => setOtHours(parseFloat(value))}
                >
                  <SelectTrigger className="w-full mt-1 bg-background">
                    <SelectValue placeholder="Select hours..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {OT_HOURS_OPTIONS.map((hours) => (
                      <SelectItem key={hours} value={hours.toString()}>
                        {hours} hour{hours !== 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Reason for Overtime</Label>
                <textarea
                  value={otReason}
                  onChange={(e) => setOtReason(e.target.value)}
                  className="w-full p-2 border rounded-lg mt-1 text-sm"
                  rows={2}
                  placeholder="Please explain why overtime was needed..."
                />
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  This overtime will be linked to your shift on{' '}
                  {entry?.clock_out 
                    ? format(parseISO(entry.clock_out), 'MMM d, yyyy')
                    : 'this date'
                  }. Maximum 3 hours per request.
                </span>
              </div>
            </div>
          )}

          {/* Validation Message */}
          {!hasAnySelection && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              Please select at least one request type
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !hasAnySelection}
              className="flex-1"
            >
              {loading ? 'Submitting...' : isEditing ? 'Update Request' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
