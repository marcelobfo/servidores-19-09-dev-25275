import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusFilter } from "@/components/student/filters/StatusFilter";
import { SearchFilter } from "@/components/student/filters/SearchFilter";
import { SortOptions } from "@/components/student/filters/SortOptions";
import { Clock, CheckCircle, DollarSign, FileText, Calendar } from "lucide-react";
import { toast } from "sonner";

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
  };
  pre_enrollments: {
    id: string;
    full_name: string;
    email: string;
  };
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

  useEffect(() => {
    if (user) {
      fetchEnrollments();
    }
  }, [user]);

  const fetchEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          *,
          courses (
            id,
            name,
            enrollment_fee
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
    } catch (error) {
      console.error("Error fetching enrollments:", error);
      toast.error("Erro ao carregar matrículas");
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollmentCheckout = async (enrollment: Enrollment) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-enrollment-checkout', {
        body: {
          pre_enrollment_id: enrollment.pre_enrollments.id,
          amount: enrollment.courses.enrollment_fee || 0,
        }
      });

      if (error) throw error;
      
      if (data.checkout_url) {
        window.open(data.checkout_url, "_blank");
      } else {
        throw new Error("URL de checkout não encontrada");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Erro ao criar checkout de pagamento");
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
                      <strong>Estudante:</strong> {enrollment.pre_enrollments.full_name}
                    </div>
                    <div>
                      <strong>Email:</strong> {enrollment.pre_enrollments.email}
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

                  {enrollment.status === "awaiting_payment" && enrollment.payment_status === "pending" && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                        Complete sua matrícula efetuando o pagamento da taxa de matrícula.
                      </p>
                      <Button
                        onClick={() => handleEnrollmentCheckout(enrollment)}
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <DollarSign className="h-4 w-4" />
                        Pagar Matrícula - R$ {enrollment.courses.enrollment_fee}
                      </Button>
                    </div>
                  )}

                  {enrollment.status === "active" && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                        <CheckCircle className="h-4 w-4" />
                        Matrícula ativa! Você pode acessar o conteúdo do curso.
                      </div>
                    </div>
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