import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, BookOpen, ArrowLeft, CheckCircle, CreditCard, Download, Award, Monitor, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SafeHTML } from "@/components/SafeHTML";

interface Course {
  id: string;
  name: string;
  slug: string;
  description: string;
  brief_description: string;
  modules: string;
  image_url: string;
  duration_hours: number;
  duration_days?: number;
  start_date: string;
  end_date: string;
  pre_enrollment_fee?: number;
  enrollment_fee?: number;
  areas?: { name: string };
}

interface PreEnrollment {
  id: string;
  status: "pending" | "approved" | "rejected" | "pending_payment" | "payment_confirmed";
  organ_approval_status?: string;
  organ_approval_confirmed?: boolean;
  courses: {
    enrollment_fee?: number;
  };
}

const CourseDetailPage = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<any[]>([]);
  const [preEnrollment, setPreEnrollment] = useState<PreEnrollment | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchCourse();
    }
  }, [slug]);

  useEffect(() => {
    if (user && course) {
      fetchPreEnrollment();
    }
  }, [user, course]);

  const fetchPreEnrollment = async () => {
    if (!user || !course) return;
    
    try {
      const { data, error } = await supabase
        .from("pre_enrollments")
        .select(`
          id,
          status,
          organ_approval_status,
          organ_approval_confirmed,
          courses (
            enrollment_fee
          )
        `)
        .eq("user_id", user.id)
        .eq("course_id", course.id)
        .maybeSingle();

      if (error) throw error;
      setPreEnrollment(data);
    } catch (error) {
      console.error("Error fetching pre-enrollment:", error);
    }
  };

  const handleOrganApproval = async () => {
    if (!preEnrollment) return;
    
    setLoadingAction(true);
    try {
      const { error } = await supabase
        .from('pre_enrollments')
        .update({ 
          organ_approval_status: 'approved',
          organ_approval_confirmed: true 
        })
        .eq('id', preEnrollment.id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Aprovação do órgão confirmada!"
      });
      
      fetchPreEnrollment();
    } catch (error) {
      toast({
        title: "Erro", 
        description: "Falha ao confirmar aprovação",
        variant: "destructive"
      });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleEnrollmentPayment = async () => {
    if (!preEnrollment) return;
    
    setLoadingAction(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-enrollment-checkout', {
        body: {
          pre_enrollment_id: preEnrollment.id
        }
      });

      if (error) throw error;

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Erro",
        description: "Falha ao processar pagamento",
        variant: "destructive"
      });
    } finally {
      setLoadingAction(false);
    }
  };

  const fetchCourse = async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          areas (name)
        `)
        .eq("slug", slug)
        .eq("published", true)
        .single();

      if (error) throw error;
      setCourse(data);

      if (data.modules) {
        try {
          const parsedModules = JSON.parse(data.modules);
          setModules(Array.isArray(parsedModules) ? parsedModules : []);
        } catch {
          setModules([]);
        }
      }
    } catch (error) {
      console.error("Error fetching course:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Curso não encontrado</h1>
          <Link to="/courses">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar aos Cursos
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with Gradient Background */}
      <div className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="container mx-auto px-4 py-16 relative z-10">
          <Link 
            to="/courses" 
            className="inline-flex items-center text-sm text-white/90 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar aos Cursos
          </Link>
          
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
            {/* Hero Content */}
            <div className="space-y-4">
              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm">
                {course.areas?.name || 'Área não especificada'}
              </Badge>
              
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight drop-shadow-lg">
                {course.name}
              </h1>
              
              {course.brief_description && (
                <p className="text-lg text-white/90 max-w-2xl leading-relaxed">
                  {course.brief_description}
                </p>
              )}
              
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center gap-2 text-white/90 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">{course.duration_hours}h</span>
                </div>
                <div className="flex items-center gap-2 text-white/90 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                  <Award className="h-5 w-5" />
                  <span className="font-medium">Certificado Incluído</span>
                </div>
                <div className="flex items-center gap-2 text-white/90 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                  <Monitor className="h-5 w-5" />
                  <span className="font-medium">100% Online</span>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative rounded-xl overflow-hidden aspect-[4/3] shadow-2xl border-4 border-white/20">
              {course.image_url ? (
                <img 
                  src={course.image_url} 
                  alt={course.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <BookOpen className="h-24 w-24 text-white/50" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* Left Column - Course Content */}
          <div className="space-y-10">
            {/* About Course */}
            <div>
              <h2 className="text-3xl font-bold mb-6 text-foreground">Sobre o Curso</h2>
              {course.description && (
                <Card>
                  <CardContent className="pt-6">
                    <SafeHTML 
                      html={course.description} 
                      className="text-base"
                    />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Modules */}
            {modules.length > 0 && (
              <div>
                <h2 className="text-3xl font-bold mb-6 text-foreground">Módulos do Curso</h2>
                <div className="space-y-4">
                  {modules.map((module, index) => (
                    <Card 
                      key={index} 
                      className="border-l-4 border-l-primary hover:shadow-lg transition-shadow"
                      style={{ boxShadow: 'var(--shadow-lg)' }}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold mb-2">
                              {module.name || module.title || `Módulo ${index + 1}`}
                              {module.hours && <span className="text-sm text-muted-foreground ml-2">({module.hours}h)</span>}
                            </h3>
                            {module.description && (
                              <p className="text-muted-foreground">{module.description}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sticky Sidebar */}
          <div className="lg:sticky lg:top-6 h-fit">
            <Card className="overflow-hidden" style={{ boxShadow: 'var(--shadow-xl)' }}>
              <CardContent className="p-0">
                {/* Card Header with Gradient */}
                <div className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b">
                  <h3 className="text-2xl font-bold mb-4 text-foreground">Informações</h3>
                  
                  {/* Rating */}
                  <div className="flex items-center gap-3 mb-6 bg-white dark:bg-card rounded-lg p-4">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <div>
                      <div className="text-xl font-bold text-foreground">4.8</div>
                      <div className="text-xs text-muted-foreground">1.247 avaliações</div>
                    </div>
                  </div>

                  {/* Course Details */}
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Carga Horária</p>
                        <p className="text-sm text-muted-foreground">{course.duration_hours} horas</p>
                      </div>
                    </div>

                    {course.duration_days && (
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Duração do Curso</p>
                          <p className="text-sm text-muted-foreground">{course.duration_days} dias</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <Award className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Certificado</p>
                        <p className="text-sm text-muted-foreground">Incluído ao concluir</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Monitor className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Modalidade</p>
                        <p className="text-sm text-muted-foreground">100% Online</p>
                      </div>
                    </div>

                    {course.start_date && course.end_date && (
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Período</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(course.start_date).toLocaleDateString()} - {new Date(course.end_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pricing Section */}
                {(course.pre_enrollment_fee || course.enrollment_fee) && (
                  <div className="p-6 bg-muted/30 border-b">
                    <h4 className="font-semibold mb-3 text-foreground">Investimento</h4>
                    <div className="space-y-2">
                      {course.pre_enrollment_fee && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Pré-Matrícula</span>
                          <span className="font-bold text-lg text-foreground">
                            R$ {course.pre_enrollment_fee.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      )}
                      {course.enrollment_fee && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Matrícula</span>
                          <span className="font-bold text-lg text-foreground">
                            R$ {course.enrollment_fee.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="p-6 space-y-4">
                  {!user ? (
                    <Link to="/auth" className="block">
                      <Button className="w-full h-12 text-base font-semibold" size="lg">
                        Fazer Login para Matrícula
                      </Button>
                    </Link>
                  ) : !preEnrollment ? (
                    <Link to={`/pre-enrollment?course=${course.id}`} className="block">
                      <Button 
                        className="w-full h-12 text-base font-semibold transition-all hover:scale-105" 
                        size="lg"
                        style={{ background: 'var(--gradient-primary)' }}
                      >
                        Fazer Pré-Matrícula
                      </Button>
                    </Link>
                  ) : (
                    <div className="space-y-4">
                      {/* Status Badge */}
                      <div className="text-center">
                        {preEnrollment.status === 'payment_confirmed' && preEnrollment.organ_approval_status === 'pending' && (
                          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-sm py-2 px-4">
                            Aguardando Aprovação do Órgão
                          </Badge>
                        )}
                        
                        {preEnrollment.organ_approval_status === 'approved' && !preEnrollment.organ_approval_confirmed && (
                          <Badge className="bg-green-500 dark:bg-green-600 text-white text-sm py-2 px-4">
                            Órgão Aprovou - Faça sua Matrícula
                          </Badge>
                        )}
                        
                        {preEnrollment.organ_approval_status === 'approved' && preEnrollment.organ_approval_confirmed && (
                          <Badge className="bg-purple-500 dark:bg-purple-600 text-white text-sm py-2 px-4">
                            Curso Concluído - Certificado Disponível
                          </Badge>
                        )}
                        
                        {preEnrollment.organ_approval_status === 'rejected' && (
                          <Badge variant="destructive" className="text-sm py-2 px-4">
                            Reprovado pelo Órgão
                          </Badge>
                        )}
                        
                        {preEnrollment.status === 'pending' && (
                          <Badge variant="secondary" className="text-sm py-2 px-4">
                            Aguardando Análise
                          </Badge>
                        )}
                      </div>

                      {/* Action Buttons based on status */}
                      {preEnrollment.status === 'payment_confirmed' && preEnrollment.organ_approval_status === 'pending' && (
                        <Button 
                          onClick={handleOrganApproval}
                          variant="outline"
                          size="lg"
                          className="w-full h-12 font-semibold"
                          disabled={loadingAction}
                        >
                          {loadingAction ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                              Confirmando...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-5 w-5" />
                              ✓ Meu Órgão Aprovou
                            </>
                          )}
                        </Button>
                      )}

                      {preEnrollment.organ_approval_status === 'approved' && !preEnrollment.organ_approval_confirmed && (
                        <Button 
                          onClick={handleEnrollmentPayment}
                          size="lg"
                          className="w-full h-12 font-semibold transition-all hover:scale-105"
                          disabled={loadingAction}
                          style={{ background: 'var(--gradient-primary)' }}
                        >
                          {loadingAction ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Processando...
                            </>
                          ) : (
                            <>
                              <CreditCard className="mr-2 h-5 w-5" />
                              Fazer Matrícula (R$ {preEnrollment.courses.enrollment_fee?.toFixed(2).replace('.', ',') || '0,00'})
                            </>
                          )}
                        </Button>
                      )}

                      {preEnrollment.organ_approval_status === 'approved' && preEnrollment.organ_approval_confirmed && (
                        <Link to="/student" className="block">
                          <Button 
                            size="lg"
                            className="w-full h-12 font-semibold"
                            style={{ background: 'var(--gradient-primary)' }}
                          >
                            <Download className="mr-2 h-5 w-5" />
                            Baixar Certificado
                          </Button>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;
