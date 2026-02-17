

# Plano: Criar Edge Function proxy para o webhook N8N

## Problema

O N8N nao responde corretamente a requisicoes OPTIONS (preflight CORS), mesmo com os headers configurados. Isso e uma limitacao comum do N8N -- ele so responde a requisicoes POST no webhook, mas o navegador envia um OPTIONS antes.

## Solucao

Criar uma Edge Function no Supabase que atua como proxy: o frontend chama a Edge Function (que ja tem CORS configurado), e ela repassa a requisicao para o webhook N8N no servidor (onde nao existe CORS).

```text
Frontend  -->  Edge Function (proxy)  -->  N8N Webhook
              (trata CORS)                (sem CORS)
```

## Alteracoes

### 1. Criar Edge Function `n8n-image-proxy`

**Arquivo:** `supabase/functions/n8n-image-proxy/index.ts`

- Recebe a requisicao do frontend com `courseName`, `areaName`, `description`
- Trata o preflight OPTIONS com headers CORS corretos
- Repassa o body para `https://automacao-n8n.w3lidv.easypanel.host/webhook/servidores_imagem`
- Retorna a resposta do N8N para o frontend com headers CORS

### 2. Registrar no `supabase/config.toml`

Adicionar a configuracao da nova funcao:

```
[functions.n8n-image-proxy]
verify_jwt = false
```

### 3. Atualizar `CourseImageGenerator.tsx`

**Arquivo:** `src/components/admin/CourseImageGenerator.tsx`

- Substituir o `fetch` direto ao N8N por `supabase.functions.invoke('n8n-image-proxy', { body: ... })`
- Manter o tratamento de resposta igual (espera `imageUrl` no retorno)

## Apos implementacao

1. **Deploy da Edge Function** via CLI:
   ```
   supabase functions deploy n8n-image-proxy --no-verify-jwt
   ```
2. **Publicar o frontend** no Lovable

## Secao tecnica

A Edge Function roda no servidor Supabase, entao a chamada ao N8N e feita server-to-server, sem restricoes CORS. O frontend so conversa com a Edge Function, que ja tem CORS tratado nativamente. A URL do webhook N8N fica hardcoded na Edge Function (nao exposta ao frontend). O `verify_jwt` sera desabilitado para simplificar, ja que a funcao so repassa dados para o N8N.

