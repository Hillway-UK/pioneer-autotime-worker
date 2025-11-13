import { useState, useEffect } from "react";
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
import { getPdfUrl } from "@/lib/pdfUtils";
import RamsPdfViewer from "@/components/RamsPdfViewer";

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
  const [ramsPdfUrl, setRamsPdfUrl] = useState<string | null>(null);
  const [sitePdfUrl, setSitePdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);

  // Fetch PDF URLs when dialog opens
  useEffect(() => {
    if (open) {
      setPdfLoading(true);
      Promise.all([
        getPdfUrl(termsUrl),
        getPdfUrl(waiverUrl)
      ]).then(([ramsUrl, siteUrl]) => {
        setRamsPdfUrl(ramsUrl);
        setSitePdfUrl(siteUrl);
        setPdfLoading(false);
      });
    }
  }, [open, termsUrl, waiverUrl]);

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
      // Clean up object URLs
      if (ramsPdfUrl) URL.revokeObjectURL(ramsPdfUrl);
      if (sitePdfUrl) URL.revokeObjectURL(sitePdfUrl);
      setRamsPdfUrl(null);
      setSitePdfUrl(null);
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
                <RamsPdfViewer url={ramsPdfUrl} isLoading={pdfLoading} />
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
                <RamsPdfViewer url={sitePdfUrl} isLoading={pdfLoading} />
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
