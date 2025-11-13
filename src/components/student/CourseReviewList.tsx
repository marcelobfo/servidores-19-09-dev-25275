import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Star, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CourseReviewWithProfile } from "@/types/course-reviews";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: {
    full_name: string;
  } | null;
}

interface CourseReviewListProps {
  courseId: string;
}

const REVIEWS_PER_PAGE = 10;

export function CourseReviewList({ courseId }: CourseReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);

  useEffect(() => {
    fetchReviews();
  }, [courseId, filterRating, sortBy, currentPage]);

  const fetchReviews = async () => {
    try {
      setLoading(true);

      // Query base
      let query = (supabase as any)
        .from('course_reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          profiles!user_id (
            full_name
          )
        `, { count: 'exact' })
        .eq('course_id', courseId);

      // Filtro de rating
      if (filterRating !== "all") {
        query = query.eq('rating', parseInt(filterRating));
      }

      // Ordenação
      switch (sortBy) {
        case "oldest":
          query = query.order('created_at', { ascending: true });
          break;
        case "highest":
          query = query.order('rating', { ascending: false });
          break;
        case "lowest":
          query = query.order('rating', { ascending: true });
          break;
        default: // newest
          query = query.order('created_at', { ascending: false });
      }

      // Paginação
      const from = (currentPage - 1) * REVIEWS_PER_PAGE;
      const to = from + REVIEWS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setReviews((data || []) as Review[]);
      setTotalReviews(count || 0);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalReviews / REVIEWS_PER_PAGE);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  if (loading && currentPage === 1) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Select value={filterRating} onValueChange={(value) => {
            setFilterRating(value);
            setCurrentPage(1);
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por estrelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as avaliações</SelectItem>
              <SelectItem value="5">⭐⭐⭐⭐⭐ 5 estrelas</SelectItem>
              <SelectItem value="4">⭐⭐⭐⭐ 4 estrelas</SelectItem>
              <SelectItem value="3">⭐⭐⭐ 3 estrelas</SelectItem>
              <SelectItem value="2">⭐⭐ 2 estrelas</SelectItem>
              <SelectItem value="1">⭐ 1 estrela</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex-1">
          <Select value={sortBy} onValueChange={(value) => {
            setSortBy(value);
            setCurrentPage(1);
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigas</SelectItem>
              <SelectItem value="highest">Maior nota</SelectItem>
              <SelectItem value="lowest">Menor nota</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de avaliações */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhuma avaliação encontrada
            </h3>
            <p className="text-muted-foreground text-center">
              {filterRating !== "all" 
                ? "Tente ajustar os filtros para ver mais avaliações."
                : "Seja o primeiro a avaliar este curso!"
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(review.profiles?.full_name || "Usuário")}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground">
                            {review.profiles?.full_name || "Usuário"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(review.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                        
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star} 
                              className={`h-4 w-4 ${
                                star <= review.rating 
                                  ? "fill-yellow-400 text-yellow-400" 
                                  : "text-muted-foreground"
                              }`} 
                            />
                          ))}
                        </div>
                      </div>
                      
                      {review.comment && (
                        <p className="text-sm text-foreground leading-relaxed">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} ({totalReviews} avaliações)
              </p>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || loading}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
