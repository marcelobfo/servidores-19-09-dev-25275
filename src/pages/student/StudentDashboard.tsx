import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Download, Eye, CreditCard, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { generateStudyPlan, generateEnrollmentDeclaration } from "@/lib/pdfGenerator";
import { useToast } from "@/hooks/use-toast";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { generateCertificateForEnrollment } from "@/lib/certificateService";

interface PreEnrollment {
  id: string;
  status: "pending" | "approved" | "rejected" | "pending_payment" | "payment_confirmed";
  created_at: string;
  admin_notes?: string;
  full_name: string;
  cpf?: string;
  organization?: string;
  email?: string;
  phone?: string;
  organ_approval_status?: string;
  organ_approval_date?: string;
  organ_approval_notes?: string;
  organ_approval_confirmed?: boolean;
  courses: {
    name: string;
    brief_description?: string;
    description?: string;
    duration_hours: number;
    start_date?: string;
    end_date?: string;
    modules?: string;
    pre_enrollment_fee?: number;
    enrollment_fee?: number;
  };
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<PreEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEnrollmentForPayment, setSelectedEnrollmentForPayment] = useState<PreEnrollment | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchEnrollments();
    }
  }, [user]);

  const fetchEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from("pre_enrollments")
        .select(`
          id,
          status,
          created_at,
          admin_notes,
          full_name,
          cpf,
          organization,
          email,
          phone,
          organ_approval_status,
          organ_approval_date,
          organ_approval_notes,
          organ_approval_confirmed,
          courses (
            name,
            brief_description,
            description,
            duration_hours,
            start_date,
            end_date,
            modules,
            pre_enrollment_fee,
            enrollment_fee
          )
        `)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEnrollments(data || []);
    } catch (error) {
      console.error("Error fetching enrollments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollmentPayment = async (enrollment: PreEnrollment) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-enrollment-checkout', {
        body: {
          pre_enrollment_id: enrollment.id
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
    }
  };

  const handleOrganApproval = async (enrollmentId: string) => {
    try {
      const { error } = await supabase
        .from('pre_enrollments')
        .update({ 
          organ_approval_status: 'approved',
          organ_approval_date: new Date().toISOString(),
          organ_approval_confirmed: true 
        })
        .eq('id', enrollmentId);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Aprovação do órgão confirmada!"
      });
      
      fetchEnrollments();
    } catch (error) {
      toast({
        title: "Erro", 
        description: "Falha ao confirmar aprovação",
        variant: "destructive"
      });
    }
  };

  const handlePreEnrollmentPayment = async (enrollment: PreEnrollment) => {
    try {
      console.log('💳 [DASHBOARD] Iniciando checkout de pré-matrícula');
      console.log('📋 Pre-enrollment ID:', enrollment.id);
      console.log('💰 Valor:', enrollment.courses.pre_enrollment_fee);

      const { data, error } = await supabase.functions.invoke('create-enrollment-checkout', {
        body: {
          pre_enrollment_id: enrollment.id
        }
      });

      console.log('✅ [DASHBOARD] Resposta da edge function:', data);
      console.log('❌ [DASHBOARD] Erro:', error);

      if (error) throw error;

      if (data?.checkout_url) {
        console.log('🔗 [DASHBOARD] Redirecionando para:', data.checkout_url);
        window.location.href = data.checkout_url;
      } else {
        throw new Error("URL de checkout não foi gerada");
      }
    } catch (error: any) {
      console.error("Error creating pre-enrollment checkout:", error);
      toast({
        title: "Erro",
        description: "Erro ao processar pagamento",
        variant: "destructive"
      });
    }
  };

  const handleEnrollmentCheckout = async (enrollment: PreEnrollment) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-enrollment-checkout', {
        body: {
          pre_enrollment_id: enrollment.id
        }
      });

      if (error) throw error;

      if (data?.checkout_url) {
        // Redirect to Asaas checkout URL
        window.open(data.checkout_url, '_blank');
        
        toast({
          title: "Redirecionando para pagamento",
          description: "Você será direcionado para finalizar o pagamento da matrícula.",
        });
      } else {
        throw new Error('URL de checkout não encontrada');
      }
    } catch (error: any) {
      toast({
        title: "Erro ao processar matrícula",
        description: error.message || "Falha ao criar checkout de matrícula",
        variant: "destructive"
      });
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false);
    setSelectedEnrollmentForPayment(null);
    
    // Create enrollment record
    if (selectedEnrollmentForPayment) {
      try {
        const { error } = await supabase
          .from('enrollments')
          .insert({
            pre_enrollment_id: selectedEnrollmentForPayment.id,
            user_id: user?.id,
            course_id: selectedEnrollmentForPayment.courses.name, // This should be course_id
            status: 'awaiting_payment',
            payment_status: 'pending'
          });

        if (error) throw error;

        toast({
          title: "Matrícula iniciada",
          description: "Sua matrícula foi processada com sucesso!",
        });
        
        fetchEnrollments();
      } catch (error) {
        console.error('Error creating enrollment:', error);
        toast({
          title: "Erro",
          description: "Erro ao processar matrícula. Tente novamente.",
          variant: "destructive",
        });
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "pending_payment":
        return <Clock className="h-4 w-4 text-orange-500" />;
      case "payment_confirmed":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string, organApprovalStatus?: string, organApprovalConfirmed?: boolean) => {
    // Mostrar status específico baseado na aprovação do órgão
    if (organApprovalStatus === 'approved' && organApprovalConfirmed) {
      return <Badge variant="default" className="bg-purple-500">Curso Concluído - Certificado Disponível</Badge>;
    }
    
    if (organApprovalStatus === 'approved' && !organApprovalConfirmed) {
      return <Badge variant="default" className="bg-green-500">Órgão Aprovou - Faça sua Matrícula</Badge>;
    }
    
    if (status === 'payment_confirmed' && organApprovalStatus === 'pending') {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Aguardando Aprovação do Órgão</Badge>;
    }
    
    if (organApprovalStatus === 'rejected') {
      return <Badge variant="destructive">Reprovado pelo Órgão</Badge>;
    }

    switch (status) {
      case "pending":
        return <Badge variant="secondary">Aguardando Análise</Badge>;
      case "pending_payment":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Pagamento Pendente</Badge>;
      case "payment_confirmed":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Pagamento Confirmado</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-500">Aprovada</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejeitada</Badge>;
      default:
        return null;
    }
  };

  const generateCertificate = async (enrollmentId: string) => {
    setGenerating(`${enrollmentId}-certificate`);
    
    try {
      const certificate = await generateCertificateForEnrollment(enrollmentId);
      
      toast({
        title: "Certificado gerado com sucesso",
        description: "Seu certificado foi criado e está disponível para download.",
      });
      
      // Download the certificate
      if (certificate.verification_url) {
        window.open(certificate.verification_url, '_blank');
      }
      
    } catch (error: any) {
      console.error('Error generating certificate:', error);
      toast({
        title: "Erro na geração do certificado",
        description: error.message || "Não foi possível gerar o certificado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setGenerating(null);
    }
  };

  const generateDocument = async (enrollment: PreEnrollment, type: 'declaration' | 'study_plan') => {
    if (enrollment.status !== 'approved' && enrollment.status !== 'payment_confirmed') {
      toast({
        title: "Acesso negado",
        description: "Documentos disponíveis apenas após confirmação de pagamento ou aprovação.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(`${enrollment.id}-${type}`);
    
    try {
      // Fetch system settings
      const { data: settings, error: settingsError } = await supabase
        .from("system_settings")
        .select("*")
        .single();

      if (settingsError) throw settingsError;

      const enrollmentData = {
        full_name: enrollment.full_name,
        cpf: enrollment.cpf,
        organization: enrollment.organization,
        email: enrollment.email,
        phone: enrollment.phone,
        course: {
          name: enrollment.courses.name,
          description: enrollment.courses.description,
          duration_hours: enrollment.courses.duration_hours,
          start_date: enrollment.courses.start_date || '',
          end_date: enrollment.courses.end_date || '',
          modules: enrollment.courses.modules,
        }
      };

      let blob: Blob;
      let filename: string;

      if (type === 'declaration') {
        blob = await generateEnrollmentDeclaration(enrollmentData, settings);
        filename = `declaracao_matricula_${enrollment.full_name.replace(/\s+/g, '_')}.pdf`;
      } else {
        blob = await generateStudyPlan(enrollmentData, settings);
        filename = `plano_estudos_${enrollment.full_name.replace(/\s+/g, '_')}.pdf`;
      }

      // Download the PDF
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Documento gerado com sucesso",
        description: `${type === 'declaration' ? 'Declaração de matrícula' : 'Plano de estudos'} baixado com sucesso.`,
      });

    } catch (error) {
      console.error('Error generating document:', error);
      toast({
        title: "Erro na geração",
        description: "Não foi possível gerar o documento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setGenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Minha Área</h1>
          <p className="text-muted-foreground">
            Acompanhe suas pré-matrículas e acesse seus documentos
          </p>
        </div>
        <Link to="/student/profile">
          <Button variant="outline">
            Editar Perfil
          </Button>
        </Link>
      </div>

      {enrollments.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma pré-matrícula encontrada</CardTitle>
            <CardDescription>
              Você ainda não fez nenhuma pré-matrícula. Explore nossos cursos e faça sua primeira inscrição!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/courses">
              <Button>Ver Cursos Disponíveis</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {enrollments.map((enrollment) => (
            <Card key={enrollment.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(enrollment.status)}
                    <CardTitle className="text-lg">
                      {enrollment.courses.name}
                    </CardTitle>
                  </div>
                  {getStatusBadge(enrollment.status, enrollment.organ_approval_status, enrollment.organ_approval_confirmed)}
                </div>
                <CardDescription>
                  {enrollment.courses.brief_description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Solicitada em: {new Date(enrollment.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  {enrollment.admin_notes && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">Observações do administrador:</p>
                      <p className="text-sm">{enrollment.admin_notes}</p>
                    </div>
                  )}

                  {enrollment.status === 'payment_confirmed' && enrollment.organ_approval_status === 'pending' && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-5 w-5 text-blue-600" />
                        <p className="font-medium text-blue-800">Próximo Passo: Aprovação do Órgão</p>
                      </div>
                      <p className="text-sm text-blue-700 mb-3">
                        1. Baixe os documentos abaixo (Declaração de Matrícula e Plano de Estudos)<br/>
                        2. Envie para seu órgão para aprovação<br/>
                        3. Após aprovação, clique no botão "Confirmar Aprovação"
                      </p>
                      <Button 
                        onClick={() => handleOrganApproval(enrollment.id)}
                        variant="outline"
                        size="sm"
                        className="bg-blue-50 hover:bg-blue-100 border-blue-300"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        ✓ Meu Órgão Aprovou
                      </Button>
                    </div>
                  )}

                  {enrollment.organ_approval_status === 'approved' && enrollment.organ_approval_confirmed && (
                    <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-purple-600" />
                        <p className="font-medium text-purple-800">Matriculado - Certificado Disponível</p>
                      </div>
                      <p className="text-sm text-purple-700 mb-3">
                        Parabéns! Você concluiu o curso e pode baixar seu certificado.
                      </p>
                      <Button 
                        onClick={() => generateCertificate(enrollment.id)}
                        className="bg-purple-600 hover:bg-purple-700"
                        disabled={generating === `${enrollment.id}-certificate`}
                      >
                        {generating === `${enrollment.id}-certificate` ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Gerando...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Baixar Certificado
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                   {enrollment.organ_approval_status === 'approved' && !enrollment.organ_approval_confirmed && (
                     <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                       <div className="flex items-center gap-2 mb-2">
                         <CheckCircle className="h-5 w-5 text-green-600" />
                         <p className="font-medium text-green-800">Pré-matrícula Aprovada pelo Órgão!</p>
                       </div>
                       <p className="text-sm text-green-700 mb-3">
                         Sua pré-matrícula foi aprovada! Agora você pode efetivar sua matrícula.
                       </p>
                       <Button 
                         onClick={() => handleEnrollmentCheckout(enrollment)}
                         className="bg-green-600 hover:bg-green-700"
                       >
                         <CreditCard className="mr-2 h-4 w-4" />
                         Efetivar Matrícula (R$ {enrollment.courses.enrollment_fee?.toFixed(2) || '0,00'})
                       </Button>
                     </div>
                   )}

                  {enrollment.organ_approval_status === 'rejected' && (
                    <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <p className="font-medium text-red-800">Reprovado pelo Órgão</p>
                      </div>
                      <p className="text-sm text-red-700">
                        Infelizmente seu órgão reprovou esta pré-matrícula. Entre em contato para mais informações.
                      </p>
                      {enrollment.organ_approval_notes && (
                        <p className="text-sm text-red-600 mt-2 italic">
                          "{enrollment.organ_approval_notes}"
                        </p>
                      )}
                    </div>
                   )}

                   {/* Botão para pagar pré-matrícula quando status é pending_payment */}
                  {enrollment.status === 'pending_payment' && enrollment.courses.pre_enrollment_fee && enrollment.courses.pre_enrollment_fee > 0 && (
                    <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-5 w-5 text-orange-600" />
                        <p className="font-medium text-orange-800">Pagamento da Pré-matrícula Pendente</p>
                      </div>
                      <p className="text-sm text-orange-700 mb-3">
                        Para continuar o processo, é necessário pagar a taxa de pré-matrícula de R$ {enrollment.courses.pre_enrollment_fee.toFixed(2)}.
                      </p>
                      <Button 
                        onClick={() => handlePreEnrollmentPayment(enrollment)}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Pagar Pré-matrícula (R$ {enrollment.courses.pre_enrollment_fee.toFixed(2)})
                      </Button>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      disabled={generating === `${enrollment.id}-declaration`}
                      onClick={() => generateDocument(enrollment, 'declaration')}
                    >
                      {generating === `${enrollment.id}-declaration` ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Declaração de Matrícula
                        </>
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      disabled={generating === `${enrollment.id}-study_plan`}
                      onClick={() => generateDocument(enrollment, 'study_plan')}
                    >
                      {generating === `${enrollment.id}-study_plan` ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Plano de Estudos
                        </>
                      )}
                    </Button>
                  </div>
                 </div>
               </CardContent>
             </Card>
          ))}
        </div>
      )}

      {/* Payment Modal for Enrollment */}
      {showPaymentModal && selectedEnrollmentForPayment && (
        <PaymentModal
          preEnrollmentId={selectedEnrollmentForPayment.id}
          courseName={selectedEnrollmentForPayment.courses.name}
          amount={selectedEnrollmentForPayment.courses.enrollment_fee || 0}
          kind="enrollment"
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedEnrollmentForPayment(null);
          }}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}