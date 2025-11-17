import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AlertCircle } from "lucide-react";

// Configure PDF.js worker - use bundled worker from node_modules via Vite
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

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
        <p className="text-sm text-muted-foreground">Document is not available for this job site.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="border rounded-lg bg-destructive/10 p-6 text-center">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
        <p className="text-sm text-destructive">Failed to load document. Please try again.</p>
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
            <LoadingSpinner message="Loading Document..." />
          </div>
        }
      >
        {numPages &&
          Array.from(new Array(numPages), (_, index) => (
            <Page
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              className="mb-4"
              width={Math.min(window.innerWidth * 0.6, 800)}
            />
          ))}
      </Document>
    </div>
  );
}
