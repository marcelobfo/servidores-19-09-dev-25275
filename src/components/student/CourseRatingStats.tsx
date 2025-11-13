import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { CourseReviewStats as RatingStats } from "@/types/course-reviews";

interface CourseRatingStatsProps {
  courseId: string;
}

export function CourseRatingStats({ courseId }: CourseRatingStatsProps) {
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [courseId]);

  const fetchStats = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('course_review_stats')
        .select('*')
        .eq('course_id', courseId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      setStats(data as RatingStats);
    } catch (error) {
      console.error("Error fetching rating stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se não há avaliações, mostrar placeholder
  if (!stats || stats.total_reviews === 0) {
    return (
      <Card className="bg-white dark:bg-card">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="h-5 w-5 text-muted-foreground" />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Sem avaliações ainda</p>
            <p className="text-xs text-muted-foreground mt-1">
              Seja o primeiro a avaliar!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const starDistribution = [
    { stars: 5, count: stats.five_star_count },
    { stars: 4, count: stats.four_star_count },
    { stars: 3, count: stats.three_star_count },
    { stars: 2, count: stats.two_star_count },
    { stars: 1, count: stats.one_star_count },
  ];

  return (
    <Card className="bg-white dark:bg-card">
      <CardContent className="p-6">
        <div className="flex items-start gap-6">
          {/* Rating Geral */}
          <div className="text-center">
            <div className="text-4xl font-bold text-foreground mb-1">
              {Number(stats.average_rating).toFixed(1)}
            </div>
            <div className="flex items-center justify-center gap-0.5 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star 
                  key={star} 
                  className={`h-5 w-5 ${
                    star <= Math.round(Number(stats.average_rating))
                      ? "fill-yellow-400 text-yellow-400" 
                      : "text-muted-foreground"
                  }`} 
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.total_reviews} avaliação{stats.total_reviews !== 1 ? 'ões' : ''}
            </p>
          </div>

          {/* Distribuição de Estrelas */}
          <div className="flex-1 space-y-2">
            {starDistribution.map(({ stars, count }) => {
              const percentage = stats.total_reviews > 0 
                ? (count / stats.total_reviews) * 100 
                : 0;

              return (
                <div key={stars} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground w-8">
                    {stars}★
                  </span>
                  <Progress 
                    value={percentage} 
                    className="h-2 flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {Math.round(percentage)}%
                  </span>
                  <span className="text-xs text-muted-foreground w-8 text-right">
                    ({count})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
