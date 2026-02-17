

# Plano: Migrar geracao de imagem para webhook N8N

## Resumo

Substituir toda a logica de chamada ao Gemini por uma chamada direta ao webhook N8N. O frontend vai chamar o webhook diretamente (sem passar pela Edge Function), enviando titulo e descricao do curso. O N8N processa, gera a imagem e retorna na resposta.

## Alteracoes

### 1. Simplificar `CourseImageGenerator.tsx`

**Arquivo:** `src/components/admin/CourseImageGenerator.tsx`

- Remover a chamada `supabase.functions.invoke('generate-course-image-v2')`
- Substituir por um `fetch` direto ao webhook:
  ```
  POST https://automacao-n8n.w3lidv.easypanel.host/webhook/servidores_imagem
  Body: { courseName, description, areaName }
  ```
- O N8N deve retornar a imagem (como URL ou base64). O componente vai tratar ambos os formatos:
  - Se retornar uma URL publica: usar diretamente
  - Se retornar base64: montar o data URI como ja faz hoje
- Remover tratamento de erros especificos do Gemini (429, 402)

### 2. Nenhuma alteracao na Edge Function

A Edge Function `generate-course-image-v2` pode ser mantida como fallback, mas nao sera mais chamada. A chamada sera feita diretamente do frontend para o webhook.

### 3. Formato esperado do webhook N8N

O frontend vai enviar:
```json
{
  "courseName": "Nome do Curso",
  "areaName": "Area",
  "description": "Descricao do curso"
}
```

E espera receber do N8N:
```json
{
  "imageUrl": "data:image/png;base64,..." 
}
```
Ou:
```json
{
  "imageUrl": "https://url-publica-da-imagem.png"
}
```

## Secao tecnica

A chamada direta do frontend para o webhook N8N elimina a necessidade da Edge Function como intermediario, simplificando o fluxo e eliminando os problemas de CORS com o Supabase. O webhook N8N precisa retornar os headers CORS adequados (`Access-Control-Allow-Origin: *`) ou, como alternativa, o N8N geralmente ja trata isso automaticamente em webhooks de resposta.

O componente `handleUseImage` continua funcionando igual -- ele converte base64 para blob e faz upload ao Supabase Storage. Se o N8N retornar uma URL publica em vez de base64, o fluxo sera adaptado para baixar a imagem e fazer o upload, ou usar a URL diretamente.

