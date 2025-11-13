// Tipos para a tabela course_reviews
export interface CourseReview {
  id: string;
  course_id: string;
  enrollment_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseReviewWithProfile extends CourseReview {
  profiles: {
    full_name: string;
    email: string;
  };
}

export interface CourseReviewStats {
  course_id: string;
  total_reviews: number;
  average_rating: number;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
}

export interface CourseReviewInsert {
  id?: string;
  course_id: string;
  enrollment_id: string;
  user_id: string;
  rating: number;
  comment?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CourseReviewUpdate {
  rating?: number;
  comment?: string | null;
  updated_at?: string;
}
