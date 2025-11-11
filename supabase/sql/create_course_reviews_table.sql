-- Tabela de avaliações de cursos
CREATE TABLE IF NOT EXISTS public.course_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garante que cada matrícula só pode ter uma avaliação
  UNIQUE(enrollment_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_course_reviews_course_id ON public.course_reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_user_id ON public.course_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_enrollment_id ON public.course_reviews(enrollment_id);

-- RLS Policies
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Avaliações são públicas para leitura" ON public.course_reviews;
DROP POLICY IF EXISTS "Usuários podem criar suas próprias avaliações" ON public.course_reviews;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias avaliações" ON public.course_reviews;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias avaliações" ON public.course_reviews;

-- Qualquer usuário autenticado pode ler avaliações
CREATE POLICY "Avaliações são públicas para leitura"
  ON public.course_reviews
  FOR SELECT
  TO authenticated
  USING (true);

-- Apenas o dono da avaliação pode criar/editar sua própria avaliação
CREATE POLICY "Usuários podem criar suas próprias avaliações"
  ON public.course_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias avaliações"
  ON public.course_reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias avaliações"
  ON public.course_reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.handle_review_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS set_course_reviews_updated_at ON public.course_reviews;

CREATE TRIGGER set_course_reviews_updated_at
  BEFORE UPDATE ON public.course_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_review_updated_at();

-- View para estatísticas de avaliações por curso
CREATE OR REPLACE VIEW public.course_review_stats AS
SELECT 
  course_id,
  COUNT(*) as total_reviews,
  ROUND(AVG(rating)::numeric, 1) as average_rating,
  COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
  COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star_count,
  COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star_count,
  COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star_count,
  COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_count
FROM public.course_reviews
GROUP BY course_id;

-- RLS para a view
ALTER VIEW public.course_review_stats SET (security_invoker = true);
