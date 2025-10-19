import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { triggerEnrollmentWebhook } from "@/lib/webhookService";
import { Label } from "@/components/ui/label";
import { generateStudyPlan, generateEnrollmentDeclaration } from "@/lib/pdfGenerator";
import { generateCertificateForEnrollment } from "@/lib/certificateService";
import { FilterBar } from "@/components/admin/filters/FilterBar";
import { SearchInput } from "@/components/admin/filters/SearchInput";
import { StatusFilter } from "@/components/admin/filters/StatusFilter";
import { CourseFilter } from "@/components/admin/filters/CourseFilter";
import { DateRangeFilter } from "@/components/admin/filters/DateRangeFilter";
import { DateRange } from "react-day-picker";

interface PreEnrollment {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  cpf: string;
  organization: string;
  address: string;
  birth_date: string;
  education_level: string;
  additional_info: string;
  status: string;
  admin_notes: string;
  created_at: string;
  course_id: string;
  study_plan_url: string;
  enrollment_declaration_url: string;
  organ_approval_status?: string;
  organ_approval_date?: string;
  organ_approval_notes?: string;
  manual_approval?: boolean;
  courses?: {
    name: string;
    duration_hours: number;
    start_date?: string;
    end_date?: string;
    modules?: string;
    description?: string;
    pre_enrollment_fee?: number;
    enrollment_fee?: number;
  };
  payments?: Array<{
    status: string;
    kind: string;
  }>;
}

const EnrollmentsPage = () => {
  const [enrollments, setEnrollments] = useState<PreEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnrollment, setSelectedEnrollment] = useState<PreEnrollment | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [adminNotes, setAdminNotes] = useState("");
  const [downloadingDeclarations, setDownloadingDeclarations] = useState<Set<string>>(new Set());
  const [downloadingPlans, setDownloadingPlans] = useState<Set<string>>(new Set());
  const [generatingCertificates, setGeneratingCertificates] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<any>(null);
  const [organApprovalNotes, setOrganApprovalNotes] = useState("");
  
  // Additional filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [organApprovalFilter, setOrganApprovalFilter] = useState("all");
  
  const { toast } = useToast();

  useEffect(() => {
    fetchEnrollments();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from("pre_enrollments")
        .select(`
          *,
          courses (name, duration_hours, pre_enrollment_fee),
          payments!payments_pre_enrollment_id_fkey (status, kind)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEnrollments(data || []);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar pré-matrículas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateEnrollmentStatus = async (id: string, status: string, notes?: string, manualApproval: boolean = false) => {
    try {
      console.log('Updating enrollment status:', { id, status, manualApproval });
      
      // Get current enrollment status for webhook
      const { data: currentEnrollment, error: fetchError } = await supabase
        .from("pre_enrollments")
        .select("status")
        .eq("id", id)
        .single();

      if (fetchError) {
        console.error('Error fetching enrollment:', fetchError);
        throw fetchError;
      }

      // Build update object with only defined values
      const updateData: Record<string, any> = { 
        status
      };

      // Only add admin_notes if it's not empty
      const noteValue = notes || adminNotes;
      if (noteValue && noteValue.trim()) {
        updateData.admin_notes = noteValue.trim();
      }

      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        const { data: userData } = await supabase.auth.getUser();
        // Only add approved_by if userData.user exists and has id
        if (userData?.user?.id) {
          updateData.approved_by = userData.user.id;
        }
        if (manualApproval) {
          updateData.manual_approval = true;
        }
      }

      // Remove any undefined values to prevent JSON errors
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || updateData[key] === null) {
          delete updateData[key];
        }
      });

      console.log('Update data:', updateData);

      const { error } = await supabase
        .from("pre_enrollments")
        .update(updateData)
        .eq("id", id);

      if (error) {
        console.error('Error updating enrollment:', error);
        throw error;
      }

      // Trigger webhook based on status change
      try {
        if (status === 'approved') {
          await triggerEnrollmentWebhook(id, 'enrollment_approved', currentEnrollment?.status);
        } else if (currentEnrollment?.status !== status) {
          await triggerEnrollmentWebhook(id, 'status_changed', currentEnrollment?.status);
        }
      } catch (webhookError) {
        console.error('Webhook error (non-critical):', webhookError);
      }

      toast({
        title: "Sucesso",
        description: `Pré-matrícula ${status === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso!${manualApproval ? ' (Aprovação Manual)' : ''}`
      });

      fetchEnrollments();
      setSelectedEnrollment(null);
      setAdminNotes("");
    } catch (error: any) {
      console.error('Full error:', error);
      toast({
        title: "Erro",
        description: error?.message || "Falha ao atualizar status",
        variant: "destructive"
      });
    }
  };

  const updateOrganApprovalStatus = async (id: string, approvalStatus: string, notes?: string) => {
    try {
      const updateData: Record<string, any> = {
        organ_approval_status: approvalStatus,
        organ_approval_date: new Date().toISOString(),
      };

      // Only add organ_approval_notes if it's not empty
      const noteValue = notes || organApprovalNotes;
      if (noteValue && noteValue.trim()) {
        updateData.organ_approval_notes = noteValue.trim();
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
      await triggerEnrollmentWebhook(id, 'status_changed', approvalStatus);

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

  const handleDownloadStudyPlan = async (enrollment: PreEnrollment) => {
    setDownloadingPlans(prev => new Set([...prev, enrollment.id]));
    
    try {
      if (!settings) {
        throw new Error('Configurações do sistema não encontradas');
      }

      // Transform enrollment data to match expected format
      const enrollmentData = {
        ...enrollment,
        course: {
          name: enrollment.courses?.name || '',
          duration_hours: enrollment.courses?.duration_hours || 0,
          start_date: enrollment.courses?.start_date || '',
          end_date: enrollment.courses?.end_date || '',
          modules: enrollment.courses?.modules,
          description: enrollment.courses?.description
        }
      };

      const studyPlanBlob = await generateStudyPlan(enrollmentData, settings);
      const url = URL.createObjectURL(studyPlanBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plano-estudos-${enrollment.full_name.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Sucesso',
        description: 'Plano de estudos baixado com sucesso'
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao gerar plano de estudos',
        variant: 'destructive'
      });
    } finally {
      setDownloadingPlans(prev => {
        const newSet = new Set(prev);
        newSet.delete(enrollment.id);
        return newSet;
      });
    }
  };

  const handleDownloadDeclaration = async (enrollment: PreEnrollment) => {
    setDownloadingDeclarations(prev => new Set([...prev, enrollment.id]));
    
    try {
      if (!settings) {
        throw new Error('Configurações do sistema não encontradas');
      }

      // Transform enrollment data to match expected format
      const enrollmentData = {
        ...enrollment,
        course: {
          name: enrollment.courses?.name || '',
          duration_hours: enrollment.courses?.duration_hours || 0,
          start_date: enrollment.courses?.start_date || '',
          end_date: enrollment.courses?.end_date || '',
          modules: enrollment.courses?.modules,
          description: enrollment.courses?.description
        }
      };

      const declarationBlob = await generateEnrollmentDeclaration(enrollmentData, settings);
      const url = URL.createObjectURL(declarationBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `declaracao-matricula-${enrollment.full_name.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Sucesso',
        description: 'Declaração de matrícula baixada com sucesso'
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao gerar declaração',
        variant: 'destructive'
      });
    } finally {
      setDownloadingDeclarations(prev => {
        const newSet = new Set(prev);
        newSet.delete(enrollment.id);
        return newSet;
      });
    }
  };

  const handleGenerateCertificate = async (enrollment: PreEnrollment) => {
    setGeneratingCertificates(prev => new Set([...prev, enrollment.id]));
    
    try {
      await generateCertificateForEnrollment(enrollment.id);
      toast({
        title: 'Sucesso',
        description: 'Certificado gerado com sucesso'
      });
      fetchEnrollments(); // Refresh the list
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao gerar certificado',
        variant: 'destructive'
      });
    } finally {
      setGeneratingCertificates(prev => {
        const newSet = new Set(prev);
        newSet.delete(enrollment.id);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendente", variant: "secondary" as const },
      approved: { label: "Aprovada", variant: "default" as const },
      rejected: { label: "Rejeitada", variant: "destructive" as const }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredEnrollments = enrollments.filter(enrollment => {
    const matchesStatus = statusFilter === "all" || enrollment.status === statusFilter;
    
    const matchesSearch = searchTerm === "" ||
      enrollment.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (enrollment.courses?.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCourse = selectedCourse === "all" || enrollment.course_id === selectedCourse;
    
    const matchesDateRange = !dateRange?.from || 
      (new Date(enrollment.created_at) >= dateRange.from && 
       (!dateRange.to || new Date(enrollment.created_at) <= dateRange.to));
    
    const matchesOrganApproval = organApprovalFilter === "all" || 
      enrollment.organ_approval_status === organApprovalFilter;
    
    return matchesStatus && matchesSearch && matchesCourse && matchesDateRange && matchesOrganApproval;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSelectedCourse("all");
    setDateRange(undefined);
    setOrganApprovalFilter("all");
  };

  const statusOptions = [
    { value: "all", label: "Todos" },
    { value: "pending", label: "Pendente" },
    { value: "approved", label: "Aprovada" },
    { value: "rejected", label: "Rejeitada" },
    { value: "pending_payment", label: "Aguardando Pagamento" }
  ];

  const organApprovalOptions = [
    { value: "all", label: "Todos" },
    { value: "pending", label: "Pendente" },
    { value: "approved", label: "Aprovado" },
    { value: "rejected", label: "Rejeitado" }
  ];

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestão de Pré-Matrículas</h1>
      </div>

      <FilterBar onClearFilters={clearFilters}>
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por nome, email ou curso..."
          label="Buscar Aluno/Curso"
        />
        <StatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          label="Status da Matrícula"
        />
        <CourseFilter
          value={selectedCourse}
          onChange={setSelectedCourse}
        />
        <StatusFilter
          value={organApprovalFilter}
          onChange={setOrganApprovalFilter}
          options={organApprovalOptions}
          label="Aprovação Órgão"
        />
        <DateRangeFilter
          value={dateRange}
          onChange={setDateRange}
          label="Data de Criação"
        />
      </FilterBar>

      <div className="mb-4 text-sm text-muted-foreground">
        Mostrando {filteredEnrollments.length} de {enrollments.length} pré-matrículas
      </div>

      {/* Seção de Aprovação de Órgão */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            Aprovação de Órgão
          </CardTitle>
          <CardDescription>
            Pré-matrículas com pagamento confirmado aguardando aprovação do órgão do aluno
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enrollments.filter(e => e.status === 'pending_payment' || (e.status === 'pending' && e.organ_approval_status === 'pending')).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Órgão</TableHead>
                  <TableHead>Status do Pagamento</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments
                  .filter(e => e.status === 'pending_payment' || (e.status === 'pending' && e.organ_approval_status === 'pending'))
                  .map((enrollment) => (
                  <TableRow key={`organ-${enrollment.id}`}>
                    <TableCell className="font-medium">{enrollment.full_name}</TableCell>
                    <TableCell>{enrollment.courses?.name}</TableCell>
                    <TableCell>{enrollment.organization || 'Não informado'}</TableCell>
                    <TableCell>
                      <Badge variant={enrollment.status === 'pending_payment' ? 'secondary' : 'outline'}>
                        {enrollment.status === 'pending_payment' ? 'Pago' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        // Check if payment is confirmed for courses with pre-enrollment fee
                        const hasPreEnrollmentFee = (enrollment.courses?.pre_enrollment_fee || 0) > 0;
                        const hasConfirmedPayment = enrollment.payments?.some(p => 
                          p.kind === 'pre_enrollment' && (p.status === 'received' || p.status === 'confirmed')
                        );
                        const canApprove = !hasPreEnrollmentFee || (hasPreEnrollmentFee && hasConfirmedPayment);

                        return (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                disabled={!canApprove}
                                onClick={() => {
                                  setSelectedEnrollment(enrollment);
                                  setOrganApprovalNotes(enrollment.organ_approval_notes || "");
                                }}
                                title={!canApprove ? "Aguardando confirmação do pagamento da pré-matrícula" : ""}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Avaliar Órgão
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle>Aprovação de Órgão</DialogTitle>
                              </DialogHeader>
                              {selectedEnrollment && (
                                <div className="space-y-4">
                              <div className="space-y-2">
                                <Label>Aluno</Label>
                                <p className="text-sm font-medium">{selectedEnrollment.full_name}</p>
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Curso</Label>
                                <p className="text-sm">{selectedEnrollment.courses?.name}</p>
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Órgão</Label>
                                <p className="text-sm">{selectedEnrollment.organization || 'Não informado'}</p>
                              </div>

                              <div>
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
                                  ✅ Órgão Aprovou
                                </Button>
                                <Button 
                                  variant="destructive"
                                  onClick={() => updateOrganApprovalStatus(selectedEnrollment.id, 'rejected')}
                                  className="flex-1"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  ❌ Órgão Reprovou
                                </Button>
                              </div>
                                 </div>
                               )}
                             </DialogContent>
                           </Dialog>
                         );
                       })()}
                     </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-4 text-muted-foreground">
              Nenhuma pré-matrícula aguardando aprovação de órgão no momento.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Pré-Matrículas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Certificado</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEnrollments.map((enrollment) => (
                <TableRow key={enrollment.id}>
                  <TableCell className="font-medium">{enrollment.full_name}</TableCell>
                  <TableCell>{enrollment.email}</TableCell>
                  <TableCell>{enrollment.courses?.name}</TableCell>
                  <TableCell>{enrollment.phone || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        enrollment.status === 'approved' ? 'default' :
                        enrollment.status === 'pending' ? 'secondary' :
                        enrollment.status === 'rejected' ? 'destructive' :
                        'outline'
                      }>
                        {enrollment.status === 'approved' ? 'Aprovado' :
                         enrollment.status === 'pending' ? 'Pendente' :
                         enrollment.status === 'rejected' ? 'Rejeitado' :
                         enrollment.status === 'paid' ? 'Pago' : enrollment.status}
                      </Badge>
                      {enrollment.manual_approval && (
                        <Badge variant="outline" className="text-xs">
                          Manual
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {enrollment.status === 'approved' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateCertificate(enrollment)}
                        disabled={generatingCertificates.has(enrollment.id)}
                      >
                        {generatingCertificates.has(enrollment.id) ? 'Gerando...' : 'Gerar Certificado'}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedEnrollment(enrollment);
                          setAdminNotes(enrollment.admin_notes || "");
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Detalhes
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Detalhes da Pré-Matrícula</DialogTitle>
                      </DialogHeader>
                      {selectedEnrollment && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Nome Completo</Label>
                              <p className="text-sm">{selectedEnrollment.full_name}</p>
                            </div>
                            <div>
                              <Label>Email</Label>
                              <p className="text-sm">{selectedEnrollment.email}</p>
                            </div>
                            <div>
                              <Label>CPF</Label>
                              <p className="text-sm">{selectedEnrollment.cpf || "Não informado"}</p>
                            </div>
                            <div>
                              <Label>Órgão</Label>
                              <p className="text-sm">{selectedEnrollment.organization || "Não informado"}</p>
                            </div>
                            <div>
                              <Label>Telefone</Label>
                              <p className="text-sm">{selectedEnrollment.phone || "Não informado"}</p>
                            </div>
                            <div>
                              <Label>Data de Nascimento</Label>
                              <p className="text-sm">
                                {selectedEnrollment.birth_date 
                                  ? new Date(selectedEnrollment.birth_date).toLocaleDateString()
                                  : "Não informado"}
                              </p>
                            </div>
                          </div>

                          {selectedEnrollment.address && (
                            <div>
                              <Label>Endereço</Label>
                              <p className="text-sm">{selectedEnrollment.address}</p>
                            </div>
                          )}

                          {selectedEnrollment.education_level && (
                            <div>
                              <Label>Nível de Escolaridade</Label>
                              <p className="text-sm">{selectedEnrollment.education_level}</p>
                            </div>
                          )}

                          {selectedEnrollment.additional_info && (
                            <div>
                              <Label>Informações Adicionais</Label>
                              <p className="text-sm">{selectedEnrollment.additional_info}</p>
                            </div>
                          )}

                          <div>
                            <Label>Observações Administrativas</Label>
                            <Textarea
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              placeholder="Adicione observações sobre esta pré-matrícula..."
                              rows={3}
                            />
                          </div>

                          {selectedEnrollment.status === 'pending' && (
                            <div className="space-y-3">
                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => updateEnrollmentStatus(selectedEnrollment.id, 'approved')}
                                  className="flex-1"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Aprovar
                                </Button>
                                <Button 
                                  variant="destructive"
                                  onClick={() => updateEnrollmentStatus(selectedEnrollment.id, 'rejected')}
                                  className="flex-1"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Rejeitar
                                </Button>
                              </div>
                              <div className="pt-2 border-t">
                                <p className="text-xs text-muted-foreground mb-2">
                                  Aprovar manualmente (ignorar validação de pagamento):
                                </p>
                                <Button 
                                  onClick={() => updateEnrollmentStatus(selectedEnrollment.id, 'approved', undefined, true)}
                                  className="w-full"
                                  variant="outline"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  ✅ Aprovação Manual (Cortesia/Erro Pagamento)
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {selectedEnrollment.status !== 'pending' && selectedEnrollment.status !== 'approved' && (
                            <div className="pt-2 border-t">
                              <p className="text-xs text-muted-foreground mb-2">
                                Forçar aprovação manual desta matrícula:
                              </p>
                              <Button 
                                onClick={() => updateEnrollmentStatus(selectedEnrollment.id, 'approved', undefined, true)}
                                className="w-full"
                                variant="outline"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                ✅ Aprovação Manual
                              </Button>
                            </div>
                          )}

                          {selectedEnrollment.status === 'approved' && (
                            <div className="space-y-2">
                              <Button 
                                onClick={() => handleDownloadStudyPlan(selectedEnrollment)}
                                className="w-full"
                                disabled={downloadingPlans.has(selectedEnrollment.id)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                {downloadingPlans.has(selectedEnrollment.id) ? 'Gerando...' : 'Download Plano de Estudos'}
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={() => handleDownloadDeclaration(selectedEnrollment)}
                                className="w-full"
                                disabled={downloadingDeclarations.has(selectedEnrollment.id)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                {downloadingDeclarations.has(selectedEnrollment.id) ? 'Gerando...' : 'Download Declaração de Matrícula'}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnrollmentsPage;