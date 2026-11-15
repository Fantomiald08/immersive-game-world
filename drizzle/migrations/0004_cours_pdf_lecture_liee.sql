DROP POLICY IF EXISTS "cours pdf lecture" ON storage.objects;
CREATE POLICY "cours pdf lecture" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'cours-pdf' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.pdf_path = storage.objects.name)
  )
);