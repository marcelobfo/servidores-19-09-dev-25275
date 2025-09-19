import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, BookOpen, Award } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  const { user, isAdmin } = useAuth();

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-6">
        <div className="flex justify-center">
          <GraduationCap className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Sistema de Pré-Matrícula
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Escolha seu curso, faça sua pré-matrícula e tenha acesso aos documentos oficiais após aprovação administrativa
        </p>
        
        {!user && (
          <div className="flex justify-center space-x-4">
            <Link to="/auth">
              <Button size="lg">Fazer Login</Button>
            </Link>
            <Link to="/courses">
              <Button variant="outline" size="lg">Ver Cursos</Button>
            </Link>
          </div>
        )}
      </section>

      {/* Features Section */}
      <section className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="text-center">
            <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle>Cursos Disponíveis</CardTitle>
            <CardDescription>
              Explore nossa variedade de cursos em diferentes áreas do conhecimento
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Users className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle>Processo Simples</CardTitle>
            <CardDescription>
              Pré-matrícula online rápida e fácil, com aprovação administrativa
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Award className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle>Documentos Oficiais</CardTitle>
            <CardDescription>
              Acesse sua declaração de matrícula e plano de estudos personalizado
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      {/* User Actions */}
      {user && (
        <section className="text-center space-y-6">
          <h2 className="text-2xl font-semibold">Bem-vindo(a), {user.email}!</h2>
          <div className="flex justify-center space-x-4">
            {isAdmin ? (
              <Link to="/admin">
                <Button size="lg">Área Administrativa</Button>
              </Link>
            ) : (
              <Link to="/student">
                <Button size="lg">Minha Área</Button>
              </Link>
            )}
            <Link to="/courses">
              <Button variant="outline" size="lg">Ver Cursos</Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
};

export default Index;
