import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, BookOpen, ArrowLeft, CheckCircle, CreditCard, Download } from "lucide-react";
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
    <div className="container mx-auto px-4 py-8">
      <Link to="/courses" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar aos Cursos
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {course.image_url && (
            <div className="w-[500px] h-[500px] overflow-hidden rounded-lg mb-6 mx-auto">
              <img 
                src={course.image_url} 
                alt={course.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <Badge variant="secondary">{course.areas?.name}</Badge>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-1" />
                  {course.duration_hours} horas
                </div>
              </div>
              <h1 className="text-3xl font-bold mb-4">{course.name}</h1>
              <p className="text-lg text-muted-foreground">{course.brief_description}</p>
            </div>

            {course.description && (
              <div>
                <h2 className="text-xl font-semibold mb-3">Sobre o Curso</h2>
                <div 
                  className="prose prose-sm max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: course.description }}
                />
              </div>
            )}

            {modules.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-3">Módulos do Curso</h2>
                <div className="space-y-3">
                  {modules.map((module, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center">
                        <BookOpen className="h-5 w-5 mr-2" />
                        {module.name || `Módulo ${index + 1}`}
                      </CardTitle>
                      {module.hours && (
                        <CardDescription>
                          {module.hours} horas
                        </CardDescription>
                      )}
                    </CardHeader>
                    {module.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{module.description}</p>
                      </CardContent>
                    )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Informações do Curso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="text-sm">
                  <strong>Carga Horária:</strong> {course.duration_hours} horas
                </span>
              </div>

              {course.start_date && course.end_date && (
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="text-sm">
                    <strong>Período:</strong><br />
                    {new Date(course.start_date).toLocaleDateString()} - {new Date(course.end_date).toLocaleDateString()}
                  </span>
                </div>
              )}

              {(course.pre_enrollment_fee || course.enrollment_fee) && (
                <div className="space-y-2">
                  {course.pre_enrollment_fee && (
                    <div className="flex items-center">
                      <CreditCard className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-sm">
                        <strong>Taxa de Pré-Matrícula:</strong> R$ {course.pre_enrollment_fee.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}
                  {course.enrollment_fee && (
                    <div className="flex items-center">
                      <CreditCard className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="text-sm">
                        <strong>Taxa de Matrícula:</strong> R$ {course.enrollment_fee.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}
                </div>
              )}

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
                    {/* Status atual */}
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

                    {/* Botões de ação */}
                    {preEnrollment.status === 'payment_confirmed' && preEnrollment.organ_approval_status === 'pending' && (
                      <Button 
                        onClick={handleOrganApproval}
                        variant="outline"
                        size="lg"
                        className="w-full bg-blue-50 hover:bg-blue-100 border-blue-300"
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
                        className="w-full bg-green-600 hover:bg-green-700"
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
                        <Button className="w-full bg-purple-600 hover:bg-purple-700" size="lg">
                          <Download className="mr-2 h-4 w-4" />
                          Baixar Certificado
                        </Button>
                      </Link>
                    )}

                    <Link to="/student" className="w-full">
                      <Button variant="outline" size="sm" className="w-full">
                        Ver Detalhes no Dashboard
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;