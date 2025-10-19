# Configuração do Sistema de Pagamentos

Este documento detalha os requisitos e configurações necessárias para o funcionamento correto do sistema de pagamentos via PIX usando a integração com Asaas.

## 📋 Requisitos Obrigatórios

### 1. Configurar Payment Settings (Administrador)

**Caminho:** `/admin/payment-settings`

O administrador DEVE configurar:

- ✅ **Ambiente**: Escolher entre `sandbox` (testes) ou `production` (produção)
- ✅ **Chave API Sandbox**: API key fornecida pelo Asaas para ambiente de testes
- ✅ **Chave API Produção**: API key fornecida pelo Asaas para ambiente de produção
- ✅ **Descrição de Pagamento**: Texto que aparecerá na cobrança PIX
- ✅ **Habilitar Sistema**: Toggle para ativar/desativar o sistema de pagamentos

**⚠️ IMPORTANTE**: Sem estas configurações, nenhum pagamento poderá ser processado.

### 2. Dados Obrigatórios do Aluno

Para que o pagamento seja gerado com sucesso, o aluno DEVE ter preenchido:

- ✅ **Nome completo**: Nome e sobrenome
- ✅ **Email**: Email válido
- ✅ **CPF**: Exatamente 11 dígitos (apenas números)
- ✅ **Telefone ou WhatsApp**: Número de contato com DDD
- ✅ **Endereço Completo**: 
  - CEP
  - Logradouro
  - Número
  - Bairro
  - Cidade
  - Estado
  - Complemento (opcional)

**⚠️ IMPORTANTE**: CPF e telefone são especialmente críticos. A API do Asaas rejeita pagamentos sem estes dados.

### 3. Configurar Taxa no Curso (Administrador)

**Caminho:** `/admin/courses`

Cada curso deve ter configurado:

- ✅ **Taxa de Pré-matrícula** (`pre_enrollment_fee`): Valor em R$ para pré-matrícula
- ✅ **Taxa de Matrícula** (`enrollment_fee`): Valor em R$ para matrícula definitiva

**Valor Mínimo**: R$ 5,00 (limitação da API do Asaas)

## 🔍 Troubleshooting

### Erro: "Edge Function returned a non-2xx status code"

Este é um erro genérico que indica falha no servidor. As causas mais comuns são:

#### Causa 1: Payment Settings não configuradas

**Sintomas:**
- Erro 500 ao gerar pagamento
- Log: "payment_settings não configurado"

**Solução:**
1. Acessar `/admin/payment-settings`
2. Preencher API key do Asaas
3. Habilitar o sistema
4. Salvar as configurações

#### Causa 2: Dados obrigatórios faltando (CPF ou Telefone)

**Sintomas:**
- Erro 500 ao gerar pagamento
- Log menciona "CPF" ou "telefone" ou "obrigatório"

**Solução:**
1. Verificar se o aluno preencheu TODOS os campos do formulário
2. CPF deve ter exatamente 11 dígitos
3. Telefone/WhatsApp deve estar no formato correto
4. Aluno deve refazer a pré-matrícula com dados completos

#### Causa 3: API Key do Asaas inválida

**Sintomas:**
- Erro 500 ao gerar pagamento
- Log: "Unauthorized" ou "Invalid API key"

**Solução:**
1. Verificar se a API key está correta no Asaas
2. Verificar se o ambiente (sandbox/production) está correto
3. Atualizar a API key em `/admin/payment-settings`

#### Causa 4: Taxa do curso não configurada

**Sintomas:**
- Modal de pagamento não abre
- Não aparece botão "Pagar Taxa"

**Solução:**
1. Acessar `/admin/courses`
2. Editar o curso
3. Definir `pre_enrollment_fee` ou `enrollment_fee`
4. Valor mínimo: R$ 5,00

### Erro: "Dados de pagamento inválidos"

**Causa**: Validação pré-chamada falhou

**Solução:**
- Verificar se o ID da pré-matrícula existe
- Verificar se o valor é maior que R$ 0,00
- Recarregar a página e tentar novamente

### QR Code não aparece / "QR Code não foi gerado"

**Causa**: Resposta da API não contém QR code ou payload

**Possíveis razões:**
1. Problema temporário na API do Asaas
2. Dados do cliente inválidos
3. Valor abaixo do mínimo (R$ 5,00)

**Solução:**
1. Clicar em "Gerar Novo QR Code" (botão de retry)
2. Verificar logs do console do navegador
3. Verificar dados obrigatórios
4. Aguardar alguns minutos e tentar novamente

## 🔄 Fluxo de Pagamento

### Pré-matrícula

1. **Aluno** preenche formulário de pré-matrícula com todos os dados obrigatórios
2. **Sistema** cria registro de pré-matrícula com status `pending`
3. **Aluno** clica em "Pagar Taxa"
4. **Sistema** chama edge function `create-payment`
5. **Edge Function** valida dados e cria cobrança no Asaas
6. **Modal** exibe QR Code PIX e payload
7. **Aluno** paga via PIX
8. **Webhook** do Asaas notifica o sistema
9. **Sistema** atualiza status para `payment_confirmed`

### Matrícula

1. **Administrador** aprova pré-matrícula
2. **Sistema** cria matrícula com status `pending`
3. **Aluno** acessa "Minhas Matrículas"
4. **Aluno** clica em "Pagar Taxa de Matrícula"
5. Restante do fluxo é idêntico ao da pré-matrícula

## 🛠️ Para Desenvolvedores

### Edge Functions Envolvidas

- `create-payment`: Gera cobrança PIX no Asaas
- `webhook-asaas`: Recebe notificações de pagamento

### Tabelas do Banco

- `payment_settings`: Configurações do sistema de pagamento
- `payments`: Registro de pagamentos
- `pre_enrollments`: Pré-matrículas
- `enrollments`: Matrículas

### Logs Importantes

Sempre verificar logs do console:
```javascript
console.log('Creating payment with:', { ... })
console.log('Payment response:', { data, error })
console.error('Full error object:', JSON.stringify(error, null, 2))
```

### Políticas RLS

- Admins podem ver todos os pagamentos
- Usuários podem ver apenas seus próprios pagamentos
- `is_admin()` function é usada para verificar privilégios

## 📞 Suporte

Se os erros persistirem após seguir este guia:

1. Verificar logs do console do navegador (F12)
2. Verificar logs das Edge Functions no Supabase
3. Verificar status da API do Asaas
4. Contatar suporte técnico com:
   - Prints do console
   - ID da pré-matrícula/matrícula
   - Hora exata do erro
