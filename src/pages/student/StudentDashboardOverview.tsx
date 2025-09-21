import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Award, Clock, Plus, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface DashboardStats {
  preEnrollments: number;
  enrollments: number;
  certificates: number;
  documents: number;
}

interface RecentActivity {
  id: string;
  type: 'pre_enrollment' | 'enrollment' | 'certificate' | 'document';
  title: string;
  status: string;
  date: string;
}

export function StudentDashboardOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    preEnrollments: 0,
    enrollments: 0,
    certificates: 0,
    documents: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch pre-enrollments count
      const { count: preEnrollmentsCount } = await supabase
        .from("pre_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user?.id);

      // Fetch enrollments count
      const { count: enrollmentsCount } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user?.id);

      // Fetch certificates count (through enrollments)
      const { data: userPreEnrollments } = await supabase
        .from("pre_enrollments")
        .select("id")
        .eq("user_id", user?.id);

      const preEnrollmentIds = userPreEnrollments?.map(pe => pe.id) || [];
      
      const { count: certificatesCount } = await supabase
        .from("certificates")
        .select("*", { count: "exact", head: true })
        .in("enrollment_id", preEnrollmentIds)
        .eq("status", "active");

      // Fetch documents count
      const { count: declarationsCount } = await supabase
        .from("enrollment_declarations")
        .select("*", { count: "exact", head: true })
        .in("pre_enrollment_id", preEnrollmentIds);

      const { count: studyPlansCount } = await supabase
        .from("study_plans")
        .select("*", { count: "exact", head: true })
        .in("pre_enrollment_id", preEnrollmentIds);

      const documentsCount = (declarationsCount || 0) + (studyPlansCount || 0);

      setStats({
        preEnrollments: preEnrollmentsCount || 0,
        enrollments: enrollmentsCount || 0,
        certificates: certificatesCount || 0,
        documents: documentsCount,
      });

      // Fetch recent activities
      const { data: recentPreEnrollments } = await supabase
        .from("pre_enrollments")
        .select(`
          id,
          status,
          created_at,
          courses (
            name
          )
        `)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(5);

      const activities: RecentActivity[] = [];

      recentPreEnrollments?.forEach(pe => {
        activities.push({
          id: pe.id,
          type: 'pre_enrollment',
          title: `Pré-matrícula: ${pe.courses.name}`,
          status: pe.status,
          date: pe.created_at,
        });
      });

      // Sort by date and limit to 5
      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentActivities(activities.slice(0, 5));

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, type: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive", label: string }> = {
      pending: { variant: "secondary", label: "Pendente" },
      approved: { variant: "default", label: "Aprovada" },
      rejected: { variant: "destructive", label: "Rejeitada" },
      payment_confirmed: { variant: "default", label: "Pagamento Confirmado" },
      awaiting_payment: { variant: "secondary", label: "Aguardando Pagamento" },
      active: { variant: "default", label: "Ativa" },
      completed: { variant: "default", label: "Concluída" },
    };

    const statusInfo = statusMap[status] || { variant: "secondary", label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

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
        <h1 className="text-3xl font-bold text-foreground">Bem-vindo à sua área</h1>
        <p className="text-muted-foreground">
          Acompanhe suas matrículas, certificados e documentos em um só lugar
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pré-matrículas</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.preEnrollments}</div>
            <p className="text-xs text-muted-foreground">
              Total de solicitações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matrículas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.enrollments}</div>
            <p className="text-xs text-muted-foreground">
              Matrículas ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certificados</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.certificates}</div>
            <p className="text-xs text-muted-foreground">
              Certificados emitidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.documents}</div>
            <p className="text-xs text-muted-foreground">
              Disponíveis para download
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>
            Acesse rapidamente as funcionalidades mais utilizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button asChild variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <Link to="/student/pre-enrollments">
                <BookOpen className="h-6 w-6" />
                <span>Ver Pré-matrículas</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <Link to="/student/enrollments">
                <FileText className="h-6 w-6" />
                <span>Ver Matrículas</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <Link to="/student/certificates">
                <Award className="h-6 w-6" />
                <span>Meus Certificados</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <Link to="/courses">
                <Plus className="h-6 w-6" />
                <span>Explorar Cursos</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle>Atividades Recentes</CardTitle>
          <CardDescription>
            Últimas atualizações em suas matrículas e certificados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma atividade recente</h3>
              <p className="text-muted-foreground mb-4">
                Suas atividades aparecerão aqui conforme você interage com a plataforma
              </p>
              <Button asChild>
                <Link to="/courses">
                  Explorar Cursos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{activity.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(activity.date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {getStatusBadge(activity.status, activity.type)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}