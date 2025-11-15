import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Upload, Image as ImageIcon, Globe, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { testWebhook } from "@/lib/webhookService";

interface SystemSettings {
  id: string;
  institution_name: string;
  institution_address: string;
  institution_cep: string;
  institution_cnpj: string;
  institution_phone: string;
  institution_email: string;
  institution_website: string;
  director_name: string;
  director_title: string;
  logo_url: string;
  director_signature_url: string;
  n8n_webhook_url?: string;
  webhook_events?: string[];
  gemini_api_key?: string;
}

interface WebhookLog {
  id: string;
  event_type: string;
  success: boolean;
  response_status: number;
  created_at: string;
}

const SystemSettingsPage = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testingGeminiKey, setTestingGeminiKey] = useState(false);
  const [geminiKeyStatus, setGeminiKeyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    fetchWebhookLogs();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .update(settings)
        .eq("id", settings.id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso!"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const fetchWebhookLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("webhook_logs")
        .select("id, event_type, success, response_status, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setWebhookLogs(data || []);
    } catch (error) {
      console.error("Error fetching webhook logs:", error);
    }
  };

  const updateField = (field: keyof SystemSettings, value: string | string[]) => {
    if (settings) {
      setSettings({ ...settings, [field]: value });
    }
  };

  const handleTestWebhook = async () => {
    if (!settings?.n8n_webhook_url) {
      toast({
        title: "Erro",
        description: "Configure a URL do webhook primeiro",
        variant: "destructive"
      });
      return;
    }

    setTestingWebhook(true);
    try {
      const result = await testWebhook(settings.n8n_webhook_url);
      toast({
        title: result.success ? "Sucesso" : "Erro",
        description: result.message,
        variant: result.success ? "default" : "destructive"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao testar webhook",
        variant: "destructive"
      });
    } finally {
      setTestingWebhook(false);
      fetchWebhookLogs();
    }
  };

  const handleTestGeminiKey = async () => {
    if (!settings?.gemini_api_key) {
      toast({
        title: "Erro",
        description: "Digite uma API Key primeiro",
        variant: "destructive"
      });
      return;
    }

    setTestingGeminiKey(true);
    setGeminiKeyStatus('idle');
    
    try {
      const { data, error } = await supabase.functions.invoke('test-gemini-api-key', {
        body: { apiKey: settings.gemini_api_key }
      });

      if (error) throw error;

      if (data.success) {
        setGeminiKeyStatus('success');
        toast({
          title: "✅ API Key Válida",
          description: data.message
        });
      } else {
        setGeminiKeyStatus('error');
        toast({
          title: "❌ API Key Inválida",
          description: data.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      setGeminiKeyStatus('error');
      toast({
        title: "❌ Erro ao testar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setTestingGeminiKey(false);
    }
  };

  const toggleWebhookEvent = (event: string) => {
    if (!settings) return;
    
    const currentEvents = settings.webhook_events || [];
    const newEvents = currentEvents.includes(event)
      ? currentEvents.filter(e => e !== event)
      : [...currentEvents, event];
    
    updateField('webhook_events', newEvents);
  };

  const handleFileUpload = async (file: File, field: 'logo_url' | 'director_signature_url') => {
    if (!file) return;

    setUploading(field);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${field}_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      updateField(field, data.publicUrl);
      
      toast({
        title: "Upload realizado com sucesso",
        description: `${field === 'logo_url' ? 'Logo' : 'Assinatura'} enviado(a) com sucesso.`,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível enviar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  if (!settings) {
    return <div>Configurações não encontradas</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
          <p className="text-muted-foreground">
            Configure as informações institucionais e documentos
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações Institucionais</CardTitle>
            <CardDescription>
              Dados que aparecerão nos documentos gerados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="institution_name">Nome da Instituição</Label>
                <Input
                  id="institution_name"
                  value={settings.institution_name}
                  onChange={(e) => updateField("institution_name", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="institution_cnpj">CNPJ</Label>
                <Input
                  id="institution_cnpj"
                  value={settings.institution_cnpj}
                  onChange={(e) => updateField("institution_cnpj", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="institution_address">Endereço</Label>
              <Input
                id="institution_address"
                value={settings.institution_address}
                onChange={(e) => updateField("institution_address", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="institution_cep">CEP</Label>
                <Input
                  id="institution_cep"
                  value={settings.institution_cep}
                  onChange={(e) => updateField("institution_cep", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="institution_phone">Telefone</Label>
                <Input
                  id="institution_phone"
                  value={settings.institution_phone}
                  onChange={(e) => updateField("institution_phone", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="institution_email">Email</Label>
                <Input
                  id="institution_email"
                  type="email"
                  value={settings.institution_email}
                  onChange={(e) => updateField("institution_email", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="institution_website">Website</Label>
              <Input
                id="institution_website"
                value={settings.institution_website}
                onChange={(e) => updateField("institution_website", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Diretor Acadêmico</CardTitle>
            <CardDescription>
              Informações do diretor que assina os documentos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="director_name">Nome do Diretor</Label>
                <Input
                  id="director_name"
                  value={settings.director_name}
                  onChange={(e) => updateField("director_name", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="director_title">Cargo</Label>
                <Input
                  id="director_title"
                  value={settings.director_title}
                  onChange={(e) => updateField("director_title", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documentos e Imagens</CardTitle>
            <CardDescription>Upload de logo e assinatura para os documentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="logo_url">Logo da Instituição</Label>
              <div className="space-y-2">
                <Input
                  id="logo_url"
                  value={settings.logo_url || ""}
                  onChange={(e) => updateField("logo_url", e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading === 'logo_url'}
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    {uploading === 'logo_url' ? (
                      "Enviando..."
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Logo
                      </>
                    )}
                  </Button>
                  {settings.logo_url && (
                    <div className="flex items-center space-x-2">
                      <ImageIcon className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-500">Logo carregado</span>
                    </div>
                  )}
                </div>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'logo_url');
                  }}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="director_signature_url">Assinatura do Diretor</Label>
              <div className="space-y-2">
                <Input
                  id="director_signature_url"
                  value={settings.director_signature_url || ""}
                  onChange={(e) => updateField("director_signature_url", e.target.value)}
                  placeholder="https://example.com/assinatura.png"
                />
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading === 'director_signature_url'}
                    onClick={() => document.getElementById('signature-upload')?.click()}
                  >
                    {uploading === 'director_signature_url' ? (
                      "Enviando..."
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Assinatura
                      </>
                    )}
                  </Button>
                  {settings.director_signature_url && (
                    <div className="flex items-center space-x-2">
                      <ImageIcon className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-500">Assinatura carregada</span>
                    </div>
                  )}
                </div>
                <input
                  id="signature-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'director_signature_url');
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Integração N8N
            </CardTitle>
            <CardDescription>
              Configure webhooks para enviar dados de matrículas para N8N
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="n8n_webhook_url">URL do Webhook N8N</Label>
              <div className="flex gap-2">
                <Input
                  id="n8n_webhook_url"
                  value={settings.n8n_webhook_url || ""}
                  onChange={(e) => updateField("n8n_webhook_url", e.target.value)}
                  placeholder="https://n8n.seudominio.com/webhook/matriculas"
                />
                <Button 
                  variant="outline" 
                  onClick={handleTestWebhook}
                  disabled={testingWebhook || !settings.n8n_webhook_url}
                >
                  {testingWebhook ? "Testando..." : "Testar"}
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Eventos para Enviar</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  { key: 'enrollment_created', label: 'Matrícula Criada' },
                  { key: 'payment_confirmed', label: 'Pagamento Confirmado' },
                  { key: 'enrollment_approved', label: 'Matrícula Aprovada' },
                  { key: 'status_changed', label: 'Status Alterado' }
                ].map((event) => (
                  <Badge
                    key={event.key}
                    variant={settings.webhook_events?.includes(event.key) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleWebhookEvent(event.key)}
                  >
                    {event.label}
                  </Badge>
                ))}
              </div>
            </div>

            {webhookLogs.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Últimos Webhooks Enviados</Label>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  {webhookLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span>{log.event_type}</span>
                        <Badge variant="outline" className="text-xs">
                          {log.response_status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs">
                          {new Date(log.created_at).toLocaleDateString('pt-BR')} {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Integração com IA (Gemini)
            </CardTitle>
            <CardDescription>
              Geração de capas de cursos com IA usando Google AI Studio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="gemini_api_key">Google AI Studio API Key</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="gemini_api_key"
                    type="password"
                    value={settings.gemini_api_key || ""}
                    onChange={(e) => {
                      updateField("gemini_api_key", e.target.value);
                      setGeminiKeyStatus('idle');
                    }}
                    placeholder="Digite sua chave API do Google AI Studio"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleTestGeminiKey}
                    disabled={testingGeminiKey || !settings.gemini_api_key}
                    variant="outline"
                    size="default"
                  >
                    {testingGeminiKey ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Testar
                      </>
                    )}
                  </Button>
                </div>
                
                {geminiKeyStatus === 'success' && (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    API Key válida e funcionando
                  </Badge>
                )}
                {geminiKeyStatus === 'error' && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    API Key inválida ou com erro
                  </Badge>
                )}
                
                <p className="text-xs text-muted-foreground">
                  Modelo: <strong>gemini-2.5-flash-image-preview</strong> (Nano Banana)
                  <br />
                  Obtenha sua chave em:{" "}
                  <a 
                    href="https://aistudio.google.com/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SystemSettingsPage;