import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusFilter } from "@/components/student/filters/StatusFilter";
import { SearchFilter } from "@/components/student/filters/SearchFilter";
import { SortOptions } from "@/components/student/filters/SortOptions";
import { Clock, CheckCircle, DollarSign, FileText, Calendar, Download, Award, RefreshCw, Percent } from "lucide-react";
import { toast } from "sonner";

interface DiscountInfo {
  preEnrollmentPaid: number;
  originalFee: number;
  finalAmount: number;
}

interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  payment_status: string;
  enrollment_amount?: number;
  enrollment_date?: string;
  created_at: string;
  updated_at: string;
  courses: {
    id: string;
    name: string;
    enrollment_fee?: number;
    duration_days?: number;
  };
  pre_enrollments: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

const statusLabels = {
  awaiting_payment: "Aguardando Pagamento",
  active: "Ativa",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const paymentStatusLabels = {
  pending: "Pendente",
  paid: "Pago",
  failed: "Falhou",
};

const statuses = [
  { value: "awaiting_payment", label: "Aguardando Pagamento" },
  { value: "active", label: "Ativa" },
  { value: "completed", label: "Concluída" },
  { value: "cancelled", label: "Cancelada" },
];

const sortOptions = [
  { value: "created_at_desc", label: "Mais recentes" },
  { value: "created_at_asc", label: "Mais antigas" },
  { value: "course_name", label: "Nome do curso" },
  { value: "status", label: "Status" },
];

export function EnrollmentsPage() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("created_at_desc");
  const [generatingPayment, setGeneratingPayment] = useState(false);
  const [generatingDiscountedPayment, setGeneratingDiscountedPayment] = useState(false);
  const [discountInfoMap, setDiscountInfoMap] = useState<Record<string, DiscountInfo>>({});

  useEffect(() => {
    if (user) {
      fetchEnrollments();
    }
  }, [user]);

  // Realtime subscription for automatic enrollment status updates
  useEffect(() => {
    if (!user) return;

    console.log('🔔 [REALTIME] Inscrevendo para atualizações de matrículas do usuário:', user.id);

    const channel = supabase
      .channel('enrollments-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrollments',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 [REALTIME] Matrícula atualizada:', payload);
          // Recarregar lista quando houver mudança
          fetchEnrollments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments'
        },
        (payload) => {
          console.log('🔔 [REALTIME] Pagamento atualizado:', payload);
          const newStatus = (payload.new as any).status;
          if (newStatus === 'confirmed' || newStatus === 'received') {
            toast.success('Pagamento confirmado! Atualizando lista...');
            fetchEnrollments();
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 [REALTIME] Status da subscription:', status);
      });

    return () => {
      console.log('🔔 [REALTIME] Removendo subscription de matrículas');
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Buscar informações de desconto para matrículas pendentes
  // REGRA DE OURO: Somar TODOS os pagamentos confirmados, não só o último
  const fetchDiscountInfo = async (enrollmentsList: Enrollment[]) => {
    const pendingEnrollments = enrollmentsList.filter(
      e => (e.status === 'pending_payment' || e.status === 'awaiting_payment') && e.pre_enrollments?.id
    );
    
    if (pendingEnrollments.length === 0) return;
    
    const preEnrollmentIds = pendingEnrollments.map(e => e.pre_enrollments!.id);
    
    const { data: payments } = await supabase
      .from('payments')
      .select('pre_enrollment_id, amount')
      .eq('kind', 'pre_enrollment')
      .in('status', ['confirmed', 'received'])
      .in('pre_enrollment_id', preEnrollmentIds);
    
    if (!payments) return;
    
    // Somar todos os pagamentos confirmados por pre_enrollment_id
    const paymentTotals: Record<string, number> = {};
    payments.forEach(p => {
      const currentAmount = paymentTotals[p.pre_enrollment_id] || 0;
      paymentTotals[p.pre_enrollment_id] = currentAmount + Number(p.amount || 0);
    });
    
    console.log('📊 [ENROLLMENTS] Pagamentos confirmados somados:', paymentTotals);
    
    const newDiscountMap: Record<string, DiscountInfo> = {};
    
    pendingEnrollments.forEach(enrollment => {
      const preEnrollmentId = enrollment.pre_enrollments?.id;
      const totalPaid = preEnrollmentId ? paymentTotals[preEnrollmentId] || 0 : 0;
      
      if (totalPaid > 0) {
        const originalFee = enrollment.courses.enrollment_fee || 0;
        const finalAmount = Math.max(originalFee - totalPaid, 5);
        
        newDiscountMap[enrollment.id] = {
          preEnrollmentPaid: totalPaid,
          originalFee,
          finalAmount
        };
      }
    });
    
    setDiscountInfoMap(newDiscountMap);
  };

  const fetchEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          *,
          courses (
            id,
            name,
            enrollment_fee,
            duration_days
          ),
          pre_enrollments (
            id,
            full_name,
            email
          )
        `)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEnrollments(data || []);
      
      // Buscar informações de desconto para matrículas pendentes
      if (data) {
        await fetchDiscountInfo(data);
      }
    } catch (error) {
      console.error("Error fetching enrollments:", error);
      toast.error("Erro ao carregar matrículas");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEnrollmentPayment = async (enrollment: Enrollment) => {
    try {
      setGeneratingPayment(true);
      
      console.log('💳 [ENROLLMENT-CHECKOUT] Gerando checkout de matrícula');
      console.log('📋 Enrollment ID:', enrollment.id);
      console.log('📋 Pre-Enrollment ID:', enrollment.pre_enrollments?.id);
      console.log('💰 Valor:', enrollment.courses.enrollment_fee);

      // Refresh session before calling Edge Function
      console.log('🔄 [ENROLLMENT-CHECKOUT] Renovando sessão...');
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !session) {
        toast.error('Sessão expirada. Por favor, faça login novamente.');
        return;
      }
      console.log('✅ [ENROLLMENT-CHECKOUT] Sessão renovada');

      const { data, error } = await supabase.functions.invoke('create-enrollment-checkout', {
        body: {
          pre_enrollment_id: enrollment.pre_enrollments?.id,
          enrollment_id: enrollment.id
        }
      });

      if (error) {
        console.error("❌ [ENROLLMENT-CHECKOUT] Erro:", error);
        toast.error("Erro ao gerar checkout. Tente novamente.");
        throw error;
      }

      if (data?.checkout_url) {
        console.log('✅ [ENROLLMENT-CHECKOUT] Checkout criado:', data.checkout_url);
        toast.success("Checkout criado! Redirecionando para pagamento...");
        
        // Redirecionar para o checkout Asaas
        setTimeout(() => {
          window.location.href = data.checkout_url;
        }, 1000);
        
        // Recarregar lista após redirecionamento
        setTimeout(() => {
          fetchEnrollments();
        }, 2000);
      } else {
        throw new Error('Resposta inválida da função de checkout');
      }
    } catch (error) {
      console.error("Error generating enrollment checkout:", error);
      toast.error("Erro ao gerar checkout. Tente novamente.");
    } finally {
      setGeneratingPayment(false);
    }
  };

  // Função para checkout com desconto
  // REGRA: o BACKEND calcula e aplica o desconto; o front não envia valor.
  const handleGenerateDiscountedCheckout = async (enrollment: Enrollment, finalAmount: number) => {
    try {
      setGeneratingDiscountedPayment(true);
      
      console.log('💰 [DISCOUNTED-CHECKOUT] Gerando checkout com desconto DIRETO');
      console.log('📋 Enrollment ID:', enrollment.id);
      console.log('📋 Pre-Enrollment ID:', enrollment.pre_enrollments?.id);
      console.log('💵 Valor exibido (front):', finalAmount);

      // Refresh session before calling Edge Function
      console.log('🔄 [DISCOUNTED-CHECKOUT] Renovando sessão...');
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !session) {
        toast.error('Sessão expirada. Por favor, faça login novamente.');
        return;
      }
      console.log('✅ [DISCOUNTED-CHECKOUT] Sessão renovada');

      // Usa create-enrollment-checkout e força recálculo (servidor aplica desconto)
      const { data, error } = await supabase.functions.invoke('create-enrollment-checkout', {
        body: {
          pre_enrollment_id: enrollment.pre_enrollments?.id,
          enrollment_id: enrollment.id,
          force_recalculate: true
        }
      });

      if (error) {
        console.error("❌ [DISCOUNTED-CHECKOUT] Erro:", error);
        toast.error("Erro ao gerar checkout. Tente novamente.");
        throw error;
      }

      if (data?.checkout_url) {
        console.log('✅ [DISCOUNTED-CHECKOUT] Checkout criado:', data.checkout_url);
        
        toast.success(`Checkout com desconto criado! Valor: R$ ${finalAmount.toFixed(2)}. Redirecionando...`);
        
        setTimeout(() => {
          window.location.href = data.checkout_url;
        }, 1000);
        
        setTimeout(() => {
          fetchEnrollments();
        }, 2000);
      } else {
        throw new Error('Resposta inválida da função de checkout');
      }
    } catch (error) {
      console.error("Error generating discounted checkout:", error);
      toast.error("Erro ao gerar checkout. Tente novamente.");
    } finally {
      setGeneratingDiscountedPayment(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "awaiting_payment":
        return <DollarSign className="h-4 w-4" />;
      case "active":
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === "active" || status === "completed"
      ? "default" 
      : status === "cancelled" 
        ? "destructive" 
        : "secondary";

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {statusLabels[status as keyof typeof statusLabels] || status}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (paymentStatus: string) => {
    const variant = paymentStatus === "paid"
      ? "default" 
      : paymentStatus === "failed" 
        ? "destructive" 
        : "secondary";

    return (
      <Badge variant={variant} className="text-xs">
        {paymentStatusLabels[paymentStatus as keyof typeof paymentStatusLabels] || paymentStatus}
      </Badge>
    );
  };

  const calculateCertificateAvailability = (enrollment: Enrollment): {
    isAvailable: boolean;
    availableDate: Date | null;
    daysRemaining: number;
  } => {
    if (!enrollment.enrollment_date || !enrollment.courses.duration_days) {
      return { isAvailable: false, availableDate: null, daysRemaining: 0 };
    }

    const enrollmentDate = new Date(enrollment.enrollment_date);
    const durationDays = enrollment.courses.duration_days;
    const availableDate = new Date(enrollmentDate);
    availableDate.setDate(availableDate.getDate() + durationDays + 1);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    availableDate.setHours(0, 0, 0, 0);

    const isAvailable = today >= availableDate;
    const daysRemaining = Math.ceil((availableDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return { isAvailable, availableDate, daysRemaining };
  };

  const handleDownloadCertificate = async (enrollmentId: string) => {
    try {
      toast.info("Gerando certificado...");
      
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('enrollment_id', enrollmentId)
        .single();

      if (error) {
        // Certificate doesn't exist, needs to be generated
        toast.info("Certificado será gerado em breve");
        return;
      }

      toast.success("Certificado baixado!");
    } catch (error) {
      console.error("Error downloading certificate:", error);
      toast.error("Erro ao baixar certificado");
    }
  };

  const filteredAndSortedEnrollments = enrollments
    .filter(enrollment => {
      if (statusFilter !== "all" && enrollment.status !== statusFilter) {
        return false;
      }
      if (searchTerm && !enrollment.courses.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "created_at_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "course_name":
          return a.courses.name.localeCompare(b.courses.name);
        case "status":
          return a.status.localeCompare(b.status);
        default: // created_at_desc
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Fallback se não houver usuário após o carregamento
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-2">Sessão Expirada</h2>
          <p className="text-muted-foreground mb-6">
            Sua sessão expirou ou é inválida. Por favor, faça login novamente para continuar.
          </p>
          <Button onClick={() => {
            localStorage.clear();
            window.location.href = '/auth';
          }}>
            Fazer Login Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Minhas Matrículas</h1>
        <p className="text-muted-foreground">
          Acompanhe suas matrículas ativas e o progresso dos seus cursos
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchFilter
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por nome do curso..."
        />
        <StatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
          statuses={statuses}
        />
        <SortOptions
          value={sortBy}
          onChange={setSortBy}
          options={sortOptions}
        />
      </div>

      {filteredAndSortedEnrollments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma matrícula encontrada</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm || statusFilter !== "all" 
                ? "Tente ajustar os filtros para ver mais resultados."
                : "Você ainda não possui matrículas ativas."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAndSortedEnrollments.map((enrollment) => (
            <Card key={enrollment.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{enrollment.courses.name}</CardTitle>
                    <CardDescription>
                      Matrícula criada em {new Date(enrollment.created_at).toLocaleDateString("pt-BR")}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2">
                    {getStatusBadge(enrollment.status)}
                    {getPaymentStatusBadge(enrollment.payment_status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Estudante:</strong> {enrollment.pre_enrollments?.full_name || "Não informado"}
                    </div>
                    <div>
                      <strong>Email:</strong> {enrollment.pre_enrollments?.email || "Não informado"}
                    </div>
                    {enrollment.enrollment_date && (
                      <div>
                        <strong>Data da matrícula:</strong>{" "}
                        {new Date(enrollment.enrollment_date).toLocaleDateString("pt-BR")}
                      </div>
                    )}
                    {enrollment.enrollment_amount && (
                      <div>
                        <strong>Valor:</strong> R$ {enrollment.enrollment_amount}
                      </div>
                    )}
                  </div>

                  {(enrollment.status === "awaiting_payment" || enrollment.status === "pending_payment") && enrollment.payment_status === "pending" && (() => {
                    // Calcular se há desconto baseado no enrollment_amount vs enrollment_fee
                    const enrollmentFee = enrollment.courses.enrollment_fee || 0;
                    const enrollmentAmount = enrollment.enrollment_amount || enrollmentFee;
                    
                    // Usar discountInfoMap se disponível
                    const discountInfo = discountInfoMap[enrollment.id];
                    
                    // Heurística: se enrollment_amount é muito pequeno (< 20% do fee e > 0),
                    // provavelmente foi gravado como o valor do DESCONTO, não o valor final
                    const likelyIsDiscountValue = enrollmentAmount < (enrollmentFee * 0.2) && enrollmentAmount > 0;
                    
                    let displayOriginalFee: number;
                    let displayDiscount: number;
                    let displayFinalAmount: number;
                    let hasDiscount: boolean;
                    
                    if (discountInfo) {
                      // Usar dados do discountInfoMap se disponível
                      displayOriginalFee = discountInfo.originalFee;
                      displayDiscount = discountInfo.preEnrollmentPaid;
                      displayFinalAmount = discountInfo.finalAmount;
                      hasDiscount = displayDiscount > 0;
                    } else if (likelyIsDiscountValue) {
                      // enrollment_amount foi gravado como o valor do desconto (ex: R$ 67)
                      displayOriginalFee = enrollmentFee;
                      displayDiscount = enrollmentAmount; // R$ 67 é o desconto
                      displayFinalAmount = enrollmentFee - enrollmentAmount; // R$ 679 - R$ 67 = R$ 612
                      hasDiscount = true;
                    } else if (enrollmentAmount < enrollmentFee) {
                      // enrollment_amount é o valor final (comportamento esperado)
                      displayOriginalFee = enrollmentFee;
                      displayDiscount = enrollmentFee - enrollmentAmount;
                      displayFinalAmount = enrollmentAmount;
                      hasDiscount = true;
                    } else {
                      // Sem desconto
                      displayOriginalFee = enrollmentFee;
                      displayDiscount = 0;
                      displayFinalAmount = enrollmentFee;
                      hasDiscount = false;
                    }
                    
                    return (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                        <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
                          Pagamento da matrícula pendente. Clique para gerar o checkout de pagamento.
                        </p>
                        
                        {/* Exibir informação do desconto se houver */}
                        {hasDiscount && displayDiscount > 0 && (
                          <div className="mb-3 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
                            <div className="flex items-center gap-2 text-green-800 dark:text-green-200 text-sm font-medium mb-1">
                              <CheckCircle className="h-4 w-4" />
                              Desconto de pré-matrícula aplicado!
                            </div>
                            <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                              <div className="line-through text-muted-foreground">
                                Valor original: R$ {displayOriginalFee.toFixed(2)}
                              </div>
                              <div className="text-green-600 dark:text-green-400">
                                Desconto: - R$ {displayDiscount.toFixed(2)}
                              </div>
                              <div className="font-bold text-green-800 dark:text-green-100 text-base">
                                Valor a pagar: R$ {displayFinalAmount.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-2">
                          {hasDiscount && displayDiscount > 0 ? (
                            <>
                              {/* Botão 1: Pagar valor cheio */}
                              <Button
                                onClick={() => handleGenerateEnrollmentPayment(enrollment)}
                                size="sm"
                                variant="outline"
                                className="flex items-center gap-2"
                                disabled={generatingPayment || generatingDiscountedPayment}
                              >
                                <DollarSign className="h-4 w-4" />
                                {generatingPayment ? "Gerando..." : `Pagar Valor Cheio - R$ ${displayOriginalFee.toFixed(2)}`}
                              </Button>
                              
                              {/* Botão 2: Pagar com desconto */}
                              <Button
                                onClick={() => handleGenerateDiscountedCheckout(enrollment, displayFinalAmount)}
                                size="sm"
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                                disabled={generatingPayment || generatingDiscountedPayment}
                              >
                                <Percent className="h-4 w-4" />
                                {generatingDiscountedPayment 
                                  ? "Gerando..." 
                                  : `Pagar com Desconto - R$ ${displayFinalAmount.toFixed(2)}`
                                }
                              </Button>
                            </>
                          ) : (
                            <Button
                              onClick={() => handleGenerateEnrollmentPayment(enrollment)}
                              size="sm"
                              className="flex items-center gap-2"
                              disabled={generatingPayment}
                            >
                              <DollarSign className="h-4 w-4" />
                              {generatingPayment ? "Gerando..." : `Pagar Matrícula - R$ ${displayOriginalFee.toFixed(2)}`}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {enrollment.status === "active" && (
                    <>
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                          <CheckCircle className="h-4 w-4" />
                          Matrícula ativa! Você pode acessar o conteúdo do curso.
                        </div>
                      </div>

                      {(() => {
                        const certInfo = calculateCertificateAvailability(enrollment);
                        
                        if (certInfo.isAvailable) {
                          return (
                            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                              <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                                Parabéns! Você concluiu o curso e pode baixar seu certificado.
                              </p>
                              <Button
                                onClick={() => handleDownloadCertificate(enrollment.id)}
                                size="lg"
                                className="flex items-center gap-2"
                              >
                                <Award className="h-4 w-4" />
                                Baixar Certificado
                              </Button>
                            </div>
                          );
                        } else if (certInfo.availableDate) {
                          return (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                              <p className="text-sm text-blue-800 dark:text-blue-200">
                                Certificado estará disponível em{" "}
                                <strong>{certInfo.availableDate.toLocaleDateString("pt-BR")}</strong>
                                {certInfo.daysRemaining > 0 && ` (${certInfo.daysRemaining} dias restantes)`}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </>
                  )}

                  {enrollment.status === "completed" && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm text-purple-800 dark:text-purple-200">
                        <CheckCircle className="h-4 w-4" />
                        Curso concluído! Parabéns pela sua dedicação.
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}