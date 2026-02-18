

## Corrigir salvamento de imagem gerada pelo N8N

### Problema
O nó "Respond to Webhook" no N8N usa a expressao `{{ $json.imageBase64 }}`, mas o nó Gemini retorna a imagem como **dados binarios** (visivel na aba "Binario" do screenshot). Como `$json.imageBase64` nao existe, o valor enviado e algo como `data:image/png;base64,undefined` ou `data:image/png;base64,[object Object]`, que nao e base64 valido. O `atob()` no frontend falha ao tentar decodificar isso.

### Solucao (2 partes)

#### Parte 1 - Corrigir expressao no N8N (acao do usuario)
No no "Respond to Webhook", trocar a expressao do corpo de resposta de:
```
{
  "imageUrl": "data:image/png;base64,{{ $json.imageBase64 }}"
}
```
Para:
```
{
  "imageUrl": "data:image/png;base64,{{ $binary.data.base64 }}"
}
```
`$binary.data.base64` e a expressao correta para acessar dados binarios no N8N.

**IMPORTANTE**: Se a imagem for grande (>1MB como mostrado no screenshot), o JSON de resposta ficara enorme. Uma alternativa mais eficiente e adicionar um no "Convert to File" -> upload para storage e retornar so a URL. Mas para funcionar rapido, a expressao acima resolve.

#### Parte 2 - Tornar o frontend mais resiliente (alteracao de codigo)
Atualizar o `handleUseImage` no `CourseImageGenerator.tsx` para lidar com todos os cenarios possiveis:

1. Se `generatedImage` comeca com `data:image` e contem base64 valido -> decodificar normalmente
2. Se `generatedImage` comeca com `data:image` mas o base64 e invalido -> extrair URL embutida ou logar erro claro
3. Se `generatedImage` e uma URL publica (`https://...`) -> fazer fetch direto
4. Adicionar log do valor recebido para facilitar debug futuro

**Arquivo**: `src/components/admin/CourseImageGenerator.tsx`

Alteracoes na funcao `handleUseImage`:
- Adicionar `console.log` do valor de `generatedImage` no inicio para debug
- Verificar se o conteudo apos `data:...;base64,` parece ser base64 valido (regex check) antes de chamar `atob`
- Se nao for base64 valido, verificar se contem uma URL e fazer fetch dela
- Se nada funcionar, mostrar mensagem de erro clara indicando formato invalido

Tambem atualizar a Edge Function `n8n-image-proxy/index.ts` para:
- Detectar se a resposta do N8N e binaria (content-type image/*) em vez de JSON
- Se for binaria, converter para base64 no servidor e retornar como `{ imageUrl: "data:image/...;base64,..." }`
- Se for JSON, repassar normalmente como ja faz

### Detalhes tecnicos

**Edge Function** (`supabase/functions/n8n-image-proxy/index.ts`):
- Apos receber a resposta do N8N, verificar o `Content-Type` do header
- Se for `image/*`, ler como `arrayBuffer`, converter para base64 usando `btoa`, e retornar JSON com data URI
- Se for `application/json`, manter o comportamento atual

**Frontend** (`src/components/admin/CourseImageGenerator.tsx`):
- Adicionar validacao de base64 com regex `/^[A-Za-z0-9+/=]+$/` antes de chamar `atob`
- Fallback robusto: se validacao falhar, tentar extrair URL com regex `https?://...`
- Log detalhado do formato recebido para facilitar debug

### Resultado esperado
A imagem sera salva com sucesso independente do formato que o N8N retornar (base64 valido, URL publica, ou binario direto).

