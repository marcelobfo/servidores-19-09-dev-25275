import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { CourseReviewInsert, CourseReviewUpdate } from "@/types/course-reviews";

const reviewSchema = z.object({
  rating: z.number().min(1, "Selecione uma avaliação").max(5),
  comment: z.string().max(500, "Comentário deve ter no máximo 500 caracteres").optional(),
});

interface CourseReviewFormProps {
  enrollmentId: string;
  courseId: string;
  existingReview?: {
    id: string;
    rating: number;
    comment: string | null;
  } | null;
  onSuccess?: () => void;
}

export function CourseReviewForm({ 
  enrollmentId, 
  courseId, 
  existingReview,
  onSuccess 
}: CourseReviewFormProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment || "");
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setComment(existingReview.comment || "");
    }
  }, [existingReview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("Você precisa estar autenticado para avaliar");
      return;
    }

    // Validação com Zod
    try {
      reviewSchema.parse({ rating, comment: comment || undefined });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setLoading(true);
    try {
      if (existingReview) {
        // Atualizar avaliação existente
        const updateData: CourseReviewUpdate = {
          rating,
          comment: comment || null,
        };
        
        const { error } = await (supabase as any)
          .from('course_reviews')
          .update(updateData)
          .eq('id', existingReview.id);

        if (error) throw error;
        toast.success("Avaliação atualizada com sucesso!");
        setIsEditing(false);
      } else {
        // Criar nova avaliação
        const insertData: CourseReviewInsert = {
          course_id: courseId,
          enrollment_id: enrollmentId,
          user_id: user.id,
          rating,
          comment: comment || null,
        };
        
        const { error } = await (supabase as any)
          .from('course_reviews')
          .insert(insertData);

        if (error) throw error;
        toast.success("Avaliação enviada com sucesso!");
      }
      
      onSuccess?.();
    } catch (error: any) {
      console.error("Error submitting review:", error);
      toast.error(error.message || "Erro ao enviar avaliação");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingReview) return;
    
    if (!confirm("Tem certeza que deseja excluir sua avaliação?")) return;

    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('course_reviews')
        .delete()
        .eq('id', existingReview.id);

      if (error) throw error;
      
      toast.success("Avaliação excluída com sucesso!");
      setRating(0);
      setComment("");
      onSuccess?.();
    } catch (error: any) {
      console.error("Error deleting review:", error);
      toast.error("Erro ao excluir avaliação");
    } finally {
      setLoading(false);
    }
  };

  // Se existe avaliação e não está editando, mostrar apenas botões de ação
  if (existingReview && !isEditing) {
    return (
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Sua avaliação</p>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    className={`h-5 w-5 ${
                      star <= existingReview.rating 
                        ? "fill-yellow-400 text-yellow-400" 
                        : "text-muted-foreground"
                    }`} 
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {existingReview.rating} estrela{existingReview.rating !== 1 ? 's' : ''}
              </span>
            </div>
            {existingReview.comment && (
              <p className="text-sm text-muted-foreground mt-2">{existingReview.comment}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsEditing(true)} 
            variant="outline" 
            size="sm"
          >
            Editar
          </Button>
          <Button 
            onClick={handleDelete} 
            variant="destructive" 
            size="sm"
            disabled={loading}
          >
            Excluir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-foreground mb-2 block">
          Como foi sua experiência com este curso? *
        </Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded"
            >
              <Star 
                className={`h-8 w-8 transition-colors ${
                  star <= (hoverRating || rating) 
                    ? "fill-yellow-400 text-yellow-400" 
                    : "text-muted-foreground"
                }`} 
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            {rating} estrela{rating !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="comment" className="text-sm font-medium text-foreground mb-2 block">
          Comentário (opcional)
        </Label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Conte-nos mais sobre sua experiência..."
          maxLength={500}
          rows={4}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {comment.length}/500
        </p>
      </div>

      <div className="flex gap-2">
        <Button 
          type="submit" 
          disabled={loading || rating === 0}
          className="flex-1"
        >
          {loading ? "Enviando..." : existingReview ? "Atualizar Avaliação" : "Enviar Avaliação"}
        </Button>
        {existingReview && isEditing && (
          <Button 
            type="button" 
            variant="outline"
            onClick={() => {
              setIsEditing(false);
              setRating(existingReview.rating);
              setComment(existingReview.comment || "");
            }}
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
