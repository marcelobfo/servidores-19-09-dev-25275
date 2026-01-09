import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchFilter } from "@/components/student/filters/SearchFilter";
import { SortOptions } from "@/components/student/filters/SortOptions";
import { Award, Download, Eye, FileText, Calendar, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { generateCertificate } from "@/lib/certificateGenerator";

interface Certificate {
  id: string;
  enrollment_id: string;
  student_name: string;
  course_name: string;
  certificate_code: string;
  issue_date: string;
  completion_date: string;
  status: string;
  verification_url: string;
  created_at: string;
  // Additional fields for correct date calculation
  enrollment_date?: string;
  duration_days?: number;
}

const sortOptions = [
  { value: "issue_date_desc", label: "Mais recentes" },
  { value: "issue_date_asc", label: "Mais antigos" },
  { value: "course_name", label: "Nome do curso" },
  { value: "completion_date", label: "Data de conclusão" },
];

export function CertificatesPage() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("issue_date_desc");

  useEffect(() => {
    if (user) {
      fetchCertificates();
    }
  }, [user]);

  const fetchCertificates = async () => {
    try {
      // First get the user's pre-enrollment IDs
      const { data: preEnrollments } = await supabase
        .from("pre_enrollments")
        .select("id")
        .eq("user_id", user?.id);
      
      const preEnrollmentIds = preEnrollments?.map(pe => pe.id) || [];
      
      if (preEnrollmentIds.length === 0) {
        setCertificates([]);
        setLoading(false);
        return;
      }

      // Get certificates
      const { data: certificatesData, error } = await supabase
        .from("certificates")
        .select("*")
        .in("enrollment_id", preEnrollmentIds)
        .eq("status", "active")
        .order("issue_date", { ascending: false });

      if (error) throw error;

      // Fetch enrollment data to get correct dates
      const { data: enrollmentsData } = await supabase
        .from("enrollments")
        .select("pre_enrollment_id, enrollment_date")
        .in("pre_enrollment_id", preEnrollmentIds);

      // Fetch course data for duration_days
      const { data: preEnrollmentsWithCourses } = await supabase
        .from("pre_enrollments")
        .select("id, courses(duration_days)")
        .in("id", preEnrollmentIds);

      // Combine data
      const enrichedCertificates = (certificatesData || []).map(cert => {
        const enrollment = enrollmentsData?.find(e => e.pre_enrollment_id === cert.enrollment_id);
        const preEnrollment = preEnrollmentsWithCourses?.find(pe => pe.id === cert.enrollment_id);
        
        return {
          ...cert,
          enrollment_date: enrollment?.enrollment_date,
          duration_days: preEnrollment?.courses?.duration_days
        };
      });

      setCertificates(enrichedCertificates);
    } catch (error) {
      console.error("Error fetching certificates:", error);
      toast.error("Erro ao carregar certificados");
    } finally {
      setLoading(false);
    }
  };

  // Calculate correct completion date based on enrollment_date + duration_days
  const getCompletionDate = (certificate: Certificate): Date => {
    if (certificate.enrollment_date && certificate.duration_days) {
      const enrollmentDate = new Date(certificate.enrollment_date);
      const completionDate = new Date(enrollmentDate);
      completionDate.setDate(completionDate.getDate() + certificate.duration_days);
      return completionDate;
    }
    // Fallback to stored completion_date
    const storedDate = new Date(certificate.completion_date);
    // Check if date is valid (not 1969/1970)
    if (storedDate.getFullYear() > 1970) {
      return storedDate;
    }
    // Last resort: use issue_date
    return new Date(certificate.issue_date);
  };

  const handleDownloadCertificate = async (certificate: Certificate) => {
    try {
      // Get system settings for proper certificate generation
      const { data: settings } = await supabase
        .from('system_settings')
        .select('*')
        .single();

      if (!settings) {
        throw new Error('System settings not found');
      }

      // Use the proper certificate generation with full data
      const { generateCertificateWithFullData } = await import('@/lib/certificateGenerator');
      
      // Get course details
      const { data: courseData } = await supabase
        .from('courses')
        .select('modules, duration_hours')
        .eq('name', certificate.course_name)
        .single();

      // Calculate correct completion date
      const completionDate = getCompletionDate(certificate);

      const pdfBlob = await generateCertificateWithFullData({
        id: certificate.id,
        studentName: certificate.student_name,
        courseName: certificate.course_name,
        courseModules: courseData?.modules || 'Módulos do curso conforme programa.',
        issueDate: new Date(certificate.issue_date),
        completionDate: completionDate,
        certificateCode: certificate.certificate_code,
        verificationUrl: certificate.verification_url,
        courseHours: courseData?.duration_hours || 390
      }, settings);

      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificado-${certificate.certificate_code}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Certificado baixado com sucesso!");
    } catch (error) {
      console.error("Error downloading certificate:", error);
      toast.error("Erro ao baixar certificado");
    }
  };

  const handleViewCertificate = (certificate: Certificate) => {
    const verificationUrl = `${window.location.origin}/verify-certificate/${certificate.certificate_code}`;
    window.open(verificationUrl, "_blank");
  };

  const filteredAndSortedCertificates = certificates
    .filter(certificate => {
      if (searchTerm && !certificate.course_name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "issue_date_asc":
          return new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime();
        case "course_name":
          return a.course_name.localeCompare(b.course_name);
        case "completion_date":
          return new Date(b.completion_date).getTime() - new Date(a.completion_date).getTime();
        default: // issue_date_desc
          return new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime();
      }
    });

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
        <h1 className="text-2xl font-bold text-foreground">Meus Certificados</h1>
        <p className="text-muted-foreground">
          Visualize e baixe seus certificados de conclusão de curso
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

      {filteredAndSortedCertificates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Award className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum certificado encontrado</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm 
                ? "Tente ajustar a busca para ver mais resultados."
                : "Você ainda não possui certificados. Complete seus cursos para receber os certificados de conclusão."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAndSortedCertificates.map((certificate) => (
            <Card key={certificate.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      {certificate.course_name}
                    </CardTitle>
                    <CardDescription>
                      Certificado emitido em {new Date(certificate.issue_date).toLocaleDateString("pt-BR")}
                    </CardDescription>
                  </div>
                  <Badge variant="default">Ativo</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Estudante:</strong> {certificate.student_name}
                    </div>
                    <div>
                      <strong>Código do Certificado:</strong> {certificate.certificate_code}
                    </div>
                    <div>
                      <strong>Data de Conclusão:</strong>{" "}
                      {getCompletionDate(certificate).toLocaleDateString("pt-BR")}
                    </div>
                    <div>
                      <strong>Data de Emissão:</strong>{" "}
                      {new Date(certificate.issue_date).toLocaleDateString("pt-BR")}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => handleDownloadCertificate(certificate)}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Baixar Certificado
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => handleViewCertificate(certificate)}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Verificar Autenticidade
                    </Button>
                  </div>

                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Eye className="h-4 w-4" />
                      <span>
                        Este certificado pode ser verificado online usando o código: {certificate.certificate_code}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}