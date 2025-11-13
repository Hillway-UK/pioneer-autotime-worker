import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AlertCircle } from "lucide-react";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface RamsPdfViewerProps {
  url: string | null;
  isLoading?: boolean;
}

export default function RamsPdfViewer({ url, isLoading = false }: RamsPdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-background p-6">
        <LoadingSpinner message="Loading document..." />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="border rounded-lg bg-muted/30 p-6 text-center">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Document is not available for this job site.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="border rounded-lg bg-destructive/10 p-6 text-center">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
        <p className="text-sm text-destructive">
          Failed to load document. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-background p-3 max-h-[400px] overflow-y-auto">
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
          setLoadError(false);
        }}
        onLoadError={(error) => {
          console.error("PDF load error:", error);
          setLoadError(true);
        }}
        loading={
          <div className="p-6">
            <LoadingSpinner message="Rendering PDF..." />
          </div>
        }
      >
        {numPages &&
          Array.from(new Array(numPages), (_, index) => (
            <Page
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              renderAnnotationLayer={true}
              renderTextLayer={true}
              className="mb-4"
              width={Math.min(window.innerWidth * 0.6, 800)}
            />
          ))}
      </Document>
    </div>
  );
}
