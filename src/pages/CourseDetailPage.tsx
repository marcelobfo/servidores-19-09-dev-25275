import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, BookOpen, ArrowLeft, CheckCircle, CreditCard, Download, GraduationCap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Course {
  id: string;
  name: string;
  slug: string;
  description: string;
  brief_description: string;
  modules: string;
  image_url: string;
  duration_hours: number;
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

      // Parse modules if available
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
    return <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1F2C] via-[#221F3D] to-[#2A1F3D]">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 backdrop-blur-3xl"></div>
        <div className="relative container mx-auto px-4 py-12">
          <Link to="/courses" className="inline-flex items-center text-foreground/80 hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar aos Cursos
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Course Image */}
              {course.image_url && (
                <div className="relative w-full aspect-video overflow-hidden rounded-2xl shadow-2xl">
                  <img 
                    src={course.image_url} 
                    alt={course.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-primary/90 backdrop-blur-sm text-primary-foreground px-4 py-2 text-sm font-semibold">
                      {course.areas?.name}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Course Info */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-3">
                    <GraduationCap className="h-6 w-6 text-primary" />
                    <Badge variant="secondary">{course.duration_hours} horas</Badge>
                  </div>
                  <CardTitle className="text-3xl font-bold text-foreground">{course.name}</CardTitle>
                  <CardDescription className="text-lg text-muted-foreground mt-2">
                    {course.brief_description}
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Description */}
              {course.description && (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="text-xl">Sobre o Curso</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: course.description }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Modules */}
              {modules.length > 0 && (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Módulos do Curso
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {modules.map((module, index) => (
                        <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-foreground mb-1">
                                {module.name || `Módulo ${index + 1}`}
                              </h4>
                              {module.hours && (
                                <p className="text-sm text-muted-foreground">{module.hours} horas</p>
                              )}
                              {module.description && (
                                <p className="text-sm text-muted-foreground mt-2">{module.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-6 bg-card/70 backdrop-blur-md border-border/50 shadow-2xl">
                <CardHeader className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Carga Horária</p>
                        <p className="font-semibold text-foreground">{course.duration_hours} horas</p>
                      </div>
                    </div>

                    {course.start_date && course.end_date && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">Período</p>
                          <p className="font-semibold text-foreground text-sm">
                            {new Date(course.start_date).toLocaleDateString()} - {new Date(course.end_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {(course.pre_enrollment_fee || course.enrollment_fee) && (
                      <div className="pt-3 border-t border-border/50">
                        {course.pre_enrollment_fee && (
                          <div className="flex items-center gap-3 mb-2">
                            <CreditCard className="h-5 w-5 text-primary" />
                            <div>
                              <p className="text-sm text-muted-foreground">Taxa de Pré-Matrícula</p>
                              <p className="font-bold text-lg text-foreground">R$ {course.pre_enrollment_fee.toFixed(2).replace('.', ',')}</p>
                            </div>
                          </div>
                        )}
                        {course.enrollment_fee && (
                          <div className="flex items-center gap-3">
                            <CreditCard className="h-5 w-5 text-primary" />
                            <div>
                              <p className="text-sm text-muted-foreground">Taxa de Matrícula</p>
                              <p className="font-bold text-lg text-foreground">R$ {course.enrollment_fee.toFixed(2).replace('.', ',')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!user ? (
                    <Link to="/auth" className="w-full">
                      <Button className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground" size="lg">
                        Fazer Login para Matrícula
                      </Button>
                    </Link>
                  ) : !preEnrollment ? (
                    <Link to={`/pre-enrollment?course=${course.id}`} className="w-full">
                      <Button className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground" size="lg">
                        Fazer Pré-Matrícula
                      </Button>
                    </Link>
                  ) : (
                    <div className="space-y-3">
                      {/* Status badges */}
                      {preEnrollment.status === 'payment_confirmed' && preEnrollment.organ_approval_status === 'pending' && (
                        <>
                          <Badge variant="outline" className="w-full justify-center py-2 bg-blue-500/10 text-blue-400 border-blue-500/30">
                            Aguardando Aprovação do Órgão
                          </Badge>
                          <Button 
                            onClick={handleOrganApproval}
                            variant="outline"
                            size="lg"
                            className="w-full border-blue-500/30 hover:bg-blue-500/10"
                            disabled={loadingAction}
                          >
                            {loadingAction ? "Confirmando..." : "✓ Meu Órgão Aprovou"}
                          </Button>
                        </>
                      )}
                      
                      {preEnrollment.organ_approval_status === 'approved' && !preEnrollment.organ_approval_confirmed && (
                        <>
                          <Badge variant="default" className="w-full justify-center py-2 bg-green-500">
                            Órgão Aprovou - Faça sua Matrícula
                          </Badge>
                          <Button 
                            onClick={handleEnrollmentPayment}
                            className="w-full bg-green-600 hover:bg-green-700"
                            size="lg"
                            disabled={loadingAction}
                          >
                            {loadingAction ? "Processando..." : `Fazer Matrícula (R$ ${preEnrollment.courses.enrollment_fee?.toFixed(2) || '0,00'})`}
                          </Button>
                        </>
                      )}
                      
                      {preEnrollment.organ_approval_status === 'approved' && preEnrollment.organ_approval_confirmed && (
                        <>
                          <Badge variant="default" className="w-full justify-center py-2 bg-purple-500">
                            Curso Concluído
                          </Badge>
                          <Link to="/student" className="w-full">
                            <Button className="w-full bg-purple-600 hover:bg-purple-700" size="lg">
                              <Download className="mr-2 h-4 w-4" />
                              Baixar Certificado
                            </Button>
                          </Link>
                        </>
                      )}
                      
                      {preEnrollment.status === 'pending' && (
                        <Badge variant="secondary" className="w-full justify-center py-2">
                          Aguardando Análise
                        </Badge>
                      )}

                      <Link to="/student" className="w-full block">
                        <Button variant="outline" size="sm" className="w-full">
                          Ver Detalhes no Dashboard
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;
