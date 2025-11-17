import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  Award, 
  ArrowRight, 
  FileCheck,
  Zap,
  Star,
  CheckCircle
} from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  const { user, isAdmin } = useAuth();

  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-background -z-10" />
        
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge variant="secondary" className="mb-4">
              🎓 Educação Online de Qualidade
            </Badge>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Sua <span className="text-primary">Jornada</span> Educacional<br />
              Começa Aqui
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Escolha seu curso, faça sua pré-matrícula e tenha acesso aos documentos oficiais após aprovação administrativa
            </p>
            
            {!user && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link to="/courses">
                  <Button size="lg" className="text-lg px-8 h-14 w-full sm:w-auto">
                    Explorar Cursos <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/verify-certificate">
                  <Button size="lg" variant="outline" className="text-lg px-8 h-14 w-full sm:w-auto">
                    Verificar Certificado <FileCheck className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            )}

            {user && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link to={isAdmin ? "/admin" : "/student"}>
                  <Button size="lg" className="text-lg px-8 h-14 w-full sm:w-auto">
                    {isAdmin ? "Área Administrativa" : "Minha Área"}
                  </Button>
                </Link>
                <Link to="/courses">
                  <Button size="lg" variant="outline" className="text-lg px-8 h-14 w-full sm:w-auto">
                    Ver Cursos
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <StatCard icon={Users} value="500+" label="Alunos Ativos" color="text-blue-500" />
            <StatCard icon={BookOpen} value="50+" label="Cursos" color="text-green-500" />
            <StatCard icon={Award} value="95%" label="Aprovação" color="text-yellow-500" />
            <StatCard icon={Star} value="4.8/5" label="Avaliação" color="text-purple-500" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Por que escolher nossos cursos?
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground">
              Oferecemos uma experiência completa de aprendizado
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={BookOpen}
              iconColor="text-blue-500"
              title="Cursos Diversificados"
              description="Explore nossa variedade de cursos em diferentes áreas do conhecimento"
            />
            <FeatureCard 
              icon={Zap}
              iconColor="text-yellow-500"
              title="Processo Simples"
              description="Pré-matrícula online rápida e fácil, com aprovação administrativa"
            />
            <FeatureCard 
              icon={Award}
              iconColor="text-green-500"
              title="Certificado Oficial"
              description="Receba seu certificado digital verificável ao concluir o curso"
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-muted/30">
        <div className="container max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Como Funciona?
          </h2>
          
          <div className="space-y-6">
            <StepCard 
              number={1} 
              title="Escolha seu curso" 
              description="Navegue pelos cursos disponíveis e encontre o ideal para você"
            />
            <StepCard 
              number={2} 
              title="Faça sua pré-matrícula" 
              description="Preencha o formulário online de forma rápida e segura"
            />
            <StepCard 
              number={3} 
              title="Aguarde aprovação" 
              description="Nossa equipe administrativa analisará sua solicitação"
            />
            <StepCard 
              number={4} 
              title="Receba seus documentos" 
              description="Acesse sua declaração e plano de estudos na área do aluno"
            />
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-br from-primary to-secondary text-primary-foreground">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Pronto para começar?
          </h2>
          <p className="text-lg md:text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Junte-se a centenas de alunos que já transformaram suas carreiras
          </p>
          <Link to="/courses">
            <Button size="lg" variant="secondary" className="text-lg px-12 h-14">
              Começar Agora <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

// Sub-componentes
const StatCard = ({ icon: Icon, value, label, color }: {
  icon: React.ElementType;
  value: string;
  label: string;
  color: string;
}) => (
  <Card className="text-center hover:shadow-lg transition-shadow">
    <CardContent className="pt-6 space-y-2">
      <Icon className={`h-10 w-10 mx-auto ${color}`} />
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </CardContent>
  </Card>
);

const FeatureCard = ({ icon: Icon, iconColor, title, description }: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
}) => (
  <Card className="hover:shadow-lg transition-all hover:-translate-y-1">
    <CardHeader className="text-center space-y-4">
      <div className="mx-auto">
        <Icon className={`h-12 w-12 ${iconColor}`} />
      </div>
      <CardTitle className="text-xl">{title}</CardTitle>
      <CardDescription className="text-base">{description}</CardDescription>
    </CardHeader>
  </Card>
);

const StepCard = ({ number, title, description }: {
  number: number;
  title: string;
  description: string;
}) => (
  <div className="flex gap-4 items-start">
    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
      {number}
    </div>
    <div className="flex-1 pt-2">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
    <CheckCircle className="flex-shrink-0 h-6 w-6 text-primary mt-3" />
  </div>
);

export default Index;
