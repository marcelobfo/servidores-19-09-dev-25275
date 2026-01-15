import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusFilter } from "@/components/student/filters/StatusFilter";
import { SearchFilter } from "@/components/student/filters/SearchFilter";
import { SortOptions } from "@/components/student/filters/SortOptions";
import { Clock, CheckCircle, XCircle, DollarSign, FileText, Calendar, Download, Mail, Receipt } from "lucide-react";
import { toast } from "sonner";

interface OrganType {
  id: string;
  name: string;
  hours_multiplier: number;
  is_federal: boolean;
}

interface PreEnrollment {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  cpf?: string;
  organization?: string;
  status: string;
  created_at: string;
  updated_at: string;
  organ_approval_confirmed: boolean;
  organ_approval_date?: string;
  custom_hours?: number;
  organ_type_id?: string;
  organ_types?: OrganType;
  license_start_date?: string;
  license_end_date?: string;
  courses: {
    id: string;
    name: string;
    pre_enrollment_fee?: number;
    enrollment_fee?: number;
    duration_hours?: number;
    start_date?: string;
    end_date?: string;
    modules?: string;
    description?: string;
  };
}

const statusLabels = {
  pending: "Pendente",
  pending_payment: "Aguardando Pagamento",
  approved: "Aprovada",
  rejected: "Rejeitada",
  payment_confirmed: "Pagamento Confirmado",
  waiting_organ_approval: "Aguardando Aprovação do Órgão",
};

const statuses = [
  { value: "pending", label: "Pendente" },
  { value: "pending_payment", label: "Aguardando Pagamento" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Rejeitada" },
  { value: "payment_confirmed", label: "Pagamento Confirmado" },
  { value: "waiting_organ_approval", label: "Aguardando Aprovação do Órgão" },
];

const sortOptions = [
  { value: "created_at_desc", label: "Mais recentes" },
  { value: "created_at_asc", label: "Mais antigas" },
  { value: "course_name", label: "Nome do curso" },
  { value: "status", label: "Status" },
];

export function PreEnrollmentsPage() {
  const { user } = useAuth();
  const [preEnrollments, setPreEnrollments] = useState<PreEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("created_at_desc");
  const [preEnrollmentPayments, setPreEnrollmentPayments] = useState<Record<string, number>>({});

  useEffect(() => {
    if (user) {
      fetchPreEnrollments();
    }
  }, [user]);

  const fetchPreEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from("pre_enrollments")
        .select(`
          *,
          license_start_date,
          license_end_date,
          courses (
            id,
            name,
            pre_enrollment_fee,
            enrollment_fee,
            duration_hours,
            start_date,
            end_date,
            modules,
            description
          )
        `)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Buscar tipos de órgãos para as pré-matrículas que têm organ_type_id
      const preEnrollmentsWithOrganTypes = await Promise.all(
        (data || []).map(async (pe: any) => {
          if (pe.organ_type_id) {
            const { data: organType } = await (supabase
              .from('organ_types' as any)
              .select('id, name, hours_multiplier, is_federal')
              .eq('id', pe.organ_type_id)
              .single() as any);
            return { ...pe, organ_types: organType || undefined };
          }
          return pe;
        })
      );
      
      setPreEnrollments(preEnrollmentsWithOrganTypes as PreEnrollment[]);
      
      // Buscar pagamentos confirmados de pré-matrícula para calcular descontos
      // REGRA DE OURO: Somar TODOS os pagamentos confirmados, não só o último
      if (data && data.length > 0) {
        const preEnrollmentIds = data.map(p => p.id);
        const { data: payments } = await supabase
          .from('payments')
          .select('pre_enrollment_id, amount')
          .eq('kind', 'pre_enrollment')
          .in('status', ['confirmed', 'received'])
          .in('pre_enrollment_id', preEnrollmentIds);
        
        // Somar todos os pagamentos confirmados por pre_enrollment_id
        const paymentMap: Record<string, number> = {};
        payments?.forEach(p => {
          const currentAmount = paymentMap[p.pre_enrollment_id] || 0;
          paymentMap[p.pre_enrollment_id] = currentAmount + Number(p.amount || 0);
        });
        console.log('📊 [PRE-ENROLLMENTS] Pagamentos confirmados somados:', paymentMap);
        setPreEnrollmentPayments(paymentMap);
      }
    } catch (error) {
      console.error("Error fetching pre-enrollments:", error);
      toast.error("Erro ao carregar pré-matrículas");
    } finally {
      setLoading(false);
    }
  };

  const handleOrganApproval = async (preEnrollmentId: string) => {
    try {
      const { error } = await supabase
        .from("pre_enrollments")
        .update({ 
          organ_approval_confirmed: true,
          organ_approval_date: new Date().toISOString()
        })
        .eq("id", preEnrollmentId);

      if (error) throw error;
      
      toast.success("Aprovação do órgão confirmada!");
      fetchPreEnrollments();
    } catch (error) {
      console.error("Error confirming organ approval:", error);
      toast.error("Erro ao confirmar aprovação do órgão");
    }
  };

  const [downloadingDeclarations, setDownloadingDeclarations] = useState<Set<string>>(new Set());
  const [downloadingStudyPlans, setDownloadingStudyPlans] = useState<Set<string>>(new Set());
  const [downloadingQuotes, setDownloadingQuotes] = useState<Set<string>>(new Set());

  const handleDownloadDeclaration = async (preEnrollment: PreEnrollment) => {
    try {
      setDownloadingDeclarations(prev => new Set(prev).add(preEnrollment.id));
      
      // Validar dados necessários
      if (!preEnrollment.cpf) {
        toast.error("CPF não encontrado na pré-matrícula. Entre em contato com o suporte.");
        return;
      }
      
      // Buscar configurações do sistema
      const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('*')
        .maybeSingle();
      
      if (settingsError) throw settingsError;
      
      if (!settings) {
        toast.error("Configurações do sistema não encontradas. Entre em contato com o suporte.");
        return;
      }
      
      // Validar campos do curso já carregados
      if (!preEnrollment.courses.duration_hours) {
        toast.error("Carga horária do curso não configurada. Entre em contato com o suporte.");
        return;
      }
      
      // Calcular carga horária efetiva baseada no tipo de órgão
      const durationHours = preEnrollment.courses.duration_hours || 390;
      const hoursMultiplier = preEnrollment.organ_types?.hours_multiplier || 1;
      const effectiveHours = preEnrollment.custom_hours || Math.round(durationHours * hoursMultiplier);
      
      // Gerar PDF usando pdfGenerator.ts
      const { generateEnrollmentDeclaration } = await import('@/lib/pdfGenerator');
      const pdfBlob = await generateEnrollmentDeclaration(
        {
          full_name: preEnrollment.full_name,
          cpf: preEnrollment.cpf,
          organization: preEnrollment.organization,
          phone: preEnrollment.phone,
          email: preEnrollment.email,
          course: {
            name: preEnrollment.courses.name,
            duration_hours: durationHours,
            effective_hours: effectiveHours,
            start_date: preEnrollment.license_start_date || preEnrollment.courses.start_date,
            end_date: preEnrollment.license_end_date || preEnrollment.courses.end_date
          }
        },
        settings
      );
      
      // Download do PDF
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = `declaracao-matricula-${preEnrollment.full_name.replace(/\s+/g, '-')}.pdf`;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success("Declaração baixada com sucesso!");
    } catch (error) {
      console.error("Error downloading declaration:", error);
      toast.error("Erro ao baixar declaração. Verifique se todos os dados estão completos.");
    } finally {
      setDownloadingDeclarations(prev => {
        const next = new Set(prev);
        next.delete(preEnrollment.id);
        return next;
      });
    }
  };

  const handleDownloadStudyPlan = async (preEnrollment: PreEnrollment) => {
    try {
      setDownloadingStudyPlans(prev => new Set(prev).add(preEnrollment.id));
      
      // Validar dados necessários
      if (!preEnrollment.cpf) {
        toast.error("CPF não encontrado na pré-matrícula. Entre em contato com o suporte.");
        return;
      }
      
      // Buscar configurações do sistema
      const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('*')
        .maybeSingle();
      
      if (settingsError) throw settingsError;
      
      if (!settings) {
        toast.error("Configurações do sistema não encontradas. Entre em contato com o suporte.");
        return;
      }
      
      // Validar campos do curso já carregados
      if (!preEnrollment.courses.duration_hours) {
        toast.error("Carga horária do curso não configurada. Entre em contato com o suporte.");
        return;
      }
      
      if (!preEnrollment.courses.modules) {
        toast.error("Módulos do curso não configurados. Entre em contato com o suporte.");
        return;
      }
      
      // Calcular carga horária efetiva baseada no tipo de órgão
      const durationHours = preEnrollment.courses.duration_hours || 390;
      const hoursMultiplier = preEnrollment.organ_types?.hours_multiplier || 1;
      const effectiveHours = preEnrollment.custom_hours || Math.round(durationHours * hoursMultiplier);
      
      // Gerar PDF usando pdfGenerator.ts
      const { generateStudyPlan } = await import('@/lib/pdfGenerator');
      const pdfBlob = await generateStudyPlan(
        {
          full_name: preEnrollment.full_name,
          cpf: preEnrollment.cpf,
          organization: preEnrollment.organization,
          phone: preEnrollment.phone,
          email: preEnrollment.email,
          course: {
            name: preEnrollment.courses.name,
            duration_hours: durationHours,
            effective_hours: effectiveHours,
            start_date: preEnrollment.license_start_date || preEnrollment.courses.start_date,
            end_date: preEnrollment.license_end_date || preEnrollment.courses.end_date,
            modules: preEnrollment.courses.modules,
            description: preEnrollment.courses.description
          }
        },
        settings
      );
      
      // Download do PDF
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = `plano-estudos-${preEnrollment.full_name.replace(/\s+/g, '-')}.pdf`;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success("Plano de estudos baixado com sucesso!");
    } catch (error) {
      console.error("Error downloading study plan:", error);
      toast.error("Erro ao baixar plano de estudos. Verifique se todos os dados estão completos.");
    } finally {
      setDownloadingStudyPlans(prev => {
        const next = new Set(prev);
        next.delete(preEnrollment.id);
        return next;
      });
    }
  };

  const handleDownloadQuote = async (preEnrollment: PreEnrollment) => {
    try {
      setDownloadingQuotes(prev => new Set(prev).add(preEnrollment.id));
      
      // Buscar configurações do sistema
      const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('*')
        .maybeSingle();
      
      if (settingsError) throw settingsError;
      
      if (!settings) {
        toast.error("Configurações do sistema não encontradas. Entre em contato com o suporte.");
        return;
      }
      
      // Verificar se há pagamento de pré-matrícula confirmado
      const preEnrollmentPaid = preEnrollmentPayments[preEnrollment.id] !== undefined;
      const preEnrollmentAmount = preEnrollmentPayments[preEnrollment.id] || 0;
      
      // Calcular carga horária efetiva baseada no tipo de órgão
      const durationHours = preEnrollment.courses.duration_hours || 390;
      const hoursMultiplier = preEnrollment.organ_types?.hours_multiplier || 1;
      const effectiveHours = preEnrollment.custom_hours || Math.round(durationHours * hoursMultiplier);
      
      // Gerar PDF usando pdfGenerator.ts
      const { generateQuote } = await import('@/lib/pdfGenerator');
      const pdfBlob = await generateQuote(
        {
          full_name: preEnrollment.full_name,
          cpf: preEnrollment.cpf,
          organization: preEnrollment.organization,
          phone: preEnrollment.phone,
          email: preEnrollment.email,
          course: {
            name: preEnrollment.courses.name,
            duration_hours: durationHours,
            effective_hours: effectiveHours,
            start_date: preEnrollment.license_start_date || preEnrollment.courses.start_date,
            end_date: preEnrollment.license_end_date || preEnrollment.courses.end_date,
            pre_enrollment_fee: preEnrollment.courses.pre_enrollment_fee,
            enrollment_fee: preEnrollment.courses.enrollment_fee
          }
        },
        settings,
        preEnrollmentPaid,
        preEnrollmentAmount
      );
      
      // Download do PDF
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = `orcamento-${preEnrollment.full_name.replace(/\s+/g, '-')}.pdf`;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success("Orçamento baixado com sucesso!");
    } catch (error) {
      console.error("Error downloading quote:", error);
      toast.error("Erro ao baixar orçamento. Verifique se todos os dados estão completos.");
    } finally {
      setDownloadingQuotes(prev => {
        const next = new Set(prev);
        next.delete(preEnrollment.id);
        return next;
      });
    }
  };

  // Função para calcular o valor final da matrícula com desconto da pré-matrícula
  const getEnrollmentFinalAmount = (preEnrollment: PreEnrollment): { enrollmentFee: number; discount: number; finalAmount: number } => {
    const enrollmentFee = preEnrollment.courses.enrollment_fee || 0;
    const preEnrollmentPaid = preEnrollmentPayments[preEnrollment.id] || 0;
    const finalAmount = Math.max(enrollmentFee - preEnrollmentPaid, 5); // Mínimo R$ 5,00 (Asaas)
    return { enrollmentFee, discount: preEnrollmentPaid, finalAmount };
  };

  const handleEnrollment = async (preEnrollment: PreEnrollment) => {
    try {
      const { enrollmentFee, discount, finalAmount } = getEnrollmentFinalAmount(preEnrollment);
      
      console.log('🎓 [ENROLLMENT] Iniciando processo de matrícula');
      console.log('📋 Pré-matrícula ID:', preEnrollment.id);
      console.log('💰 Taxa de matrícula original:', enrollmentFee);
      console.log('💸 Desconto (pré-matrícula paga):', discount);
      console.log('💵 Valor final:', finalAmount);
      
      // Se há taxa de matrícula, redirecionar para checkout Asaas
      if (enrollmentFee > 0) {
        // Verificar se já existe uma matrícula para esta pré-matrícula
        const { data: existingEnrollment, error: checkError } = await supabase
          .from("enrollments")
          .select('*')
          .eq('pre_enrollment_id', preEnrollment.id)
          .maybeSingle();

        if (checkError) {
          console.error('❌ [ENROLLMENT] Erro ao verificar enrollment existente:', checkError);
          throw checkError;
        }

        let enrollmentId: string;

        if (existingEnrollment) {
          console.log('📌 [ENROLLMENT] Matrícula já existe:', existingEnrollment.id);
          console.log('📊 [ENROLLMENT] Status:', existingEnrollment.status);
          
          // Se já está ativa e paga, informar o usuário
          if (existingEnrollment.status === 'active' && existingEnrollment.payment_status === 'paid') {
            toast.info("Matrícula já foi realizada e paga!");
            window.location.href = "/student/enrollments";
            return;
          }
          
          // Reutilizar a matrícula existente
          enrollmentId = existingEnrollment.id;
          console.log('♻️ [ENROLLMENT] Reutilizando matrícula existente');
        } else {
          // Criar nova matrícula com status pending_payment e valor COM DESCONTO
          const { data: newEnrollment, error: enrollmentError } = await supabase
            .from("enrollments")
            .insert({
              user_id: user?.id,
              course_id: preEnrollment.courses.id,
              pre_enrollment_id: preEnrollment.id,
              status: "pending_payment",
              payment_status: "pending",
              enrollment_amount: finalAmount // CORRIGIDO: usar valor com desconto
            })
            .select()
            .single();

          if (enrollmentError) {
            console.error('❌ [ENROLLMENT] Erro ao criar enrollment:', enrollmentError);
            throw enrollmentError;
          }

          enrollmentId = newEnrollment.id;
          console.log('✅ [ENROLLMENT] Nova matrícula criada:', enrollmentId);
        }

        // Chamar edge function específica para criar checkout de matrícula
        console.log('🔄 [ENROLLMENT] Chamando edge function create-enrollment-checkout...');
        const { data, error } = await supabase.functions.invoke('create-enrollment-checkout', {
          body: {
            pre_enrollment_id: preEnrollment.id,
            enrollment_id: enrollmentId
          }
        });

        console.log('✅ [ENROLLMENT] Resposta da edge function:', data);

        if (error) {
          console.error('❌ [ENROLLMENT] Erro da edge function:', error);
          throw error;
        }

        if (data?.checkout_url) {
          console.log('✅ [ENROLLMENT] Checkout criado:', data.checkout_url);
          toast.success("Checkout criado! Redirecionando para pagamento...");
          
          // Redirecionar para o checkout do Asaas
          setTimeout(() => {
            window.location.href = data.checkout_url;
          }, 1000);
        } else {
          throw new Error('Resposta inválida da função de checkout');
        }
        return;
      }
      
      // Se não há taxa, criar matrícula diretamente com status ativo
      // Verificar se já existe matrícula
      const { data: existingFreeEnrollment } = await supabase
        .from("enrollments")
        .select('*')
        .eq('pre_enrollment_id', preEnrollment.id)
        .maybeSingle();

      if (existingFreeEnrollment) {
        toast.info("Matrícula já foi realizada!");
        window.location.href = "/student/enrollments";
        return;
      }

      const { error } = await supabase
        .from("enrollments")
        .insert({
          user_id: user?.id,
          course_id: preEnrollment.courses.id,
          pre_enrollment_id: preEnrollment.id,
          status: "active",
          payment_status: "paid",
          enrollment_date: new Date().toISOString(),
          enrollment_amount: 0
        });

      if (error) throw error;

      toast.success("Matrícula realizada com sucesso!");
      window.location.href = "/student/enrollments";
    } catch (error) {
      console.error("Error creating enrollment:", error);
      toast.error("Erro ao realizar matrícula");
    }
  };

  const handlePreEnrollmentPayment = async (preEnrollment: PreEnrollment) => {
    try {
      console.log('💳 [PRE-ENROLLMENT] Iniciando checkout de pré-matrícula');
      console.log('📋 Pre-enrollment ID:', preEnrollment.id);
      console.log('💰 Valor:', preEnrollment.courses.pre_enrollment_fee);

      const { data, error } = await supabase.functions.invoke('create-enrollment-checkout', {
        body: {
          pre_enrollment_id: preEnrollment.id
        }
      });

      console.log('✅ [PRE-ENROLLMENT] Resposta da edge function:', data);

      if (error) {
        console.error('❌ [PRE-ENROLLMENT] Erro:', error);
        throw error;
      }

      if (data?.checkout_url) {
        console.log('🔗 [PRE-ENROLLMENT] Redirecionando para:', data.checkout_url);
        
        // ETAPA 5: Mostrar toast com link antes de redirecionar
        toast.success(
          "Checkout criado com sucesso! Redirecionando...",
          { 
            duration: 10000,
            description: data.reused ? "Reutilizando checkout existente" : undefined
          }
        );
        
        // Aguardar um momento antes de redirecionar
        setTimeout(() => {
          window.location.href = data.checkout_url;
        }, 1000);
      } else {
        throw new Error("URL de checkout não foi gerada");
      }
    } catch (error) {
      console.error("Error creating pre-enrollment checkout:", error);
      toast.error(
        "Erro ao gerar checkout. Verifique se todos os dados estão preenchidos ou entre em contato com o suporte."
      );
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
      case "pending_payment":
        return <Clock className="h-4 w-4" />;
      case "approved":
      case "payment_confirmed":
        return <CheckCircle className="h-4 w-4" />;
      case "rejected":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === "approved" || status === "payment_confirmed" 
      ? "default" 
      : status === "rejected" 
        ? "destructive" 
        : "secondary";

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {statusLabels[status as keyof typeof statusLabels] || status}
      </Badge>
    );
  };

  const filteredAndSortedPreEnrollments = preEnrollments
    .filter(preEnrollment => {
      if (statusFilter !== "all" && preEnrollment.status !== statusFilter) {
        return false;
      }
      if (searchTerm && !preEnrollment.courses.name.toLowerCase().includes(searchTerm.toLowerCase())) {
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
        <h1 className="text-2xl font-bold text-foreground">Minhas Pré-matrículas</h1>
        <p className="text-muted-foreground">
          Acompanhe suas solicitações de pré-matrícula e seus status
        </p>
      </div>

      {preEnrollments.some(p => p.status === 'pending' && !p.courses.pre_enrollment_fee) && (
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-900 dark:text-yellow-100">
                  Taxa de pré-matrícula não configurada
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                  A taxa de pré-matrícula não está configurada para alguns cursos. 
                  Entre em contato com o administrador.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {filteredAndSortedPreEnrollments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma pré-matrícula encontrada</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm || statusFilter !== "all" 
                ? "Tente ajustar os filtros para ver mais resultados."
                : "Você ainda não possui pré-matrículas. Navegue pelos cursos disponíveis para se inscrever."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAndSortedPreEnrollments.map((preEnrollment) => (
            <Card key={preEnrollment.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{preEnrollment.courses.name}</CardTitle>
                    <CardDescription>
                      Solicitado em {new Date(preEnrollment.created_at).toLocaleDateString("pt-BR")}
                    </CardDescription>
                  </div>
                  {getStatusBadge(preEnrollment.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Nome:</strong> {preEnrollment.full_name}
                    </div>
                    <div>
                      <strong>Email:</strong> {preEnrollment.email}
                    </div>
                    {preEnrollment.phone && (
                      <div>
                        <strong>Telefone:</strong> {preEnrollment.phone}
                      </div>
                    )}
                    <div>
                      <strong>Última atualização:</strong>{" "}
                      {new Date(preEnrollment.updated_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>

                  {/* Botão de Orçamento - sempre disponível */}
                  <div className="bg-muted/50 border border-border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Baixe o orçamento detalhado do curso:
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => handleDownloadQuote(preEnrollment)}
                      size="sm"
                      disabled={downloadingQuotes.has(preEnrollment.id)}
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      {downloadingQuotes.has(preEnrollment.id) ? 'Baixando...' : 'Baixar Orçamento'}
                    </Button>
                  </div>

                  {(preEnrollment.status === "payment_confirmed" || preEnrollment.status === "approved") && !preEnrollment.organ_approval_confirmed && (
                    <>
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                          Pagamento confirmado! Baixe os documentos para apresentar ao seu órgão:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => handleDownloadDeclaration(preEnrollment)}
                            size="sm"
                            disabled={downloadingDeclarations.has(preEnrollment.id)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            {downloadingDeclarations.has(preEnrollment.id) ? 'Baixando...' : 'Declaração de Matrícula'}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleDownloadStudyPlan(preEnrollment)}
                            size="sm"
                            disabled={downloadingStudyPlans.has(preEnrollment.id)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            {downloadingStudyPlans.has(preEnrollment.id) ? 'Baixando...' : 'Plano de Estudos'}
                          </Button>
                        </div>
                      </div>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                          Após apresentar os documentos ao órgão e receber a aprovação, clique no botão abaixo:
                        </p>
                        <Button
                          onClick={() => handleOrganApproval(preEnrollment.id)}
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Confirmar Aprovação do Órgão
                        </Button>
                      </div>
                    </>
                  )}

                  {preEnrollment.status === "pending" && preEnrollment.courses.pre_enrollment_fee && !preEnrollment.organ_approval_confirmed && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                        Pague a taxa de pré-matrícula para prosseguir com sua solicitação.
                      </p>
                      <Button
                        onClick={() => handlePreEnrollmentPayment(preEnrollment)}
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <DollarSign className="h-4 w-4" />
                        Pagar Taxa - R$ {preEnrollment.courses.pre_enrollment_fee}
                      </Button>
                    </div>
                  )}

                  {preEnrollment.status === "pending_payment" && preEnrollment.courses.pre_enrollment_fee && !preEnrollment.organ_approval_confirmed && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Mail className="h-5 w-5 text-orange-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-1">
                            Pagamento pendente
                          </p>
                          <p className="text-sm text-orange-700 dark:text-orange-300 mb-2">
                            Verifique seu e-mail <strong>{preEnrollment.email}</strong> para acessar o link de pagamento.
                          </p>
                          <p className="text-xs text-orange-600 dark:text-orange-400">
                            O link de pagamento também foi enviado por e-mail e é válido por 60 minutos.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bloco de matrícula liberada - aparece quando:
                      1) Status é "approved" (aprovado diretamente), OU
                      2) organ_approval_confirmed E status é payment_confirmed/approved */}
                  {(preEnrollment.status === "approved" || (preEnrollment.organ_approval_confirmed && (preEnrollment.status === "payment_confirmed" || preEnrollment.status === "approved"))) && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200 mb-3">
                        <CheckCircle className="h-4 w-4" />
                        Aprovação do órgão confirmada em{" "}
                        {preEnrollment.organ_approval_date && 
                          new Date(preEnrollment.organ_approval_date).toLocaleDateString("pt-BR")
                        }
                      </div>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                        Órgão aprovado! Agora você pode realizar sua matrícula no curso.
                      </p>
                      
                      {/* Botões de download dos documentos */}
                      <div className="mb-4">
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                          Baixe novamente os documentos se necessário:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handleDownloadDeclaration(preEnrollment)}
                            size="sm"
                            disabled={downloadingDeclarations.has(preEnrollment.id)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            {downloadingDeclarations.has(preEnrollment.id) ? 'Baixando...' : 'Declaração de Matrícula'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleDownloadStudyPlan(preEnrollment)}
                            size="sm"
                            disabled={downloadingStudyPlans.has(preEnrollment.id)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            {downloadingStudyPlans.has(preEnrollment.id) ? 'Baixando...' : 'Plano de Estudos'}
                          </Button>
                        </div>
                      </div>
                      
                      {/* Exibir informação do desconto se houver pagamento de pré-matrícula */}
                      {preEnrollmentPayments[preEnrollment.id] && preEnrollment.courses.enrollment_fee && (
                        <div className="mb-3 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
                          <div className="flex items-center gap-2 text-green-800 dark:text-green-200 text-sm font-medium mb-1">
                            <DollarSign className="h-4 w-4" />
                            Desconto aplicado!
                          </div>
                          <div className="text-sm text-green-700 dark:text-green-300">
                            <span className="line-through text-muted-foreground">
                              Valor original: R$ {preEnrollment.courses.enrollment_fee?.toFixed(2)}
                            </span>
                            <br />
                            <span>
                              Desconto (pré-matrícula): - R$ {preEnrollmentPayments[preEnrollment.id]?.toFixed(2)}
                            </span>
                            <br />
                            <strong className="text-green-800 dark:text-green-100">
                              Valor final: R$ {Math.max((preEnrollment.courses.enrollment_fee || 0) - preEnrollmentPayments[preEnrollment.id], 5).toFixed(2)}
                            </strong>
                          </div>
                        </div>
                      )}
                      
                      <Button
                        onClick={() => handleEnrollment(preEnrollment)}
                        size="lg"
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Realizar Matrícula
                        {preEnrollmentPayments[preEnrollment.id] && preEnrollment.courses.enrollment_fee && (
                          <span className="ml-1">
                            - R$ {Math.max((preEnrollment.courses.enrollment_fee || 0) - preEnrollmentPayments[preEnrollment.id], 5).toFixed(2)}
                          </span>
                        )}
                      </Button>
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