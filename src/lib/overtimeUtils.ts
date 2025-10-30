import { supabase } from '@/integrations/supabase/client';

export async function mergeOvertimeHours(otEntryId: string): Promise<boolean> {
  try {
    // Get OT entry details
    const { data: otEntry, error: otError }: any = await (supabase as any)
      .from('clock_entries')
      .select('*')
      .eq('id', otEntryId)
      .single();

    if (otError || !otEntry) {
      console.error('Error fetching OT entry:', otError);
      return false;
    }

    // Only merge if approved, completed, and has a linked shift
    if (
      otEntry.ot_status !== 'approved' ||
      !otEntry.clock_out ||
      !otEntry.linked_shift_id ||
      !otEntry.total_hours
    ) {
      console.log('OT not ready for merge:', {
        approved: otEntry.ot_status === 'approved',
        hasClockOut: !!otEntry.clock_out,
        hasLinkedShift: !!otEntry.linked_shift_id,
        hasTotalHours: !!otEntry.total_hours
      });
      return false;
    }

    // Get main shift
    const { data: mainShift, error: shiftError } = await (supabase as any)
      .from('clock_entries')
      .select('total_hours')
      .eq('id', otEntry.linked_shift_id)
      .single();

    if (shiftError || !mainShift) {
      console.error('Error fetching main shift:', shiftError);
      return false;
    }

    // Calculate merged hours
    const newTotalHours = (mainShift.total_hours || 0) + otEntry.total_hours;

    // Update main shift with merged hours
    const { error: updateError } = await (supabase as any)
      .from('clock_entries')
      .update({ total_hours: newTotalHours } as any)
      .eq('id', otEntry.linked_shift_id);

    if (updateError) {
      console.error('Error updating main shift hours:', updateError);
      return false;
    }

    console.log(`Merged OT hours: ${otEntry.total_hours} added to shift ${otEntry.linked_shift_id}. New total: ${newTotalHours}`);
    return true;
  } catch (error) {
    console.error('Error in mergeOvertimeHours:', error);
    return false;
  }
}

export function calculateOvertimeHours(clockIn: string, clockOut: string): number {
  const clockInTime = new Date(clockIn);
  const clockOutTime = new Date(clockOut);
  const diffMs = clockOutTime.getTime() - clockInTime.getTime();
  return diffMs / (1000 * 60 * 60); // Convert to hours
}

export function isWithinOvertimeLimit(hours: number): boolean {
  return hours <= 3;
}

export function formatOvertimeStatus(status: string | null): string {
  switch (status) {
    case 'pending':
      return 'Pending Approval';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Unknown';
  }
}

export function getOvertimeStatusColor(status: string | null): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}
