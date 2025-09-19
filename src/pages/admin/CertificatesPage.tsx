import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(`certificates/${certificateCode}.pdf`);
      
      window.open(data.publicUrl, '_blank');
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao baixar certificado',
        variant: 'destructive'
      });
    }
  };

  const handleViewCertificate = (certificateCode: string) => {
    navigate(`/verify-certificate/${certificateCode}`);
  };

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
        <Button onClick={() => navigate('/admin/enrollments')}>
          <Plus className="w-4 h-4 mr-2" />
          Gerar Certificados
        </Button>
      </div>

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