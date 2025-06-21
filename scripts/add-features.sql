-- Añadir columnas para likes y categorías
ALTER TABLE horror_photos 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Crear tabla para los likes de usuarios (usando session ID como identificador temporal)
CREATE TABLE IF NOT EXISTS photo_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID REFERENCES horror_photos(id) ON DELETE CASCADE,
  user_session TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(photo_id, user_session)
);

-- Crear tabla para comentarios
CREATE TABLE IF NOT EXISTS photo_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID REFERENCES horror_photos(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas para likes
ALTER TABLE photo_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes" ON photo_likes
FOR SELECT USING (true);

CREATE POLICY "Anyone can insert likes" ON photo_likes
FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can delete their likes" ON photo_likes
FOR DELETE USING (true);

-- Políticas para comentarios
ALTER TABLE photo_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments" ON photo_comments
FOR SELECT USING (true);

CREATE POLICY "Anyone can insert comments" ON photo_comments
FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can delete comments" ON photo_comments
FOR DELETE USING (true);

-- Función para actualizar contador de likes
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE horror_photos 
    SET likes_count = likes_count + 1 
    WHERE id = NEW.photo_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE horror_photos 
    SET likes_count = likes_count - 1 
    WHERE id = OLD.photo_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar contador automáticamente
DROP TRIGGER IF EXISTS likes_count_trigger ON photo_likes;
CREATE TRIGGER likes_count_trigger
  AFTER INSERT OR DELETE ON photo_likes
  FOR EACH ROW EXECUTE FUNCTION update_likes_count();
