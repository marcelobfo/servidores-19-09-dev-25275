import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, FileText, Download, DollarSign } from "lucide-react";
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
  const [downloadingAll, setDownloadingAll] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<any>(null);
  
  // Additional filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  const { toast } = useToast();

  useEffect(() => {
    fetchEnrollments();
    fetchSettings();
  }, []);

  // Realtime subscription for automatic updates
  useEffect(() => {
    console.log('🔔 [REALTIME-ADMIN] Inscrevendo para atualizações de pré-matrículas e pagamentos');

    const channel = supabase
      .channel('admin-enrollments-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pre_enrollments'
        },
        (payload) => {
          console.log('🔔 [REALTIME-ADMIN] Pré-matrícula atualizada:', payload);
          fetchEnrollments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments'
        },
        (payload) => {
          console.log('🔔 [REALTIME-ADMIN] Pagamento atualizado:', payload);
          const newStatus = (payload.new as any)?.status;
          if (newStatus === 'confirmed' || newStatus === 'received') {
            toast({
              title: "Pagamento confirmado",
              description: "Um pagamento foi confirmado. Lista atualizada."
            });
          }
          fetchEnrollments();
        }
      )
      .subscribe((status) => {
        console.log('🔔 [REALTIME-ADMIN] Status da subscription:', status);
      });

    return () => {
      console.log('🔔 [REALTIME-ADMIN] Removendo subscription');
      supabase.removeChannel(channel);
    };
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
      
      // Get current enrollment status and course fee for webhook and payment creation
      const { data: currentEnrollment, error: fetchError } = await supabase
        .from("pre_enrollments")
        .select(`
          status,
          courses (
            pre_enrollment_fee
          )
        `)
        .eq("id", id)
        .single();

      if (fetchError) {
        console.error('Error fetching enrollment:', fetchError);
        throw fetchError;
      }

      const preEnrollmentFee = (currentEnrollment as any)?.courses?.pre_enrollment_fee || 0;

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
        // When admin approves manually, set status to payment_confirmed
        // This allows the student to continue the flow (confirm organ approval -> enrollment)
        updateData.status = 'payment_confirmed';
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

      // If manual approval, create a payment record so discount appears correctly
      if (manualApproval && status === 'approved' && preEnrollmentFee > 0) {
        // Check if payment already exists to avoid duplicates
        const { data: existingPayment } = await (supabase as any)
          .from("payments")
          .select("id")
          .eq("pre_enrollment_id", id)
          .eq("kind", "pre_enrollment")
          .in("status", ["confirmed", "received"])
          .maybeSingle();

        if (!existingPayment) {
          const { error: paymentError } = await (supabase as any)
            .from("payments")
            .insert({
              pre_enrollment_id: id,
              amount: preEnrollmentFee,
              currency: "BRL",
              status: "confirmed",
              kind: "pre_enrollment",
              asaas_payment_id: `manual_approval_${id}_${Date.now()}`,
              paid_at: new Date().toISOString()
            });

          if (paymentError) {
            console.error('Erro ao criar registro de pagamento para aprovação manual:', paymentError);
            // MOSTRAR ERRO EXPLÍCITO para o admin saber que algo falhou
            toast({
              title: "Aviso",
              description: `Aprovação realizada, mas erro ao criar registro de pagamento: ${paymentError.message}. O desconto pode não aparecer para o aluno.`,
              variant: "destructive"
            });
          } else {
            console.log('✅ Registro de pagamento criado para aprovação manual');
          }
        } else {
          console.log('⏭️ Pagamento já existe para esta pré-matrícula, não duplicando');
        }
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

  const confirmPaymentManually = async (enrollmentId: string) => {
    try {
      // Get current enrollment data including course fee
      const { data: currentEnrollment, error: fetchError } = await supabase
        .from("pre_enrollments")
        .select(`
          status,
          courses (
            pre_enrollment_fee
          )
        `)
        .eq("id", enrollmentId)
        .single();

      if (fetchError) throw fetchError;

      const previousStatus = currentEnrollment?.status;
      const preEnrollmentFee = (currentEnrollment as any)?.courses?.pre_enrollment_fee || 0;

      // Update status to payment_confirmed
      const { error } = await supabase
        .from("pre_enrollments")
        .update({ 
          status: 'payment_confirmed',
          manual_approval: true 
        })
        .eq("id", enrollmentId);

      if (error) throw error;

      // Create payment record so the discount appears correctly on the student side
      if (preEnrollmentFee > 0) {
        // Verificar se já existe pagamento para evitar duplicação
        const { data: existingPayment } = await (supabase as any)
          .from("payments")
          .select("id")
          .eq("pre_enrollment_id", enrollmentId)
          .eq("kind", "pre_enrollment")
          .in("status", ["confirmed", "received"])
          .maybeSingle();

        if (existingPayment) {
          console.log('⏭️ Pagamento já existe para esta pré-matrícula, não duplicando');
        } else {
          const { error: paymentError } = await (supabase as any)
            .from("payments")
            .insert({
              pre_enrollment_id: enrollmentId,
              amount: preEnrollmentFee,
              currency: "BRL",
              status: "confirmed",
              kind: "pre_enrollment",
              asaas_payment_id: `manual_${enrollmentId}_${Date.now()}`,
              paid_at: new Date().toISOString()
            });

          if (paymentError) {
            console.error('Erro ao criar registro de pagamento:', paymentError);
            // MOSTRAR ERRO EXPLÍCITO para o admin saber que algo falhou
            toast({
              title: "Aviso",
              description: `Status atualizado, mas erro ao criar registro de pagamento: ${paymentError.message}. O desconto pode não aparecer para o aluno.`,
              variant: "destructive"
            });
          } else {
            console.log('✅ Registro de pagamento criado para confirmação manual');
          }
        }
      }

      // Trigger webhook for payment confirmed
      try {
        await triggerEnrollmentWebhook(
          enrollmentId, 
          'payment_confirmed', 
          previousStatus
        );
      } catch (webhookError) {
        console.error('Webhook error (non-critical):', webhookError);
      }

      toast({
        title: "Sucesso",
        description: "Pagamento confirmado manualmente com sucesso!"
      });

      fetchEnrollments();
      setSelectedEnrollment(null);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao confirmar pagamento",
        variant: "destructive"
      });
    }
  };

  const handleDownloadAllDocuments = async (enrollment: PreEnrollment) => {
    setDownloadingAll(prev => new Set([...prev, enrollment.id]));
    try {
      if (!settings) throw new Error('Configurações do sistema não encontradas');

      const enrollmentData = {
        ...enrollment,
        course: {
          name: enrollment.courses?.name || '',
          duration_hours: enrollment.courses?.duration_hours || 0,
          start_date: enrollment.courses?.start_date || '',
          end_date: enrollment.courses?.end_date || '',
          modules: enrollment.courses?.modules,
          description: enrollment.courses?.description,
          pre_enrollment_fee: enrollment.courses?.pre_enrollment_fee,
          enrollment_fee: enrollment.courses?.enrollment_fee,
        }
      };

      const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      };

      // Declaration
      try {
        const declBlob = await generateEnrollmentDeclaration(enrollmentData, settings);
        downloadBlob(declBlob, `declaracao-${enrollment.full_name.replace(/\s+/g, '-')}.pdf`);
      } catch (e) { console.error('Erro declaração:', e); }

      // Study Plan
      try {
        const planBlob = await generateStudyPlan(enrollmentData, settings);
        downloadBlob(planBlob, `plano-estudos-${enrollment.full_name.replace(/\s+/g, '-')}.pdf`);
      } catch (e) { console.error('Erro plano:', e); }

      toast({ title: 'Sucesso', description: 'Documentos baixados com sucesso!' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Falha ao baixar documentos', variant: 'destructive' });
    } finally {
      setDownloadingAll(prev => {
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
    
    return matchesStatus && matchesSearch && matchesCourse && matchesDateRange;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSelectedCourse("all");
    setDateRange(undefined);
  };

  const statusOptions = [
    { value: "all", label: "Todos" },
    { value: "pending", label: "Pendente" },
    { value: "approved", label: "Aprovada" },
    { value: "rejected", label: "Rejeitada" },
    { value: "pending_payment", label: "Aguardando Pagamento" }
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
        <DateRangeFilter
          value={dateRange}
          onChange={setDateRange}
          label="Data de Criação"
        />
      </FilterBar>

      <div className="mb-4 text-sm text-muted-foreground">
        Mostrando {filteredEnrollments.length} de {enrollments.length} pré-matrículas
      </div>

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
                            <div className="pt-2 border-t space-y-2">
                              <p className="text-xs text-muted-foreground mb-2">
                                Ações manuais:
                              </p>
                              {selectedEnrollment.status === 'pending_payment' && (
                                <Button 
                                  onClick={() => confirmPaymentManually(selectedEnrollment.id)}
                                  className="w-full"
                                  variant="outline"
                                >
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  💰 Confirmar Pagamento Manualmente
                                </Button>
                              )}
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
                                onClick={() => handleGenerateCertificate(selectedEnrollment)}
                                className="w-full"
                                variant="outline"
                                disabled={generatingCertificates.has(selectedEnrollment.id)}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                {generatingCertificates.has(selectedEnrollment.id) ? 'Gerando...' : 'Gerar Certificado'}
                              </Button>
                            </div>
                          )}

                          {/* Documentos - sempre visíveis para o admin */}
                          <div className="space-y-2 pt-2 border-t">
                            <p className="text-xs text-muted-foreground font-medium">Documentos do Aluno</p>
                            <Button 
                              onClick={() => handleDownloadStudyPlan(selectedEnrollment)}
                              className="w-full"
                              disabled={downloadingPlans.has(selectedEnrollment.id)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {downloadingPlans.has(selectedEnrollment.id) ? 'Gerando...' : 'Download Plano de Estudos'}
                            </Button>
                            <Button 
                              variant="secondary"
                              onClick={() => handleDownloadDeclaration(selectedEnrollment)}
                              className="w-full"
                              disabled={downloadingDeclarations.has(selectedEnrollment.id)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {downloadingDeclarations.has(selectedEnrollment.id) ? 'Gerando...' : 'Download Declaração de Matrícula'}
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => handleDownloadAllDocuments(selectedEnrollment)}
                              className="w-full"
                              disabled={downloadingAll.has(selectedEnrollment.id)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {downloadingAll.has(selectedEnrollment.id) ? 'Baixando...' : '📦 Baixar Todos Documentos'}
                            </Button>
                          </div>
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