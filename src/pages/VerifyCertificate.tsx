import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getCertificateByCode } from '@/lib/certificateService';
import { Shield, Download, CheckCircle, AlertCircle, Search } from 'lucide-react';

interface CertificateData {
  id: string;
  certificate_code: string;
  student_name: string;
  course_name: string;
  issue_date: string;
  completion_date: string;
  status: string;
  verification_url: string;
  pre_enrollments?: {
    full_name: string;
    courses: {
      name: string;
      duration_hours: number;
    };
  };
}

export default function VerifyCertificate() {
  const { code } = useParams();
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchCode, setSearchCode] = useState(code || '');

  // SEO
  useEffect(() => {
    document.title = 'Verificação de Certificado | Servidores';
    const desc = 'Verifique a autenticidade do seu certificado usando o código de verificação.';
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
    if (code) {
      verifyCertificate(code);
    }
  }, [code]);

  const verifyCertificate = async (certificateCode: string) => {
    setLoading(true);
    setError('');
    setCertificate(null);

    try {
      const data = await getCertificateByCode(certificateCode);
      setCertificate(data);
    } catch (error: any) {
      setError('Certificado não encontrado ou inválido');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchCode.trim()) {
      verifyCertificate(searchCode.trim().toUpperCase());
    }
  };

  const handleDownload = () => {
    if (certificate?.verification_url) {
      window.open(certificate.verification_url, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Verificação de Certificado</h1>
              <p className="text-muted-foreground">
                Verifique a autenticidade de certificados emitidos
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Search Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Buscar Certificado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Digite o código do certificado (ex: CERT-ABC123)"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? 'Verificando...' : 'Verificar'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="w-6 h-6" />
                <div>
                  <h3 className="font-semibold">Certificado não encontrado</h3>
                  <p className="text-sm opacity-90">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {certificate && (
          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-green-700 dark:text-green-300">
                <CheckCircle className="w-6 h-6" />
                Certificado Válido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Certificate Info */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Código do Certificado
                    </label>
                    <p className="font-mono text-lg font-semibold">
                      {certificate.certificate_code}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Estudante
                    </label>
                    <p className="text-lg font-semibold">{certificate.student_name}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Curso
                    </label>
                    <p className="text-lg font-semibold">{certificate.course_name}</p>
                  </div>

                  {certificate.pre_enrollments?.courses?.duration_hours && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Carga Horária
                      </label>
                      <p className="text-lg">
                        {certificate.pre_enrollments.courses.duration_hours} horas
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Data de Emissão
                    </label>
                    <p className="text-lg">
                      {new Date(certificate.issue_date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Data de Conclusão
                    </label>
                    <p className="text-lg">
                      {new Date(certificate.completion_date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Status
                    </label>
                    <div className="mt-1">
                      <Badge variant={certificate.status === 'active' ? 'default' : 'secondary'}>
                        {certificate.status === 'active' ? 'Válido' : 'Inativo'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4 border-t">
                <Button onClick={handleDownload} className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Baixar Certificado
                </Button>
              </div>

              {/* Verification Note */}
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <h4 className="font-semibold mb-1">Certificado Autêntico</h4>
                    <p>
                      Este certificado foi emitido digitalmente e sua autenticidade foi verificada 
                      em nossa base de dados. Ele possui validade legal conforme legislação vigente.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!certificate && !error && !loading && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">
                Digite um código para verificar
              </h3>
              <p>
                Insira o código do certificado no campo acima para verificar sua autenticidade.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}