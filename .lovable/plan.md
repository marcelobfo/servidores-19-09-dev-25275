

## Plano: Corrigir Validação do Webhook Asaas

### Problema Identificado

O webhook do Asaas está retornando erro **401 Unauthorized** porque a Edge Function exige um header `asaas-access-token` que **não está sendo enviado pelo Asaas**.

O Asaas só envia esse header se você configurar um **Access Token** na tela de configuração de webhooks no painel do Asaas.

### Situação Atual

```
Asaas envia webhook → Edge Function verifica header 'asaas-access-token'
                                      ↓
                     Header não existe → Retorna 401 "Missing webhook token"
```

### Solução Proposta

Modificar a Edge Function `webhook-asaas` para tornar a validação do token **opcional mas recomendada**:

1. **Se o token estiver configurado no banco** → Exige e valida o header
2. **Se o token NÃO estiver configurado** → Aceita o webhook sem validação (com log de aviso)

Isso permite que o sistema funcione imediatamente enquanto você configura o token no painel do Asaas para segurança máxima.

---

### Modificações na Edge Function

**Arquivo:** `supabase/functions/webhook-asaas/index.ts`

#### Lógica Atual (linhas 126-148):
```typescript
// Exige token sempre
const webhookToken = req.headers.get('asaas-access-token');
if (!webhookToken) {
  return new Response(JSON.stringify({ error: 'Unauthorized: Missing webhook token' }), { status: 401 });
}
```

#### Nova Lógica:
```typescript
// Buscar configurações primeiro
const { data: settings } = await supabaseClient
  .from('payment_settings')
  .select('asaas_webhook_token')
  .maybeSingle();

const webhookToken = req.headers.get('asaas-access-token');
const storedToken = settings?.asaas_webhook_token;

// Se um token está configurado no banco, exigir validação
if (storedToken && storedToken.trim() !== '') {
  if (!webhookToken) {
    console.error('Missing Asaas webhook token - token is required because it is configured');
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Missing webhook token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  if (webhookToken !== storedToken) {
    console.error('Invalid Asaas webhook token');
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid webhook token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  console.log('✅ Webhook authenticated with token');
} else {
  // Token não configurado - aceitar webhook mas avisar
  console.warn('⚠️ SECURITY WARNING: Webhook token not configured in payment_settings. Accepting webhook without authentication.');
  console.warn('⚠️ Configure "Token do Webhook" em Configurações de Pagamento para segurança máxima.');
}
```

---

### Fluxo Após a Correção

```
┌─────────────────────────────────────────────────────────────────┐
│                    Asaas envia webhook                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │ Token configurado no banco?         │
        └─────────────────────────────────────┘
              │                      │
             SIM                    NÃO
              │                      │
              ▼                      ▼
   ┌──────────────────┐    ┌──────────────────┐
   │ Valida header    │    │ Aceita webhook   │
   │ asaas-access-token│    │ (com log aviso)  │
   └──────────────────┘    └──────────────────┘
              │                      │
              ▼                      │
   ┌──────────────────┐              │
   │ Token válido?    │              │
   └──────────────────┘              │
        │       │                    │
       SIM     NÃO                   │
        │       │                    │
        │       ▼                    │
        │   401 Unauthorized         │
        │                            │
        └────────┬───────────────────┘
                 │
                 ▼
        ┌──────────────────────────┐
        │ Processa pagamento       │
        │ Atualiza status          │
        │ Dispara N8N webhook      │
        └──────────────────────────┘
```

---

### Configuração Recomendada no Asaas (Passo Futuro)

Para segurança máxima, após a correção você pode:

1. Acessar o painel do Asaas → **Configurações → Webhooks**
2. Editar o webhook configurado
3. Adicionar um **Access Token** (qualquer string segura, ex: `meu-token-seguro-123`)
4. Copiar o mesmo token para **Configurações de Pagamento** no admin do sistema

---

### Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/webhook-asaas/index.ts` | Modificar validação de token para ser opcional |

---

### Resultado Esperado

1. **Imediato:** O webhook do Asaas será aceito e processará pagamentos normalmente
2. **Logs:** Aviso de segurança aparecerá nos logs enquanto o token não estiver configurado
3. **Futuro:** Quando você configurar o token no Asaas e no sistema, a validação será ativada automaticamente

