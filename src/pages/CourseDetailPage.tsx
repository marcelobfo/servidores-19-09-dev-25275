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
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[500px_1fr] gap-8">
          {/* Side Banner - Left Column */}
          <div className="lg:sticky lg:top-6 h-fit space-y-4">
            <Link 
              to="/courses" 
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar aos Cursos
            </Link>
            
            <div className="relative rounded-lg overflow-hidden aspect-[16/10] bg-muted">
              {course.image_url ? (
                <img 
                  src={course.image_url} 
                  alt={course.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <BookOpen className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </div>
            
            <Badge className="w-fit">
              {course.areas?.name || 'Área não especificada'}
            </Badge>
          </div>

          {/* Main Content - Right Column */}
          <div className="space-y-6">
            {/* Top Section: Title + Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
              {/* Title Section */}
              <div className="space-y-3">
                <Badge className="w-fit">
                  {course.areas?.name || 'Área não especificada'}
                </Badge>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Clock className="h-4 w-4" />
                  <span>{course.duration_hours} horas</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight">
                  {course.name}
                </h1>
              </div>

              {/* Sidebar - Course Details */}
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6 space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Informações do Curso</h3>
                      
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Carga Horária</p>
                            <p className="text-sm text-muted-foreground">{course.duration_hours} horas</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Award className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Certificado</p>
                            <p className="text-sm text-muted-foreground">Incluído</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Monitor className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Modalidade</p>
                            <p className="text-sm text-muted-foreground">Online</p>
                          </div>
                        </div>

                        {course.start_date && course.end_date && (
                          <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">Período</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(course.start_date).toLocaleDateString()} - {new Date(course.end_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="pt-4 border-t">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                        <span className="text-lg font-semibold">4.8</span>
                      </div>
                      <p className="text-sm text-muted-foreground">1.247 avaliações</p>
                    </div>

                    {/* Pricing */}
                    {(course.pre_enrollment_fee || course.enrollment_fee) && (
                      <div className="pt-4 border-t space-y-2">
                        {course.pre_enrollment_fee && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Taxa de Pré-Matrícula:</span>
                            <span className="font-medium">R$ {course.pre_enrollment_fee.toFixed(2).replace('.', ',')}</span>
                          </div>
                        )}
                        {course.enrollment_fee && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Taxa de Matrícula:</span>
                            <span className="font-medium">R$ {course.enrollment_fee.toFixed(2).replace('.', ',')}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="pt-4 border-t">
                      {!user ? (
                        <Link to="/auth" className="w-full">
                          <Button className="w-full" size="lg">
                            Fazer Login para Matrícula
                          </Button>
                        </Link>
                      ) : !preEnrollment ? (
                        <Link to={`/pre-enrollment?course=${course.id}`} className="w-full">
                          <Button className="w-full" size="lg">
                            Fazer Pré-Matrícula
                          </Button>
                        </Link>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-center">
                            {preEnrollment.status === 'payment_confirmed' && preEnrollment.organ_approval_status === 'pending' && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Aguardando Aprovação do Órgão
                              </Badge>
                            )}
                            
                            {preEnrollment.organ_approval_status === 'approved' && !preEnrollment.organ_approval_confirmed && (
                              <Badge variant="default" className="bg-green-500">
                                Órgão Aprovou - Faça sua Matrícula
                              </Badge>
                            )}
                            
                            {preEnrollment.organ_approval_status === 'approved' && preEnrollment.organ_approval_confirmed && (
                              <Badge variant="default" className="bg-purple-500">
                                Curso Concluído - Certificado Disponível
                              </Badge>
                            )}
                            
                            {preEnrollment.organ_approval_status === 'rejected' && (
                              <Badge variant="destructive">
                                Reprovado pelo Órgão
                              </Badge>
                            )}
                            
                            {preEnrollment.status === 'pending' && (
                              <Badge variant="secondary">
                                Aguardando Análise
                              </Badge>
                            )}
                          </div>

                          {preEnrollment.status === 'payment_confirmed' && preEnrollment.organ_approval_status === 'pending' && (
                            <Button 
                              onClick={handleOrganApproval}
                              variant="outline"
                              size="lg"
                              className="w-full"
                              disabled={loadingAction}
                            >
                              {loadingAction ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                                  Confirmando...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  ✓ Meu Órgão Aprovou
                                </>
                              )}
                            </Button>
                          )}

                          {preEnrollment.organ_approval_status === 'approved' && !preEnrollment.organ_approval_confirmed && (
                            <Button 
                              onClick={handleEnrollmentPayment}
                              className="w-full"
                              size="lg"
                              disabled={loadingAction}
                            >
                              {loadingAction ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Processando...
                                </>
                              ) : (
                                <>
                                  <CreditCard className="mr-2 h-4 w-4" />
                                  Fazer Matrícula (R$ {preEnrollment.courses.enrollment_fee?.toFixed(2) || '0,00'})
                                </>
                              )}
                            </Button>
                          )}

                          {preEnrollment.organ_approval_status === 'approved' && preEnrollment.organ_approval_confirmed && (
                            <Link to="/student" className="w-full">
                              <Button className="w-full" size="lg">
                                <Download className="mr-2 h-4 w-4" />
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

            {/* Main Content Below */}
            <div className="space-y-8">
              {/* About Course */}
              <div>
                <h2 className="text-2xl font-bold text-primary mb-4">Sobre o Curso</h2>
                {course.brief_description && (
                  <p className="text-lg text-muted-foreground mb-4">
                    {course.brief_description}
                  </p>
                )}
                {course.description && (
                  <SafeHTML html={course.description} />
                )}
              </div>

              {/* Modules */}
              {modules.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-primary mb-6">Módulos do Curso</h2>
                  <div className="space-y-4">
                    {modules.map((module, index) => (
                      <Card key={index} className="border-l-4 border-l-primary">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <BookOpen className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="text-lg font-semibold">
                                  {module.name || `Módulo ${index + 1}`}
                                </h3>
                                {module.hours && (
                                  <Badge variant="secondary" className="ml-4">
                                    {module.hours} horas
                                  </Badge>
                                )}
                              </div>
                              {module.description && (
                                <SafeHTML html={module.description} className="text-muted-foreground" />
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;
