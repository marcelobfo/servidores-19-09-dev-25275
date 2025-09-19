import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, Clock, CheckCircle, XCircle, Plus, DollarSign, Settings, FileText } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalCourses: 0,
    pendingEnrollments: 0,
    approvedEnrollments: 0,
    rejectedEnrollments: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch courses count
      const { count: coursesCount } = await supabase
        .from("courses")
        .select("*", { count: "exact", head: true });

      // Fetch enrollment stats
      const { data: enrollments } = await supabase
        .from("pre_enrollments")
        .select("status");

      const pending = enrollments?.filter(e => e.status === "pending").length || 0;
      const approved = enrollments?.filter(e => e.status === "approved").length || 0;
      const rejected = enrollments?.filter(e => e.status === "rejected").length || 0;

      setStats({
        totalCourses: coursesCount || 0,
        pendingEnrollments: pending,
        approvedEnrollments: approved,
        rejectedEnrollments: rejected,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Administrativo</h1>
        <p className="text-muted-foreground">
          Visão geral do sistema de gestão educacional
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Cursos</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCourses}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingEnrollments}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedEnrollments}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitadas</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejectedEnrollments}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Gerenciar Cursos</CardTitle>
            <CardDescription>
              Criar novos cursos e editar cursos existentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin/courses">
              <Button className="w-full">
                <BookOpen className="mr-2 h-4 w-4" />
                Ver Cursos
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pré-Matrículas</CardTitle>
            <CardDescription>
              Revisar e aprovar pré-matrículas pendentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin/enrollments">
              <Button className="w-full">
                <Users className="mr-2 h-4 w-4" />
                Ver Matrículas
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Áreas de Curso</CardTitle>
            <CardDescription>
              Gerenciar categorias de cursos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin/areas">
              <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Ver Áreas
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Certificados</CardTitle>
            <CardDescription>
              Gerenciar e emitir certificados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin/certificates">
              <Button className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                Ver Certificados
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configurações do Sistema</CardTitle>
            <CardDescription>
              Configurar dados institucionais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin/settings">
              <Button className="w-full" variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Sistema
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configurações de Pagamento</CardTitle>
            <CardDescription>
              Configurar sistema de pagamentos PIX
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin/payment-settings">
              <Button className="w-full">
                <DollarSign className="mr-2 h-4 w-4" />
                Pagamentos
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}