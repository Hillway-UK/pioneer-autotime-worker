import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { NotificationService } from '@/services/notifications';
import { mergeOvertimeHours } from '@/lib/overtimeUtils';

interface OvertimeEntry {
  id: string;
  worker_id: string;
  job_id: string;
  clock_in: string;
  clock_out: string | null;
  total_hours: number | null;
  ot_status: string;
  ot_requested_at: string;
  auto_clocked_out: boolean;
  auto_clockout_reason: string | null;
  workers: {
    first_name: string;
    last_name: string;
    email: string;
  };
  jobs: {
    name: string;
    code: string;
  };
}

export default function PendingOvertimeRequests() {
  const [overtimeEntries, setOvertimeEntries] = useState<OvertimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<OvertimeEntry | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [managerId, setManagerId] = useState<string | null>(null);

  useEffect(() => {
    fetchManagerId();
    fetchOvertimeEntries();
  }, []);

  const fetchManagerId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data } = await supabase
        .from('managers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (data) {
        setManagerId(data.id);
      }
    } catch (error) {
      console.error('Error fetching manager ID:', error);
    }
  };

  const fetchOvertimeEntries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setLoading(false);
        return;
      }

      // Get manager's organization
      const { data: managerData } = await supabase
        .from('managers')
        .select('organization_id')
        .eq('email', user.email)
        .single();

      if (!managerData) {
        setLoading(false);
        return;
      }

      // Fetch all OT entries for workers in the same organization
      const { data, error } = await supabase
        .from('clock_entries')
        .select(`
          *,
          workers!inner(first_name, last_name, email, organization_id),
          jobs(name, code)
        `)
        .eq('is_overtime', true)
        .eq('workers.organization_id', managerData.organization_id)
        .order('ot_requested_at', { ascending: false });

      if (error) {
        console.error('Error fetching OT entries:', error);
        toast.error('Failed to load overtime requests');
      } else {
        setOvertimeEntries(data || []);
      }
    } catch (error) {
      console.error('Error in fetchOvertimeEntries:', error);
      toast.error('Failed to load overtime data');
    }
    setLoading(false);
  };

  const handleApprove = async (entry: OvertimeEntry) => {
    if (!managerId) {
      toast.error('Manager ID not found');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('clock_entries')
        .update({
          ot_status: 'approved',
          ot_approved_by: managerId,
          ot_approved_at: new Date().toISOString(),
        })
        .eq('id', entry.id);

      if (error) {
        console.error('Error approving OT:', error);
        toast.error('Failed to approve overtime');
        return;
      }

      // Send notification
      const date = format(parseISO(entry.clock_in), 'MMM dd, yyyy');
      const hours = entry.total_hours?.toFixed(2) || '0';
      
      await NotificationService.sendDualNotification(
        entry.worker_id,
        'Overtime Approved',
        `Your OT for ${date} (${hours} hours) has been approved.`,
        'overtime_approved',
        `ot_approved_${entry.id}`
      );

      // Merge hours if OT is completed
      if (entry.clock_out && entry.total_hours) {
        await mergeOvertimeHours(entry.id);
      }

      toast.success('Overtime approved');
      fetchOvertimeEntries();
    } catch (error) {
      console.error('Error approving overtime:', error);
      toast.error('Failed to approve overtime');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectClick = (entry: OvertimeEntry) => {
    setSelectedEntry(entry);
    setShowRejectDialog(true);
    setRejectionReason('');
  };

  const handleRejectConfirm = async () => {
    if (!selectedEntry || !managerId) return;

    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('clock_entries')
        .update({
          ot_status: 'rejected',
          ot_rejection_reason: rejectionReason,
          ot_approved_by: managerId,
          ot_approved_at: new Date().toISOString(),
        })
        .eq('id', selectedEntry.id);

      if (error) {
        console.error('Error rejecting OT:', error);
        toast.error('Failed to reject overtime');
        return;
      }

      // Send notification
      await NotificationService.sendDualNotification(
        selectedEntry.worker_id,
        'Overtime Rejected',
        `Your OT request was rejected. Reason: ${rejectionReason}`,
        'overtime_rejected',
        `ot_rejected_${selectedEntry.id}`
      );

      toast.success('Overtime rejected');
      setShowRejectDialog(false);
      setSelectedEntry(null);
      setRejectionReason('');
      fetchOvertimeEntries();
    } catch (error) {
      console.error('Error rejecting overtime:', error);
      toast.error('Failed to reject overtime');
    } finally {
      setProcessing(false);
    }
  };

  const calculateHours = (clockIn: string, clockOut: string | null): string => {
    if (!clockOut) return 'In Progress';
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    const hours = diff / (1000 * 60 * 60);
    return hours.toFixed(2);
  };

  const pendingEntries = overtimeEntries.filter(e => e.ot_status === 'pending');
  const reviewedEntries = overtimeEntries.filter(e => e.ot_status !== 'pending');

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading overtime requests...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Pending Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Overtime Requests ({pendingEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No pending overtime requests
              </p>
            ) : (
              <div className="space-y-4">
                {pendingEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="border rounded-lg p-4 space-y-3 bg-card"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-semibold">
                          {entry.workers.first_name} {entry.workers.last_name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {entry.jobs.name} ({entry.jobs.code})
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(entry.clock_in), 'MMM dd, yyyy • h:mm a')}
                          {entry.clock_out && ` - ${format(parseISO(entry.clock_out), 'h:mm a')}`}
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                        Pending
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{calculateHours(entry.clock_in, entry.clock_out)} hours</span>
                      </div>
                      {entry.auto_clocked_out && (
                        <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-xs">Auto-clocked out</span>
                        </div>
                      )}
                    </div>

                    {entry.auto_clockout_reason && (
                      <p className="text-xs text-muted-foreground bg-orange-50 dark:bg-orange-950/30 p-2 rounded">
                        {entry.auto_clockout_reason}
                      </p>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(entry)}
                        disabled={processing}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRejectClick(entry)}
                        disabled={processing}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reviewed Requests */}
        {reviewedEntries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Reviewed Overtime ({reviewedEntries.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reviewedEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="border rounded-lg p-3 space-y-2 bg-card opacity-75"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">
                          {entry.workers.first_name} {entry.workers.last_name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {entry.jobs.name} • {format(parseISO(entry.clock_in), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          entry.ot_status === 'approved'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }
                      >
                        {entry.ot_status === 'approved' ? 'Approved' : 'Rejected'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {calculateHours(entry.clock_in, entry.clock_out)} hours
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Overtime Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason for rejection *</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this overtime request..."
                rows={4}
                className="mt-2"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectConfirm}
                disabled={processing || !rejectionReason.trim()}
              >
                Reject Overtime
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
