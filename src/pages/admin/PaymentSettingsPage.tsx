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
import { Loader2 } from "lucide-react";

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
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
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
    try {
      // Test connection by trying to fetch account info
      const apiUrl = settings.environment === 'production' 
        ? 'https://api.asaas.com/v3/myAccount'
        : 'https://sandbox.asaas.com/api/v3/myAccount';
        
      const response = await fetch(apiUrl, {
        headers: {
          'access_token': currentApiKey,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: `Conexão com Asaas (${settings.environment}) estabelecida com sucesso!`,
        });
      } else {
        const errorData = await response.text();
        console.error('Asaas connection test failed:', response.status, errorData);
        toast({
          title: "Erro",
          description: `Falha na conexão com Asaas (${settings.environment}). Verifique a chave API.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error testing Asaas connection:', error);
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
      // Validar chave do ambiente atual
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

      // Validar formato da chave API
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

    // Validar webhook token
    if (settings.enabled && (!settings.asaas_webhook_token || settings.asaas_webhook_token.trim() === '')) {
      toast({
        title: "Aviso",
        description: "Token do webhook não configurado. Os webhooks não funcionarão até você configurar.",
        variant: "default",
      });
    }

    setSaving(true);
    try {
      const { error } = settings.id
        ? await supabase
            .from('payment_settings')
            .update(settings)
            .eq('id', settings.id)
        : await supabase
            .from('payment_settings')
            .insert([settings]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Configurações de pagamento salvas com sucesso!",
      });
      
      // Recarregar settings após salvar
      await fetchSettings();
    } catch (error: any) {
      console.error('Error saving payment settings:', error);
      
      // Erro específico de RLS
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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
              <CardTitle>Integração Asaas</CardTitle>
              <CardDescription>
                Configure as credenciais da API do Asaas para processar pagamentos PIX
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
                 <Button
                   onClick={testAsaasConnection}
                   disabled={testing}
                   variant="outline"
                   className="w-full"
                 >
                   {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   Testar Conexão - {settings.environment === 'production' ? 'Produção' : 'Sandbox'}
                 </Button>
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