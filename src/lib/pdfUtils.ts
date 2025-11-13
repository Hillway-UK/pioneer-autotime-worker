import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches a PDF from Supabase Storage and returns an object URL
 * @param fileName - The filename stored in the database (e.g., "1763043008888_0emei.pdf")
 * @returns Object URL for the PDF blob, or null if fetch fails
 */
export async function getPdfUrl(fileName: string | null | undefined): Promise<string | null> {
  try {
    if (!fileName) return null;

    // Remove any URL prefix if present, we only need the filename
    let cleanFileName = fileName;
    if (fileName.includes('/job-documents/')) {
      cleanFileName = fileName.split('/job-documents/').pop() || fileName;
    }

    const { data, error } = await supabase
      .storage
      .from("job-documents")
      .download(cleanFileName);

    if (error) {
      console.error("PDF download error:", error);
      return null;
    }

    return URL.createObjectURL(data);
  } catch (err) {
    console.error("PDF fetch failed:", err);
    return null;
  }
}
