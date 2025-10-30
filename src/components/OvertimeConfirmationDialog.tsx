import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface OvertimeConfirmationDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function OvertimeConfirmationDialog({ 
  open, 
  onConfirm, 
  onCancel 
}: OvertimeConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Overtime Request
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You're clocking in after your shift ended.
          </p>
          <p className="text-sm font-semibold">
            Do you want to log this as overtime?
          </p>
          <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <span>Maximum 3 hours of overtime per shift</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <span>Overtime hours require manager approval</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <span>You'll be auto clocked-out if you leave the site</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 dark:text-blue-400">•</span>
                <span>For more than 3 hours, submit a Time Amendment</span>
              </li>
            </ul>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onConfirm} className="bg-orange-600 hover:bg-orange-700">
              Yes, Request Overtime
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
