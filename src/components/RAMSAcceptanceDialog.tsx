import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, FileText, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RAMSAcceptanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  jobName: string;
  termsUrl: string | null;
  waiverUrl: string | null;
  loading?: boolean;
}

export default function RAMSAcceptanceDialog({
  open,
  onOpenChange,
  onAccept,
  jobName,
  termsUrl,
  waiverUrl,
  loading = false,
}: RAMSAcceptanceDialogProps) {
  const [openedSections, setOpenedSections] = useState<{
    rams: boolean;
    site: boolean;
  }>({ rams: false, site: false });
  const [confirmed, setConfirmed] = useState(false);

  // Track which accordions have been opened
  const handleAccordionChange = (value: string) => {
    if (value === "rams") {
      setOpenedSections((prev) => ({ ...prev, rams: true }));
    } else if (value === "site") {
      setOpenedSections((prev) => ({ ...prev, site: true }));
    }
  };

  // Check if both sections have been viewed
  const bothSectionsViewed = openedSections.rams && openedSections.site;

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setOpenedSections({ rams: false, site: false });
      setConfirmed(false);
    }
    onOpenChange(newOpen);
  };

  const handleAccept = () => {
    if (confirmed && bothSectionsViewed) {
      onAccept();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            RAMS and Site Information
          </DialogTitle>
          <DialogDescription>
            Please review the site's safety documents before starting work at{" "}
            <span className="font-medium text-foreground">{jobName}</span>
          </DialogDescription>
        </DialogHeader>

        <Alert className="my-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You must open and review both sections before proceeding.
          </AlertDescription>
        </Alert>

        <div className="flex-1 overflow-y-auto pr-2">
          <Accordion
            type="single"
            collapsible
            className="w-full"
            onValueChange={handleAccordionChange}
          >
            {/* RAMS Section */}
            <AccordionItem value="rams">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Risk Assessment & Method Statement (RAMS)</span>
                  {openedSections.rams && (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      ✓ Viewed
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="border rounded-md bg-muted/30 p-4">
                  {termsUrl ? (
                    <iframe
                      src={termsUrl}
                      className="w-full h-[400px] rounded border-0"
                      title="RAMS Document"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                      <Info className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-center">
                        RAMS document is not available for this job site.
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Site Information Section */}
            <AccordionItem value="site">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  <span>Site Information</span>
                  {openedSections.site && (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      ✓ Viewed
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="border rounded-md bg-muted/30 p-4">
                  {waiverUrl ? (
                    <iframe
                      src={waiverUrl}
                      className="w-full h-[400px] rounded border-0"
                      title="Site Information Document"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                      <Info className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-center">
                        Site Information document is not available for this job site.
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="flex items-start space-x-2 pt-4 border-t">
          <Checkbox
            id="rams-confirmation"
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(checked === true)}
            disabled={!bothSectionsViewed}
          />
          <label
            htmlFor="rams-confirmation"
            className={`text-sm leading-relaxed cursor-pointer ${
              !bothSectionsViewed ? "text-muted-foreground" : ""
            }`}
          >
            I have read and understood the RAMS and Site Information documents.
            {!bothSectionsViewed && (
              <span className="block text-xs text-muted-foreground mt-1">
                Please open both sections above to enable this checkbox.
              </span>
            )}
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!confirmed || !bothSectionsViewed || loading}
          >
            {loading ? "Processing..." : "Accept and Clock In"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
