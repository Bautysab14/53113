-- Crear tabla para las fotos de horror
CREATE TABLE IF NOT EXISTS horror_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear bucket para almacenar las imágenes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('horror-images', 'horror-images', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir que todos puedan ver las imágenes
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'horror-images');

-- Política para permitir que todos puedan subir imágenes
CREATE POLICY "Public Upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'horror-images');

-- Política para permitir que todos puedan eliminar imágenes
CREATE POLICY "Public Delete" ON storage.objects
FOR DELETE USING (bucket_id = 'horror-images');

-- Habilitar RLS en la tabla
ALTER TABLE horror_photos ENABLE ROW LEVEL SECURITY;

-- Política para permitir que todos puedan leer las fotos
CREATE POLICY "Anyone can view photos" ON horror_photos
FOR SELECT USING (true);

-- Política para permitir que todos puedan insertar fotos
CREATE POLICY "Anyone can insert photos" ON horror_photos
FOR INSERT WITH CHECK (true);

-- Política para permitir que todos puedan eliminar fotos
CREATE POLICY "Anyone can delete photos" ON horror_photos
FOR DELETE USING (true);
