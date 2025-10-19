import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusFilter } from "@/components/student/filters/StatusFilter";
import { SearchFilter } from "@/components/student/filters/SearchFilter";
import { SortOptions } from "@/components/student/filters/SortOptions";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { Clock, CheckCircle, XCircle, DollarSign, FileText, Calendar } from "lucide-react";
import { toast } from "sonner";

interface PreEnrollment {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  status: string;
  created_at: string;
  updated_at: string;
  organ_approval_confirmed: boolean;
  organ_approval_date?: string;
  courses: {
    id: string;
    name: string;
    pre_enrollment_fee?: number;
  };
}

const statusLabels = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
  payment_confirmed: "Pagamento Confirmado",
  waiting_organ_approval: "Aguardando Aprovação do Órgão",
};

const statuses = [
  { value: "pending", label: "Pendente" },
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPreEnrollment, setSelectedPreEnrollment] = useState<PreEnrollment | null>(null);

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
          courses (
            id,
            name,
            pre_enrollment_fee
          )
        `)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPreEnrollments(data || []);
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

  const handlePreEnrollmentPayment = (preEnrollment: PreEnrollment) => {
    setSelectedPreEnrollment(preEnrollment);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedPreEnrollment(null);
    fetchPreEnrollments();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
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

                  {preEnrollment.status === "approved" && !preEnrollment.organ_approval_confirmed && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                        Sua pré-matrícula foi aprovada! Agora você precisa confirmar a aprovação do seu órgão.
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
                  )}

                  {preEnrollment.status === "pending" && preEnrollment.courses.pre_enrollment_fee && (
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

                  {preEnrollment.status === "pending_payment" && preEnrollment.courses.pre_enrollment_fee && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                      <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
                        Pagamento pendente. Clique para gerar um novo QR Code PIX.
                      </p>
                      <Button
                        onClick={() => handlePreEnrollmentPayment(preEnrollment)}
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <DollarSign className="h-4 w-4" />
                        Gerar Novo QR Code
                      </Button>
                    </div>
                  )}

                  {preEnrollment.organ_approval_confirmed && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                        <CheckCircle className="h-4 w-4" />
                        Aprovação do órgão confirmada em{" "}
                        {preEnrollment.organ_approval_date && 
                          new Date(preEnrollment.organ_approval_date).toLocaleDateString("pt-BR")
                        }
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showPaymentModal && selectedPreEnrollment && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          preEnrollmentId={selectedPreEnrollment.id}
          amount={selectedPreEnrollment.courses.pre_enrollment_fee || 0}
          courseName={selectedPreEnrollment.courses.name}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}