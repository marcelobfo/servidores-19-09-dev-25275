import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, Globe, Zap } from "lucide-react";

interface PaymentSettings {
  id?: string;
  enabled: boolean;
  pricing_type: string;
  fixed_price: number | null;
  currency: string;
  payment_description: string;
  environment: string;
  asaas_api_key: string | null;
  asaas_api_key_sandbox: string | null;
  asaas_api_key_production: string | null;
  asaas_webhook_token: string | null;
  asaas_base_url_sandbox: string;
  asaas_base_url_production: string;
}

interface TestResult {
  success: boolean;
  url: string;
  accountName?: string;
  message: string;
}

export default function PaymentSettingsPage() {
  const [settings, setSettings] = useState<PaymentSettings>({
    enabled: false,
    pricing_type: 'fixed',
    fixed_price: null,
    currency: 'BRL',
    payment_description: 'Taxa de matrícula - Licença Capacitação',
    environment: 'sandbox',
    asaas_api_key: null,
    asaas_api_key_sandbox: null,
    asaas_api_key_production: null,
    asaas_webhook_token: null,
    asaas_base_url_sandbox: 'https://api-sandbox.asaas.com/v3',
    asaas_base_url_production: 'https://api.asaas.com/v3',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          enabled: data.enabled || false,
          pricing_type: data.pricing_type || 'fixed',
          fixed_price: data.fixed_price,
          currency: data.currency || 'BRL',
          payment_description: data.payment_description || 'Taxa de matrícula - Licença Capacitação',
          environment: data.environment || 'sandbox',
          asaas_api_key: data.asaas_api_key,
          asaas_api_key_sandbox: data.asaas_api_key_sandbox,
          asaas_api_key_production: data.asaas_api_key_production,
          asaas_webhook_token: data.asaas_webhook_token,
          asaas_base_url_sandbox: (data as any).asaas_base_url_sandbox || 'https://api-sandbox.asaas.com/v3',
          asaas_base_url_production: (data as any).asaas_base_url_production || 'https://api.asaas.com/v3',
        });
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações de pagamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testAsaasConnection = async () => {
    const currentApiKey = settings.environment === 'production' 
      ? settings.asaas_api_key_production 
      : settings.asaas_api_key_sandbox;
      
    if (!currentApiKey) {
      toast({
        title: "Erro",
        description: `Chave API do ambiente ${settings.environment} não configurada`,
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    
    try {
      // Use the configured base URL
      const baseUrl = settings.environment === 'production' 
        ? settings.asaas_base_url_production 
        : settings.asaas_base_url_sandbox;
      
      const apiUrl = `${baseUrl}/myAccount`;
      
      console.log(`🔍 Testando conexão Asaas: ${apiUrl}`);
        
      const response = await fetch(apiUrl, {
        headers: {
          'access_token': currentApiKey,
          'Content-Type': 'application/json',
        },
      });

      const responseText = await response.text();
      console.log(`📊 Resposta: ${response.status}`, responseText);

      if (response.ok) {
        let accountData;
        try {
          accountData = JSON.parse(responseText);
        } catch {
          accountData = {};
        }
        
        setTestResult({
          success: true,
          url: apiUrl,
          accountName: accountData.name || accountData.tradingName || 'Conta Asaas',
          message: `Conexão estabelecida com sucesso!`,
        });
        
        toast({
          title: "Sucesso",
          description: `Conexão com Asaas (${settings.environment}) estabelecida!`,
        });
      } else {
        setTestResult({
          success: false,
          url: apiUrl,
          message: `Erro ${response.status}: ${responseText.substring(0, 200)}`,
        });
        
        toast({
          title: "Erro",
          description: `Falha na conexão. Verifique a chave API e a URL.`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error testing Asaas connection:', error);
      
      setTestResult({
        success: false,
        url: settings.environment === 'production' 
          ? settings.asaas_base_url_production 
          : settings.asaas_base_url_sandbox,
        message: `Erro de conexão: ${error.message}`,
      });
      
      toast({
        title: "Erro",
        description: "Erro ao testar conexão com Asaas",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    // Validar ambiente e chaves API
    if (settings.enabled) {
      const currentApiKey = settings.environment === 'production' 
        ? settings.asaas_api_key_production 
        : settings.asaas_api_key_sandbox;
        
      if (!currentApiKey || currentApiKey.trim() === '') {
        toast({
          title: "Erro de Configuração",
          description: `A chave API do ambiente ${settings.environment} é obrigatória quando o sistema está habilitado.`,
          variant: "destructive",
        });
        return;
      }

      if (!currentApiKey.startsWith('$aact_')) {
        toast({
          title: "Erro de Configuração",
          description: `A chave API do Asaas deve começar com "$aact_". Verifique se copiou corretamente.`,
          variant: "destructive",
        });
        return;
      }
    }

    // Validar pricing_type
    if (settings.pricing_type === 'fixed') {
      if (!settings.fixed_price || settings.fixed_price <= 0) {
        toast({
          title: "Erro de Configuração",
          description: "Preço fixo deve ser maior que zero quando o tipo de preço é fixo",
          variant: "destructive",
        });
        return;
      }

      if (settings.fixed_price < 5) {
        toast({
          title: "Erro de Configuração",
          description: "O valor mínimo para pagamento é R$ 5,00 (requisito da Asaas)",
          variant: "destructive",
        });
        return;
      }
    }

    // Validar URLs
    const urlPattern = /^https:\/\/.+/;
    if (!urlPattern.test(settings.asaas_base_url_sandbox)) {
      toast({
        title: "Erro de Configuração",
        description: "URL Sandbox inválida. Deve começar com https://",
        variant: "destructive",
      });
      return;
    }
    if (!urlPattern.test(settings.asaas_base_url_production)) {
      toast({
        title: "Erro de Configuração",
        description: "URL Produção inválida. Deve começar com https://",
        variant: "destructive",
      });
      return;
    }

    if (settings.enabled && (!settings.asaas_webhook_token || settings.asaas_webhook_token.trim() === '')) {
      toast({
        title: "Aviso",
        description: "Token do webhook não configurado. Os webhooks não funcionarão até você configurar.",
        variant: "default",
      });
    }

    setSaving(true);
    try {
      const saveData: any = { ...settings };
      
      const { error } = settings.id
        ? await supabase
            .from('payment_settings')
            .update(saveData)
            .eq('id', settings.id)
        : await supabase
            .from('payment_settings')
            .insert([saveData]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Configurações de pagamento salvas com sucesso!",
      });
      
      await fetchSettings();
    } catch (error: any) {
      console.error('Error saving payment settings:', error);
      
      if (error.code === '42501') {
        toast({
          title: "Erro de Permissão",
          description: "Você não tem permissão para salvar configurações. Verifique se você é administrador.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao Salvar",
          description: error.message || "Erro ao salvar configurações",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof PaymentSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const resetUrlToDefault = (field: 'asaas_base_url_sandbox' | 'asaas_base_url_production') => {
    const defaults = {
      asaas_base_url_sandbox: 'https://api-sandbox.asaas.com/v3',
      asaas_base_url_production: 'https://api.asaas.com/v3',
    };
    updateField(field, defaults[field]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const activeBaseUrl = settings.environment === 'production' 
    ? settings.asaas_base_url_production 
    : settings.asaas_base_url_sandbox;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações de Pagamento</h1>
        <p className="text-muted-foreground">
          Configure o sistema de pagamentos e integração com Asaas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status do Sistema</CardTitle>
          <CardDescription>
            Ative ou desative o sistema de pagamentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="payment-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => updateField('enabled', checked)}
            />
            <Label htmlFor="payment-enabled">
              {settings.enabled ? 'Sistema de pagamento ativo' : 'Sistema de pagamento inativo'}
            </Label>
          </div>
          {!settings.enabled && (
            <p className="text-sm text-muted-foreground">
              Quando desativado, as pré-matrículas vão direto para "pendente de aprovação"
            </p>
          )}
        </CardContent>
      </Card>

      {settings.enabled && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Preços</CardTitle>
              <CardDescription>
                Defina como os preços serão calculados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={settings.pricing_type}
                onValueChange={(value) => updateField('pricing_type', value)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed">Preço fixo para todos os cursos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="per_course" id="per_course" />
                  <Label htmlFor="per_course">Preço individual por curso</Label>
                </div>
              </RadioGroup>

              {settings.pricing_type === 'fixed' && (
                <div className="space-y-2">
                  <Label htmlFor="fixed-price">Preço Fixo (R$)</Label>
                  <Input
                    id="fixed-price"
                    type="number"
                    step="0.01"
                    value={settings.fixed_price || ''}
                    onChange={(e) => updateField('fixed_price', parseFloat(e.target.value) || null)}
                    placeholder="Ex: 50.00"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="payment-description">Descrição do Pagamento</Label>
                <Textarea
                  id="payment-description"
                  value={settings.payment_description}
                  onChange={(e) => updateField('payment_description', e.target.value)}
                  placeholder="Descrição que aparecerá no pagamento PIX"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                URLs da API Asaas
              </CardTitle>
              <CardDescription>
                Configure as URLs base da API Asaas. Use os valores padrão a menos que precise de uma configuração específica.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="asaas-base-url-sandbox">URL Base - Sandbox</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => resetUrlToDefault('asaas_base_url_sandbox')}
                    className="text-xs"
                  >
                    Restaurar padrão
                  </Button>
                </div>
                <Input
                  id="asaas-base-url-sandbox"
                  value={settings.asaas_base_url_sandbox}
                  onChange={(e) => updateField('asaas_base_url_sandbox', e.target.value)}
                  placeholder="https://api-sandbox.asaas.com/v3"
                />
                <p className="text-xs text-muted-foreground">
                  Padrão: https://api-sandbox.asaas.com/v3
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="asaas-base-url-production">URL Base - Produção</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => resetUrlToDefault('asaas_base_url_production')}
                    className="text-xs"
                  >
                    Restaurar padrão
                  </Button>
                </div>
                <Input
                  id="asaas-base-url-production"
                  value={settings.asaas_base_url_production}
                  onChange={(e) => updateField('asaas_base_url_production', e.target.value)}
                  placeholder="https://api.asaas.com/v3"
                />
                <p className="text-xs text-muted-foreground">
                  Padrão: https://api.asaas.com/v3
                </p>
              </div>

              <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium text-primary mb-1">
                  <Zap className="h-4 w-4" />
                  Endpoint Ativo
                </div>
                <code className="text-xs bg-background p-2 rounded block font-mono">
                  {activeBaseUrl}/payments
                </code>
                <p className="text-xs text-muted-foreground mt-1">
                  Este é o endpoint que será usado para criar pagamentos no ambiente {settings.environment}.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Credenciais Asaas</CardTitle>
              <CardDescription>
                Configure as chaves de API do Asaas para processar pagamentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="environment">Ambiente da API</Label>
                <RadioGroup
                  value={settings.environment}
                  onValueChange={(value) => updateField('environment', value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sandbox" id="sandbox" />
                    <Label htmlFor="sandbox">Sandbox (Testes)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="production" id="production" />
                    <Label htmlFor="production">Produção</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  {settings.environment === 'sandbox' 
                    ? 'Ambiente de testes - Use para desenvolvimento e testes'
                    : 'Ambiente de produção - Use apenas para pagamentos reais'
                  }
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="asaas-api-key-sandbox">Chave API - Sandbox</Label>
                <Input
                  id="asaas-api-key-sandbox"
                  type="password"
                  value={settings.asaas_api_key_sandbox || ''}
                  onChange={(e) => updateField('asaas_api_key_sandbox', e.target.value)}
                  placeholder="$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzPTNmI2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asaas-api-key-production">Chave API - Produção</Label>
                <Input
                  id="asaas-api-key-production"
                  type="password"
                  value={settings.asaas_api_key_production || ''}
                  onChange={(e) => updateField('asaas_api_key_production', e.target.value)}
                  placeholder="$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzPTNmI2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asaas-webhook-token">Token do Webhook</Label>
                <Input
                  id="asaas-webhook-token"
                  value={settings.asaas_webhook_token || ''}
                  onChange={(e) => updateField('asaas_webhook_token', e.target.value)}
                  placeholder="Token para validar webhooks do Asaas"
                />
              </div>

              {(settings.asaas_api_key_sandbox || settings.asaas_api_key_production) && (
                <div className="space-y-3">
                  <Button
                    onClick={testAsaasConnection}
                    disabled={testing}
                    variant="outline"
                    className="w-full"
                  >
                    {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Testar Conexão - {settings.environment === 'production' ? 'Produção' : 'Sandbox'}
                  </Button>

                  {testResult && (
                    <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-destructive/10 border-destructive/30'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {testResult.success ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                        <span className={`font-medium ${testResult.success ? 'text-foreground' : 'text-destructive'}`}>
                          {testResult.success ? 'Conexão OK' : 'Falha na Conexão'}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-sm">
                        <div>
                          <span className="text-muted-foreground">URL testada: </span>
                          <code className="bg-background px-1 rounded text-xs">{testResult.url}</code>
                        </div>
                        {testResult.accountName && (
                          <div>
                            <span className="text-muted-foreground">Conta: </span>
                            <span className="font-medium">{testResult.accountName}</span>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
                          {testResult.message}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Configuração do Webhook</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Configure o seguinte URL no painel do Asaas:
                </p>
                <code className="text-xs bg-background p-2 rounded block">
                  https://lavqzqqfsdtduwphzehr.supabase.co/functions/v1/webhook-asaas
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Use a mesma URL para ambos os ambientes (sandbox e produção)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Diagnóstico do Sistema</CardTitle>
              <CardDescription>
                Verifique o status das configurações de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Sistema de Pagamento</span>
                <span className={`text-xs px-2 py-1 rounded ${settings.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}`}>
                  {settings.enabled ? "Ativo" : "Inativo"}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Ambiente Atual</span>
                <span className={`text-xs px-2 py-1 rounded ${settings.environment === 'production' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>
                  {settings.environment === 'production' ? "Produção" : "Sandbox"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">URL Base Ativa</span>
                <code className="text-xs px-2 py-1 rounded bg-muted font-mono">
                  {activeBaseUrl}
                </code>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Chave API Sandbox</span>
                <span className={`text-xs px-2 py-1 rounded ${settings.asaas_api_key_sandbox ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}`}>
                  {settings.asaas_api_key_sandbox ? "Configurada" : "Não configurada"}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Chave API Produção</span>
                <span className={`text-xs px-2 py-1 rounded ${settings.asaas_api_key_production ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}`}>
                  {settings.asaas_api_key_production ? "Configurada" : "Não configurada"}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Token Webhook</span>
                <span className={`text-xs px-2 py-1 rounded ${settings.asaas_webhook_token ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}`}>
                  {settings.asaas_webhook_token ? "Configurado" : "Não configurado"}
                </span>
              </div>

              {settings.pricing_type === 'fixed' && settings.fixed_price && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Preço Fixo</span>
                  <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    R$ {settings.fixed_price.toFixed(2)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Salvar Configurações
      </Button>
    </div>
  );
}
