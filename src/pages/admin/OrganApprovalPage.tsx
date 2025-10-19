import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FilterBar } from "@/components/admin/filters/FilterBar";
import { SearchInput } from "@/components/admin/filters/SearchInput";
import { StatusFilter } from "@/components/admin/filters/StatusFilter";
import { CourseFilter } from "@/components/admin/filters/CourseFilter";
import { triggerEnrollmentWebhook } from "@/lib/webhookService";

interface PreEnrollment {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  cpf: string;
  organization: string;
  status: string;
  organ_approval_status?: string;
  organ_approval_date?: string;
  organ_approval_notes?: string;
  course_id: string;
  courses?: {
    name: string;
    pre_enrollment_fee?: number;
  };
  payments?: Array<{
    status: string;
    kind: string;
  }>;
}

export default function OrganApprovalPage() {
  const [enrollments, setEnrollments] = useState<PreEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnrollment, setSelectedEnrollment] = useState<PreEnrollment | null>(null);
  const [organApprovalNotes, setOrganApprovalNotes] = useState("");
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [organApprovalFilter, setOrganApprovalFilter] = useState("pending");
  
  const { toast } = useToast();

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const fetchEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from("pre_enrollments")
        .select(`
          *,
          courses (name, pre_enrollment_fee),
          payments!payments_pre_enrollment_id_fkey (status, kind)
        `)
        .in('status', ['pending_payment', 'pending'])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filtrar apenas pré-matrículas com pagamento confirmado
      const filtered = (data || []).filter(e => 
        e.payments?.some((p: any) => 
          p.kind === 'pre_enrollment' && 
          (p.status === 'received' || p.status === 'confirmed')
        )
      );

      setEnrollments(filtered);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar pré-matrículas para aprovação de órgão",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrganApprovalStatus = async (id: string, approvalStatus: 'approved' | 'rejected') => {
    try {
      const updateData: Record<string, any> = {
        organ_approval_status: approvalStatus,
        organ_approval_date: new Date().toISOString(),
      };

      // Only add organ_approval_notes if it's not empty
      if (organApprovalNotes?.trim()) {
        updateData.organ_approval_notes = organApprovalNotes.trim();
      }

      // If approved by organ, update main status to 'approved'
      if (approvalStatus === 'approved') {
        updateData.status = 'approved';
        updateData.approved_at = new Date().toISOString();
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          updateData.approved_by = userData.user.id;
        }
      }

      // Remove any undefined values to prevent JSON errors
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || updateData[key] === null) {
          delete updateData[key];
        }
      });

      const { error } = await supabase
        .from("pre_enrollments")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      // Trigger webhook for organ approval
      try {
        await triggerEnrollmentWebhook(id, 'status_changed', approvalStatus);
      } catch (webhookError) {
        console.error('Webhook error (non-critical):', webhookError);
      }

      toast({
        title: "Sucesso",
        description: `Aprovação de órgão ${approvalStatus === 'approved' ? 'confirmada' : 'rejeitada'} com sucesso!`
      });

      fetchEnrollments();
      setSelectedEnrollment(null);
      setOrganApprovalNotes("");
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar aprovação de órgão",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status || status === 'pending') {
      return <Badge variant="secondary">Pendente</Badge>;
    }
    if (status === 'approved') {
      return <Badge variant="default">Aprovado</Badge>;
    }
    if (status === 'rejected') {
      return <Badge variant="destructive">Rejeitado</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const filteredEnrollments = enrollments.filter(enrollment => {
    const matchesSearch = searchTerm === "" ||
      enrollment.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (enrollment.courses?.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCourse = selectedCourse === "all" || enrollment.course_id === selectedCourse;
    
    const matchesOrganApproval = organApprovalFilter === "all" || 
      (enrollment.organ_approval_status || 'pending') === organApprovalFilter;
    
    return matchesSearch && matchesCourse && matchesOrganApproval;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCourse("all");
    setOrganApprovalFilter("pending");
  };

  const organApprovalOptions = [
    { value: "all", label: "Todos" },
    { value: "pending", label: "Pendente" },
    { value: "approved", label: "Aprovado" },
    { value: "rejected", label: "Rejeitado" }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Aprovação de Órgão</h1>
          <p className="text-muted-foreground mt-1">
            Pré-matrículas com pagamento confirmado aguardando aprovação do órgão
          </p>
        </div>
      </div>

      <FilterBar onClearFilters={clearFilters}>
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por nome, email ou curso..."
          label="Buscar"
        />
        <CourseFilter
          value={selectedCourse}
          onChange={setSelectedCourse}
        />
        <StatusFilter
          value={organApprovalFilter}
          onChange={setOrganApprovalFilter}
          options={organApprovalOptions}
          label="Status Aprovação"
        />
      </FilterBar>

      <div className="mb-4 text-sm text-muted-foreground">
        Mostrando {filteredEnrollments.length} de {enrollments.length} pré-matrículas
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Lista de Aprovações
          </CardTitle>
          <CardDescription>
            Avalie e aprove as pré-matrículas conforme aprovação do órgão do aluno
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEnrollments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Órgão</TableHead>
                  <TableHead>Status Aprovação</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEnrollments.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell className="font-medium">{enrollment.full_name}</TableCell>
                    <TableCell>{enrollment.courses?.name}</TableCell>
                    <TableCell>{enrollment.organization || 'Não informado'}</TableCell>
                    <TableCell>{getStatusBadge(enrollment.organ_approval_status)}</TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedEnrollment(enrollment);
                              setOrganApprovalNotes(enrollment.organ_approval_notes || "");
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Avaliar
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Avaliação de Aprovação de Órgão</DialogTitle>
                          </DialogHeader>
                          {selectedEnrollment && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label>Aluno</Label>
                                <p className="text-sm font-medium">{selectedEnrollment.full_name}</p>
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Email</Label>
                                <p className="text-sm">{selectedEnrollment.email}</p>
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Curso</Label>
                                <p className="text-sm">{selectedEnrollment.courses?.name}</p>
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Órgão</Label>
                                <p className="text-sm">{selectedEnrollment.organization || 'Não informado'}</p>
                              </div>

                              <div className="space-y-2">
                                <Label>Observações sobre a Aprovação</Label>
                                <Textarea
                                  value={organApprovalNotes}
                                  onChange={(e) => setOrganApprovalNotes(e.target.value)}
                                  placeholder="Adicione observações sobre a aprovação do órgão..."
                                  rows={3}
                                />
                              </div>

                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => updateOrganApprovalStatus(selectedEnrollment.id, 'approved')}
                                  className="flex-1"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Órgão Aprovou
                                </Button>
                                <Button 
                                  variant="destructive"
                                  onClick={() => updateOrganApprovalStatus(selectedEnrollment.id, 'rejected')}
                                  className="flex-1"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Órgão Reprovou
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              Nenhuma pré-matrícula aguardando aprovação de órgão no momento.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
