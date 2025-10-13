-- Make clock-photos bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'clock-photos';

-- Create RLS policies for clock-photos bucket
CREATE POLICY "Anyone can view clock photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'clock-photos');

CREATE POLICY "Workers can upload their own clock photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'clock-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);