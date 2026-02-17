

# Plano: Atualizar geração de imagem para Gemini 3 Pro Image Preview

## Problema identificado

O erro **404** acontece porque o site publicado ainda chama a função antiga `generate-course-image` (que não existe no Supabase). O codigo fonte ja foi corrigido para chamar `generate-course-image-v2`, mas o frontend precisa ser republicado.

Alem disso, o modelo atual (`gemini-2.0-flash-exp`) sera substituido pelo `gemini-3-pro-image-preview` conforme solicitado.

## Alteracoes

### 1. Atualizar Edge Function `generate-course-image-v2`

**Arquivo:** `supabase/functions/generate-course-image-v2/index.ts`

- Trocar o modelo de `gemini-2.0-flash-exp` para `gemini-3-pro-image-preview`
- Trocar o endpoint de `generateContent` para `generateContent` (mesmo endpoint, so muda o modelo na URL)
- Manter `responseModalities: ["TEXT", "IMAGE"]` conforme o curl fornecido
- Manter toda a logica de parsing de resposta (o formato de resposta e o mesmo)

**Mudanca principal:**
```
Antes:  models/gemini-2.0-flash-exp:generateContent
Depois: models/gemini-3-pro-image-preview:generateContent
```

### 2. Atualizar Edge Function `test-gemini-api-key`

**Arquivo:** `supabase/functions/test-gemini-api-key/index.ts`

- Atualizar o modelo de teste para `gemini-3-pro-image-preview` (atualmente usa `gemini-2.5-flash-image`)
- Garantir consistencia com o modelo usado na geracao real

## Acoes apos implementacao

1. **Publicar o frontend** no Lovable (botao "Publish") para que o site use `generate-course-image-v2`
2. **Deploy da edge function** via CLI:
   ```
   supabase functions deploy generate-course-image-v2
   supabase functions deploy test-gemini-api-key
   ```

## Secao tecnica

O modelo `gemini-3-pro-image-preview` usa o mesmo endpoint `generateContent` e retorna a imagem no mesmo formato (`inlineData` com `mimeType` e `data` base64), portanto a logica de parsing existente continua compativel. A unica mudanca e o nome do modelo na URL.
