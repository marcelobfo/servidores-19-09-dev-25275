import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generateCertificateForEnrollment } from '@/lib/certificateService';
import { FileText, Download, Search, Plus, Eye } from 'lucide-react';
import { FilterBar } from '@/components/admin/filters/FilterBar';
import { SearchInput } from '@/components/admin/filters/SearchInput';
import { StatusFilter } from '@/components/admin/filters/StatusFilter';
import { CourseFilter } from '@/components/admin/filters/CourseFilter';
import { DateRangeFilter } from '@/components/admin/filters/DateRangeFilter';
import { DateRange } from 'react-day-picker';

interface Certificate {
  id: string;
  certificate_code: string;
  student_name: string;
  course_name: string;
  issue_date: string;
  completion_date: string;
  status: string;
  verification_url: string;
  pre_enrollments?: {
    id: string;
    status: string;
  };
}

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingCerts, setGeneratingCerts] = useState<Set<string>>(new Set());
  
  // Additional filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  // Manual certificate generation states
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [availableEnrollments, setAvailableEnrollments] = useState<any[]>([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>('');
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [enrollmentSearchTerm, setEnrollmentSearchTerm] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // SEO
  useEffect(() => {
    document.title = 'Gestão de Certificados | Admin';
    const desc = 'Listagem e gerenciamento de certificados emitidos.';
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', window.location.href);
  }, []);

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          pre_enrollments (
            id,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCertificates(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar certificados',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEligibleEnrollments = async () => {
    setLoadingEnrollments(true);
    try {
      // Buscar pré-matrículas aprovadas que ainda não têm certificado
      const { data: enrollments, error } = await supabase
        .from('pre_enrollments')
        .select(`
          id,
          full_name,
          email,
          courses (
            name,
            duration_hours,
            duration_days,
            end_date
          )
        `)
        .in('status', ['approved', 'payment_confirmed']);

      if (error) throw error;

      // Filtrar apenas as que não têm certificado
      const { data: existingCerts } = await supabase
        .from('certificates')
        .select('enrollment_id');

      const existingEnrollmentIds = new Set(
        existingCerts?.map(cert => cert.enrollment_id) || []
      );

      // Para cada pré-matrícula, buscar dados de matrícula para calcular data de conclusão
      const eligibleWithDates = await Promise.all(
        (enrollments || [])
          .filter(enrollment => !existingEnrollmentIds.has(enrollment.id))
          .map(async (enrollment) => {
            // Buscar enrollment_date
            const { data: enrollmentRecord } = await supabase
              .from('enrollments')
              .select('enrollment_date')
              .eq('pre_enrollment_id', enrollment.id)
              .maybeSingle();

            // Calcular data de conclusão
            let completionDate = null;
            if (enrollmentRecord?.enrollment_date && enrollment.courses?.duration_days) {
              const startDate = new Date(enrollmentRecord.enrollment_date);
              completionDate = new Date(startDate);
              completionDate.setDate(completionDate.getDate() + enrollment.courses.duration_days);
            }

            return {
              ...enrollment,
              enrollment_date: enrollmentRecord?.enrollment_date,
              calculated_completion_date: completionDate
            };
          })
      );

      setAvailableEnrollments(eligibleWithDates);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar matrículas elegíveis',
        variant: 'destructive'
      });
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const handleGenerateCertificate = async (enrollmentId: string) => {
    setGeneratingCerts(prev => new Set([...prev, enrollmentId]));
    
    try {
      await generateCertificateForEnrollment(enrollmentId);
      toast({
        title: 'Sucesso',
        description: 'Certificado gerado com sucesso'
      });
      fetchCertificates();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao gerar certificado',
        variant: 'destructive'
      });
    } finally {
      setGeneratingCerts(prev => {
        const newSet = new Set(prev);
        newSet.delete(enrollmentId);
        return newSet;
      });
    }
  };

  const handleDownloadCertificate = async (certificateCode: string) => {
    try {
      // Get certificate data
      const { data: certificate, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('certificate_code', certificateCode)
        .single();

      if (error || !certificate) throw new Error('Certificado não encontrado');

      // Get system settings and course data for proper generation
      const { data: settings } = await supabase.from('system_settings').select('*').single();
      const { data: courseData } = await supabase.from('courses').select('modules, duration_hours').eq('name', certificate.course_name).single();

      if (!settings) throw new Error('Configurações do sistema não encontradas');

      // Generate PDF locally to avoid browser blocking
      const { generateCertificateWithFullData } = await import('@/lib/certificateGenerator');
      
      const pdfBlob = await generateCertificateWithFullData({
        id: certificate.id,
        studentName: certificate.student_name,
        courseName: certificate.course_name,
        courseModules: courseData?.modules || 'Módulos do curso conforme programa.',
        issueDate: new Date(certificate.issue_date),
        completionDate: new Date(certificate.completion_date),
        certificateCode: certificate.certificate_code,
        verificationUrl: `${window.location.origin}/verify-certificate/${certificate.certificate_code}`,
        courseHours: courseData?.duration_hours || 390
      }, settings);

      // Create download
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificado-${certificateCode}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Sucesso',
        description: 'Certificado baixado com sucesso'
      });
    } catch (error: any) {
      console.error('Error downloading certificate:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao baixar certificado',
        variant: 'destructive'
      });
    }
  };

  const handleViewCertificate = (certificateCode: string) => {
    const verificationUrl = `${window.location.origin}/verify-certificate/${certificateCode}`;
    window.open(verificationUrl, '_blank');
  };

  const handleCloseDialog = () => {
    setShowGenerateDialog(false);
    setSelectedEnrollmentId('');
    setEnrollmentSearchTerm('');
    setSelectedCourseFilter('all');
  };


  const filteredAvailableEnrollments = availableEnrollments.filter(enrollment => {
    const matchesSearch = enrollmentSearchTerm === "" ||
      enrollment.full_name.toLowerCase().includes(enrollmentSearchTerm.toLowerCase()) ||
      enrollment.email.toLowerCase().includes(enrollmentSearchTerm.toLowerCase());
    
    const matchesCourse = selectedCourseFilter === "all" ||
      enrollment.courses?.name === selectedCourseFilter;
    
    return matchesSearch && matchesCourse;
  });

  const filteredCertificates = certificates.filter(cert => {
    const matchesSearch = searchTerm === "" ||
      cert.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.certificate_code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || cert.status === statusFilter;
    
    const matchesCourse = selectedCourse === "all" || 
      cert.course_name.toLowerCase().includes(selectedCourse.toLowerCase());
    
    const matchesDateRange = !dateRange?.from || 
      (new Date(cert.issue_date) >= dateRange.from && 
       (!dateRange.to || new Date(cert.issue_date) <= dateRange.to));
    
    return matchesSearch && matchesStatus && matchesCourse && matchesDateRange;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSelectedCourse("all");
    setDateRange(undefined);
  };

  const statusOptions = [
    { value: "all", label: "Todos" },
    { value: "active", label: "Ativo" },
    { value: "inactive", label: "Inativo" }
  ];

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Carregando certificados...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Gestão de Certificados</h1>
        <Button onClick={() => {
          setShowGenerateDialog(true);
          fetchEligibleEnrollments();
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Gerar Certificado Manualmente
        </Button>
      </div>

        <Dialog open={showGenerateDialog} onOpenChange={handleCloseDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Gerar Certificado Manualmente</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Filtros */}
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label htmlFor="enrollment-search">Buscar Aluno</Label>
                  <Input
                    id="enrollment-search"
                    placeholder="Digite o nome ou email do aluno..."
                    value={enrollmentSearchTerm}
                    onChange={(e) => setEnrollmentSearchTerm(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="course-filter">Filtrar por Curso</Label>
                  <Select value={selectedCourseFilter} onValueChange={setSelectedCourseFilter}>
                    <SelectTrigger id="course-filter">
                      <SelectValue placeholder="Todos os cursos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os cursos</SelectItem>
                      {Array.from(new Set(availableEnrollments.map(e => e.courses?.name).filter(Boolean))).map(courseName => (
                        <SelectItem key={courseName} value={courseName!}>
                          {courseName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-sm text-muted-foreground">
                  Mostrando {filteredAvailableEnrollments.length} de {availableEnrollments.length} matrículas elegíveis
                </div>
              </div>

              <div>
                <Label htmlFor="enrollment-select">
                  Selecione a Pré-matrícula
                </Label>
                <Select 
                  value={selectedEnrollmentId} 
                  onValueChange={setSelectedEnrollmentId}
                >
                  <SelectTrigger id="enrollment-select">
                    <SelectValue placeholder="Escolha um aluno..." />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingEnrollments ? (
                      <SelectItem value="loading" disabled>
                        Carregando...
                      </SelectItem>
                    ) : filteredAvailableEnrollments.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Nenhuma matrícula encontrada
                      </SelectItem>
                    ) : (
                      filteredAvailableEnrollments.map(enrollment => (
                        <SelectItem key={enrollment.id} value={enrollment.id}>
                          {enrollment.full_name} - {enrollment.courses?.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

            {selectedEnrollmentId && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium mb-2">Detalhes da Matrícula</h4>
                {(() => {
                  const selected = availableEnrollments.find(
                    e => e.id === selectedEnrollmentId
                  );
                  if (!selected) return null;
                  
                  // Calcular data de conclusão: enrollment_date + duration_days
                  let completionDateDisplay = 'Não definida';
                  if (selected.calculated_completion_date) {
                    completionDateDisplay = new Date(selected.calculated_completion_date).toLocaleDateString('pt-BR');
                  } else if (selected.enrollment_date && selected.courses?.duration_days) {
                    const startDate = new Date(selected.enrollment_date);
                    startDate.setDate(startDate.getDate() + selected.courses.duration_days);
                    completionDateDisplay = startDate.toLocaleDateString('pt-BR');
                  }
                  
                  return (
                    <div className="space-y-1 text-sm">
                      <p><strong>Aluno:</strong> {selected.full_name}</p>
                      <p><strong>Email:</strong> {selected.email}</p>
                      <p><strong>Curso:</strong> {selected.courses?.name}</p>
                      <p><strong>Carga Horária:</strong> {selected.courses?.duration_hours}h</p>
                      <p><strong>Duração:</strong> {selected.courses?.duration_days || 'N/A'} dias</p>
                      <p><strong>Data de Matrícula:</strong> {
                        selected.enrollment_date 
                          ? new Date(selected.enrollment_date).toLocaleDateString('pt-BR')
                          : 'Não definida'
                      }</p>
                      <p><strong>Data de Conclusão:</strong> {completionDateDisplay}</p>
                    </div>
                  );
                })()}
              </div>
            )}

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleCloseDialog}
                >
                  Cancelar
                </Button>
              <Button
                onClick={async () => {
                  if (!selectedEnrollmentId) {
                    toast({
                      title: 'Atenção',
                      description: 'Selecione uma matrícula primeiro',
                      variant: 'destructive'
                    });
                    return;
                  }
                    await handleGenerateCertificate(selectedEnrollmentId);
                    handleCloseDialog();
                }}
                disabled={!selectedEnrollmentId || generatingCerts.has(selectedEnrollmentId)}
              >
                {generatingCerts.has(selectedEnrollmentId) 
                  ? 'Gerando...' 
                  : 'Gerar Certificado'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FilterBar onClearFilters={clearFilters}>
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por nome, curso ou código..."
          label="Buscar Certificados"
        />
        <StatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          label="Status do Certificado"
        />
        <CourseFilter
          value={selectedCourse}
          onChange={setSelectedCourse}
        />
        <DateRangeFilter
          value={dateRange}
          onChange={setDateRange}
          label="Data de Emissão"
        />
      </FilterBar>

      <div className="mb-4 text-sm text-muted-foreground">
        Mostrando {filteredCertificates.length} de {certificates.length} certificados
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Certificados Emitidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Estudante</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Data de Emissão</TableHead>
                <TableHead>Data de Conclusão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCertificates.map((certificate) => (
                <TableRow key={certificate.id}>
                  <TableCell className="font-mono text-sm">
                    {certificate.certificate_code}
                  </TableCell>
                  <TableCell>{certificate.student_name}</TableCell>
                  <TableCell>{certificate.course_name}</TableCell>
                  <TableCell>
                    {new Date(certificate.issue_date).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    {new Date(certificate.completion_date).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={certificate.status === 'active' ? 'default' : 'secondary'}>
                      {certificate.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewCertificate(certificate.certificate_code)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadCertificate(certificate.certificate_code)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredCertificates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhum certificado encontrado para sua busca.' : 'Nenhum certificado emitido ainda.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}