
# Plano de Melhorias: Scroll, Webhook e Confirmação de Pagamento

## Resumo das Melhorias Solicitadas

1. **Scroll para o topo ao clicar em "Inscrever-se"** - Quando o usuário clica no botão de inscrição, a página de pré-matrícula deve abrir já rolada para o topo do formulário.

2. **Enviar dados do aluno no webhook junto com o status de pagamento** - O webhook do Asaas deve incluir informações completas do estudante matriculado.

3. **Melhorar a experiência de confirmação de pagamento** - Adicionar indicadores visuais claros de carregamento, confirmação e redirecionamento automático.

---

## 1. Scroll para o Topo da Página de Inscrição

### Problema Atual
Quando o usuário clica em "Inscrever-se" ou "Fazer Pré-Matrícula", ele é redirecionado para a página de pré-matrícula, mas a página pode abrir em uma posição aleatória, especialmente se o usuário estava rolando antes.

### Solução
Adicionar `window.scrollTo(0, 0)` no carregamento inicial da página `PreEnrollmentPage.tsx`.

### Arquivos a Modificar
- `src/pages/PreEnrollmentPage.tsx`

### Alterações
```typescript
// Adicionar useEffect no início do componente
useEffect(() => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}, []);
```

---

## 2. Enviar Dados do Aluno no Webhook

### Problema Atual
O webhook `webhook-asaas` atualmente envia apenas dados básicos de pagamento e status. Os dados completos do estudante (telefone, CPF, endereço, organização, dados do curso) não são incluídos.

### Solução
Expandir o payload do N8N webhook para incluir informações completas do estudante, curso e matrícula.

### Arquivos a Modificar
- `supabase/functions/webhook-asaas/index.ts`

### Dados Adicionais a Incluir no Payload

```text
+----------------------------------+
|        PAYLOAD EXPANDIDO         |
+----------------------------------+
| event: "payment_confirmed"       |
| timestamp: ISO date              |
+----------------------------------+
| enrollment:                      |
|   - id                           |
|   - student_name                 |
|   - student_email                |
|   - student_phone                |
|   - student_whatsapp             |
|   - student_cpf          [NOVO]  |
|   - student_birth_date   [NOVO]  |
|   - organization         [NOVO]  |
|   - address              [NOVO]  |
|   - city                 [NOVO]  |
|   - state                [NOVO]  |
|   - postal_code          [NOVO]  |
|   - course_id            [NOVO]  |
|   - course_name                  |
|   - course_hours         [NOVO]  |
|   - license_start_date   [NOVO]  |
|   - license_end_date     [NOVO]  |
|   - status                       |
|   - created_at                   |
|   - updated_at                   |
+----------------------------------+
| payment:                         |
|   - id                           |
|   - asaas_payment_id             |
|   - amount                       |
|   - billing_type         [NOVO]  |
|   - status                       |
|   - paid_at                      |
+----------------------------------+
```

### Alterações no webhook-asaas
Expandir a função `triggerN8NWebhook` para buscar e incluir:
- Dados completos do estudante (CPF, telefone, endereço)
- Dados completos do curso (ID, carga horária)
- Datas da licença
- Tipo de cobrança do pagamento

---

## 3. Melhorar Experiência de Confirmação de Pagamento

### Problema Atual
- O usuário não tem feedback visual claro quando o pagamento está sendo processado
- A transição entre "aguardando" e "confirmado" não é óbvia
- O redirecionamento acontece, mas sem aviso prévio adequado

### Solução
Criar um fluxo visual de três estados:

```text
Estado 1: AGUARDANDO PAGAMENTO
+----------------------------------+
|  [QR Code PIX / Código]          |
|  "Aguardando confirmação..."     |
|  [Indicador de verificação]      |
+----------------------------------+

Estado 2: PAGAMENTO CONFIRMADO
+----------------------------------+
|  [Ícone de Sucesso Animado]      |
|  "Pagamento Confirmado!"         |
|  "Redirecionando em 3s..."       |
|  [Barra de progresso]            |
|  [Botão: Ir para Matrículas]     |
+----------------------------------+

Estado 3: REDIRECIONAMENTO
+----------------------------------+
|  [Spinner]                       |
|  "Carregando suas matrículas..." |
+----------------------------------+
```

### Arquivos a Modificar
- `src/components/payment/PaymentModal.tsx`

### Novos Estados e Componentes

1. **Novo estado `paymentConfirmed`**: Boolean para controlar a transição visual
2. **Countdown visual**: Timer de 3 segundos antes do redirecionamento
3. **Animação de sucesso**: Ícone verde com animação de check
4. **Botão manual**: "Ir para Minhas Matrículas" como fallback
5. **Tela de carregamento pós-confirmação**: Spinner com mensagem durante redirecionamento

### Fluxo Atualizado

```text
POLLING/REALTIME detecta status = 'received' ou 'confirmed'
                    |
                    v
    +-----------------------------+
    | paymentConfirmed = true     |
    | Mostrar tela de sucesso     |
    | Iniciar countdown de 3s     |
    +-----------------------------+
                    |
                    v (após 3s OU clique no botão)
    +-----------------------------+
    | Mostrar "Carregando..."     |
    | navigate("/student/...")    |
    +-----------------------------+
```

---

## Detalhes Técnicos

### PaymentModal.tsx - Novos Estados
```typescript
const [paymentConfirmed, setPaymentConfirmed] = useState(false);
const [redirectCountdown, setRedirectCountdown] = useState(3);
const [isRedirecting, setIsRedirecting] = useState(false);
```

### Lógica de Confirmação Melhorada
```typescript
// Quando pagamento é confirmado
if (newStatus === "confirmed" || newStatus === "received") {
  setPaymentConfirmed(true);
  // Countdown de 3 segundos
  let count = 3;
  const countdownInterval = setInterval(() => {
    count--;
    setRedirectCountdown(count);
    if (count <= 0) {
      clearInterval(countdownInterval);
      handleRedirect();
    }
  }, 1000);
}
```

### UI de Confirmação
- Ícone `CheckCircle` com animação de scale/pulse
- Texto "Pagamento Confirmado!" em verde
- Countdown: "Redirecionando em {n} segundos..."
- Botão: "Ir para Minhas Matrículas agora"

---

## Ordem de Implementação

1. **PreEnrollmentPage.tsx** - Scroll to top (mudança simples)
2. **PaymentModal.tsx** - Estados visuais de confirmação (mudança de UI)
3. **webhook-asaas/index.ts** - Dados expandidos do estudante (mudança de backend)

---

## Ações Necessárias Após Implementação

Após as alterações, será necessário fazer deploy da Edge Function atualizada:

```bash
supabase link --project-ref lavqzqqfsdtduwphzehr
supabase functions deploy webhook-asaas --no-verify-jwt
```

