import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { 
  DocumentTemplate, 
  MOCK_PREVIEW_DATA,
} from "@/types/document-templates";
import { generatePdfFromTemplate } from "@/lib/dynamicPdfGenerator";

interface DocumentPreviewProps {
  template: DocumentTemplate;
}

export function DocumentPreview({ template }: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewDataSource, setPreviewDataSource] = useState<'mock' | string>('mock');
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch system settings
  const { data: systemSettings } = useQuery({
    queryKey: ['system-settings-preview'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .single();
      return data;
    },
  });

  // Fetch pre-enrollments for testing
  const { data: preEnrollments } = useQuery({
    queryKey: ['pre-enrollments-preview'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pre_enrollments')
        .select(`
          id,
          full_name,
          cpf,
          organization,
          courses (
            name,
            duration_hours,
            modules,
            start_date,
            end_date,
            enrollment_fee,
            pre_enrollment_fee
          )
        `)
        .limit(10);
      return data || [];
    },
  });

  // Generate preview PDF
  useEffect(() => {
    const generatePreview = async () => {
      setIsGenerating(true);
      try {
        let previewData = MOCK_PREVIEW_DATA;

        // If using real data
        if (previewDataSource !== 'mock' && preEnrollments) {
          const selectedEnrollment = preEnrollments.find(e => e.id === previewDataSource);
          if (selectedEnrollment) {
            const course = selectedEnrollment.courses as any;
            previewData = {
              ...MOCK_PREVIEW_DATA,
              student_name: selectedEnrollment.full_name?.toUpperCase() || 'ALUNO TESTE',
              student_cpf: selectedEnrollment.cpf || '000.000.000-00',
              organization: selectedEnrollment.organization || 'Organização',
              course_name: course?.name || 'Curso Teste',
              course_hours: course?.duration_hours || 390,
              effective_hours: course?.duration_hours || 195,
              start_date: formatDate(course?.start_date),
              end_date: formatDate(course?.end_date),
              enrollment_fee: formatCurrency(course?.enrollment_fee || 0),
              pre_enrollment_credit: formatCurrency(course?.pre_enrollment_fee || 0),
              final_amount: formatCurrency((course?.enrollment_fee || 0) - (course?.pre_enrollment_fee || 0)),
              modules: parseModules(course?.modules),
            };
          }
        }

        const settings = systemSettings || {
          institution_name: 'Instituto Educacional',
          institution_address: 'Rua Exemplo, 123 - Centro',
          institution_cep: '00000-000',
          institution_cnpj: '00.000.000/0001-00',
          institution_phone: '(11) 99999-9999',
          institution_email: 'contato@exemplo.com',
          institution_website: 'www.exemplo.com',
          director_name: 'Dr. João da Silva',
          director_title: 'Diretor Acadêmico',
        };

        const pdfBlob = await generatePdfFromTemplate(template, previewData, settings);
        const url = URL.createObjectURL(pdfBlob);
        
        // Clean up old URL
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }
        
        setPdfUrl(url);
      } catch (error) {
        console.error('Error generating preview:', error);
      } finally {
        setIsGenerating(false);
      }
    };

    generatePreview();

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [template, previewDataSource, systemSettings]);

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '01/01/2025';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseModules = (modulesStr?: string): Array<{ name: string; hours: number }> => {
    if (!modulesStr) return MOCK_PREVIEW_DATA.modules;
    try {
      const parsed = JSON.parse(modulesStr);
      if (Array.isArray(parsed)) {
        return parsed.map(m => ({
          name: m.name || m.nome || m.title || 'Módulo',
          hours: m.hours || m.carga_horaria || 40,
        }));
      }
    } catch {
      // Return mock modules on error
    }
    return MOCK_PREVIEW_DATA.modules;
  };

  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${template.name.replace(/\s+/g, '_')}_preview.pdf`;
      link.click();
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoom(100);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select value={previewDataSource} onValueChange={setPreviewDataSource}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Dados de exemplo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mock">Dados de Exemplo</SelectItem>
              {preEnrollments?.map(enrollment => (
                <SelectItem key={enrollment.id} value={enrollment.id}>
                  {enrollment.full_name?.substring(0, 30)}...
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-12 text-center">{zoom}%</span>
          <Button variant="outline" size="icon" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleResetZoom}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleDownload} disabled={!pdfUrl}>
            <Download className="h-4 w-4 mr-2" />
            Baixar PDF
          </Button>
        </div>
      </div>

      {/* Preview Area */}
      <Card 
        ref={containerRef}
        className="bg-gray-100 dark:bg-gray-900 p-4 overflow-auto min-h-[600px] flex items-center justify-center"
      >
        {isGenerating ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Gerando preview...</span>
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="bg-white shadow-lg"
            style={{
              width: `${(210 * zoom) / 100}mm`,
              height: `${(297 * zoom) / 100}mm`,
              minHeight: '500px',
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
            }}
            title="Document Preview"
          />
        ) : (
          <div className="text-muted-foreground text-center">
            <p>Não foi possível gerar o preview.</p>
            <p className="text-sm">Verifique as configurações do template.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
