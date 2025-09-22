import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchFilter } from "@/components/student/filters/SearchFilter";
import { SortOptions } from "@/components/student/filters/SortOptions";
import { FileText, Download, Calendar, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { generateDocument } from "@/lib/pdfGenerator";

interface EnrollmentDeclaration {
  id: string;
  pre_enrollment_id: string;
  content: string;
  generated_at: string;
  pre_enrollments: {
    id: string;
    full_name: string;
    courses: {
      name: string;
    };
  };
}

interface StudyPlan {
  id: string;
  pre_enrollment_id: string;
  content: string;
  generated_at: string;
  pre_enrollments: {
    id: string;
    full_name: string;
    courses: {
      name: string;
    };
  };
}

const sortOptions = [
  { value: "generated_at_desc", label: "Mais recentes" },
  { value: "generated_at_asc", label: "Mais antigos" },
  { value: "course_name", label: "Nome do curso" },
];

export function DocumentsPage() {
  const { user } = useAuth();
  const [declarations, setDeclarations] = useState<EnrollmentDeclaration[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("generated_at_desc");

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user]);

  const fetchDocuments = async () => {
    try {
      // First get user's pre-enrollments
      const { data: preEnrollments, error: preEnrollmentsError } = await supabase
        .from("pre_enrollments")
        .select("id")
        .eq("user_id", user?.id);

      if (preEnrollmentsError) throw preEnrollmentsError;
      
      const preEnrollmentIds = preEnrollments?.map(pe => pe.id) || [];
      
      if (preEnrollmentIds.length === 0) {
        setDeclarations([]);
        setStudyPlans([]);
        setLoading(false);
        return;
      }

      // Fetch enrollment declarations
      const { data: declarationsData, error: declarationsError } = await supabase
        .from("enrollment_declarations")
        .select(`
          *,
          pre_enrollments (
            id,
            full_name,
            courses (
              name
            )
          )
        `)
        .in("pre_enrollment_id", preEnrollmentIds)
        .order("generated_at", { ascending: false });

      if (declarationsError) throw declarationsError;
      setDeclarations(declarationsData || []);

      // Fetch study plans
      const { data: studyPlansData, error: studyPlansError } = await supabase
        .from("study_plans")
        .select(`
          *,
          pre_enrollments (
            id,
            full_name,
            courses (
              name
            )
          )
        `)
        .in("pre_enrollment_id", preEnrollmentIds)
        .order("generated_at", { ascending: false });

      if (studyPlansError) throw studyPlansError;
      setStudyPlans(studyPlansData || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDeclaration = async (declaration: EnrollmentDeclaration) => {
    try {
      await generateDocument(
        declaration.content,
        `declaracao-matricula-${declaration.pre_enrollments.courses.name.replace(/\s+/g, '-').toLowerCase()}.pdf`
      );
      toast.success("Declaração baixada com sucesso!");
    } catch (error) {
      console.error("Error downloading declaration:", error);
      toast.error("Erro ao baixar declaração");
    }
  };

  const handleDownloadStudyPlan = async (studyPlan: StudyPlan) => {
    try {
      await generateDocument(
        studyPlan.content,
        `plano-estudos-${studyPlan.pre_enrollments.courses.name.replace(/\s+/g, '-').toLowerCase()}.pdf`
      );
      toast.success("Plano de estudos baixado com sucesso!");
    } catch (error) {
      console.error("Error downloading study plan:", error);
      toast.error("Erro ao baixar plano de estudos");
    }
  };

  const filterAndSort = (items: any[]) => {
    return items
      .filter(item => {
        if (searchTerm && !item.pre_enrollments.courses.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "generated_at_asc":
            return new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime();
          case "course_name":
            return a.pre_enrollments.courses.name.localeCompare(b.pre_enrollments.courses.name);
          default: // generated_at_desc
            return new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime();
        }
      });
  };

  const filteredDeclarations = filterAndSort(declarations);
  const filteredStudyPlans = filterAndSort(studyPlans);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const EmptyState = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Icon className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground text-center">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meus Documentos</h1>
        <p className="text-muted-foreground">
          Acesse e baixe suas declarações de matrícula e planos de estudo
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchFilter
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por nome do curso..."
        />
        <SortOptions
          value={sortBy}
          onChange={setSortBy}
          options={sortOptions}
        />
      </div>

      <Tabs defaultValue="declarations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="declarations" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Declarações de Matrícula
          </TabsTrigger>
          <TabsTrigger value="study-plans" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Planos de Estudo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="declarations" className="space-y-4">
          {filteredDeclarations.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhuma declaração encontrada"
              description={searchTerm 
                ? "Tente ajustar a busca para ver mais resultados."
                : "Suas declarações de matrícula aparecerão aqui quando estiverem disponíveis."
              }
            />
          ) : (
            <div className="grid gap-4">
              {filteredDeclarations.map((declaration) => (
                <Card key={declaration.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          Declaração de Matrícula
                        </CardTitle>
                        <CardDescription>
                          {declaration.pre_enrollments.courses.name}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Estudante:</strong> {declaration.pre_enrollments.full_name}
                        </div>
                        <div>
                          <strong>Gerado em:</strong>{" "}
                          {new Date(declaration.generated_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>

                      <Button
                        onClick={() => handleDownloadDeclaration(declaration)}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Baixar Declaração
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="study-plans" className="space-y-4">
          {filteredStudyPlans.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Nenhum plano de estudos encontrado"
              description={searchTerm 
                ? "Tente ajustar a busca para ver mais resultados."
                : "Seus planos de estudo aparecerão aqui quando estiverem disponíveis."
              }
            />
          ) : (
            <div className="grid gap-4">
              {filteredStudyPlans.map((studyPlan) => (
                <Card key={studyPlan.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-primary" />
                          Plano de Estudos
                        </CardTitle>
                        <CardDescription>
                          {studyPlan.pre_enrollments.courses.name}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Estudante:</strong> {studyPlan.pre_enrollments.full_name}
                        </div>
                        <div>
                          <strong>Gerado em:</strong>{" "}
                          {new Date(studyPlan.generated_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>

                      <Button
                        onClick={() => handleDownloadStudyPlan(studyPlan)}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Baixar Plano de Estudos
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}