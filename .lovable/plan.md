

# Plano: Corrigir Datas nos Documentos + Atualizar/Regenerar + Admin Baixar Todos

## Problema
As datas nos documentos PDF estao sendo geradas com 1 dia a menos. Causa raiz: `new Date("2026-01-12")` interpreta a string como UTC, e `toLocaleDateString('pt-BR')` converte para fuso local (UTC-3), resultando no dia anterior.

## Solucao

### 1. Corrigir parsing de datas (causa raiz)

**`src/lib/pdfGenerator.ts`** -- linhas 43-51 e 145-153:
Substituir `new Date(dateStr)` por parsing manual que evita conversao UTC:
```typescript
const formatDateForPreview = (dateStr?: string): string => {
  if (!dateStr) return 'a definir';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch { return dateStr; }
};
```
Aplicar mesma logica em `formatDate` (linha 145).

**`src/pages/student/DocumentsPage.tsx`** -- linha 240-242:
Substituir `new Date(enrollment.enrollment_date)` e `toISOString().split('T')[0]`:
```typescript
const [y, m, d] = enrollment.enrollment_date.split('-').map(Number);
const endDateObj = new Date(y, m - 1, d);
endDateObj.setDate(endDateObj.getDate() + preEnrollment.courses.duration_days);
const ey = endDateObj.getFullYear();
const em = String(endDateObj.getMonth() + 1).padStart(2, '0');
const ed = String(endDateObj.getDate()).padStart(2, '0');
endDate = `${ey}-${em}-${ed}`;
```

**`src/lib/dynamicPdfGenerator.ts`** -- linha 1066:
Na funcao `addDaysToDate`, o fallback `new Date(dateStr)` tambem precisa do parsing local.

### 2. Botao "Atualizar e Regenerar" para alunos

**`src/pages/student/DocumentsPage.tsx`**:
- Adicionar funcao `handleRegenerateDocuments` que deleta documentos existentes (declarations + study_plans) e re-invoca a edge function `generate-enrollment-documents`, forcando regeneracao com dados atualizados.
- Adicionar botao "Atualizar Documentos" (icone RefreshCw) ao lado de "Gerar Documentos".

**`supabase/sql/fix_documents_rls_delete.sql`**:
- Criar politica RLS de DELETE para que usuarios autenticados possam deletar seus proprios documentos (via pre_enrollment_id -> user_id).

### 3. Admin: Baixar todos os documentos do usuario

**`src/pages/admin/EnrollmentsPage.tsx`**:
- Adicionar botao "Baixar Todos Documentos" no dialog de detalhes da pre-matricula.
- Funcao `handleDownloadAllDocuments(enrollment)` que gera sequencialmente: Declaracao + Plano de Estudos + Orcamento (se template existir), baixando cada um.
- Usar a mesma logica de `handleDownloadStudyPlan` e `handleDownloadDeclaration` ja existentes, agrupando em uma unica acao.

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/pdfGenerator.ts` | Fix `formatDateForPreview` e `formatDate` com parsing local |
| `src/lib/dynamicPdfGenerator.ts` | Fix `addDaysToDate` fallback |
| `src/pages/student/DocumentsPage.tsx` | Fix calculo endDate + botao regenerar |
| `src/pages/admin/EnrollmentsPage.tsx` | Botao "Baixar Todos Documentos" |
| `supabase/sql/fix_documents_rls_delete.sql` | RLS para DELETE em declarations e study_plans |

