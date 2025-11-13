import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a job document filename to a full Supabase Storage URL
 * @param fileName - Either a filename (e.g., "1763043008888_0emei.pdf") or full URL
 * @returns Full public storage URL or null if fileName is empty
 */
export function buildJobDocumentUrl(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  
  // If it's already a full URL, return as-is
  if (fileName.startsWith('http://') || fileName.startsWith('https://')) {
    return fileName;
  }
  
  // Convert filename to full Supabase Storage URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/job-documents/${fileName}`;
}
