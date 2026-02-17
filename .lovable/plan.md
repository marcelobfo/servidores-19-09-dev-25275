

# Correção do Proxy N8N - Status Code e Tratamento de Erros

## Problema Identificado

A Edge Function `n8n-image-proxy` **está funcionando corretamente** no Supabase. Porém, quando o N8N retorna um erro (404), o proxy repassa esse status diretamente ao navegador. Isso faz parecer que a Edge Function não existe, mas na verdade é o **N8N que não está respondendo**.

A linha responsável:
```text
status: response.status  // repassa o 404 do N8N para o navegador
```

## Causas do 404 no N8N

O endpoint `/webhook-test/` do N8N **só funciona quando o workflow está no modo "ouvindo evento de teste"**. Se o workflow não estiver aberto nesse modo, o N8N retorna 404.

**Solucao**: Usar a URL de **producao** (`/webhook/`) e ativar o workflow no N8N.

## Alteracoes no Codigo

### 1. Atualizar `supabase/functions/n8n-image-proxy/index.ts`

- Trocar a URL de `/webhook-test/` para `/webhook/` (producao)
- Adicionar tratamento de erro adequado: quando o N8N retornar erro, o proxy deve retornar status 502 (Bad Gateway) com uma mensagem clara, em vez de repassar o 404 diretamente
- Isso permite que o frontend diferencie entre "funcao nao encontrada" e "servico externo com problema"

### 2. Nenhuma alteracao no frontend

O componente `CourseImageGenerator.tsx` ja trata erros corretamente.

## Acoes Necessarias Apos a Alteracao

1. Voce precisara fazer o **redeploy** da funcao via CLI ou pelo Dashboard do Supabase
2. No N8N, **ative o workflow** (clique no toggle para deixar ativo) para que a URL `/webhook/` funcione

## Detalhes Tecnicos

A logica do proxy sera ajustada para:

```text
Se N8N retornar erro (status >= 400):
  -> Retornar status 502 com mensagem: "Erro no servico de geracao de imagem"
  -> Incluir detalhes do erro no corpo da resposta

Se N8N retornar sucesso:
  -> Retornar status 200 com os dados normalmente
```

