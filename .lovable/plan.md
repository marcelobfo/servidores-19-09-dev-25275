# Plano de Melhorias: Tabela de Cronograma e Carga Horária Semanal

## ✅ Status: IMPLEMENTADO

Este plano foi completamente implementado com as seguintes alterações:

---

## 1. ✅ Alteração no Banco de Dados

Arquivo criado: `supabase/sql/add_weekly_hours_to_organ_types.sql`

- Coluna `weekly_hours INTEGER DEFAULT 30` adicionada à tabela `organ_types`
- Valores: 20h para órgãos federais, 30h para outros

---

## 2. ✅ Interface de Gerenciamento de Tipos de Órgãos

Arquivo atualizado: `src/pages/admin/OrganTypesPage.tsx`

- Campo `weekly_hours` no formulário de criação/edição
- Toggle de "É órgão federal" auto-ajusta para 20h ou 30h
- Coluna "CH Semanal" na tabela de listagem

---

## 3. ✅ Reformatação da Tabela de Cronograma

Arquivo atualizado: `src/lib/dynamicPdfGenerator.ts`

Nova estrutura multiline da tabela com 5 colunas:
- **Data**: Período dinâmico (start_date a end_date)
- **Horário**: 8:00 às 12:00 / 14:00 às 16:00
- **CH Semanal**: Dinâmico do organ_type (20h ou 30h)
- **Atividade**: Assistir vídeos, Fóruns, Avaliação
- **Local**: Plataforma + nome da instituição

---

## 4. ✅ Propagação do `weekly_hours`

Arquivos atualizados:
- `src/lib/dynamicPdfGenerator.ts` - Interface PreviewData com weekly_hours
- `src/lib/pdfGenerator.ts` - Interface Course e preparePreviewData
- `src/pages/student/DocumentsPage.tsx` - Busca weekly_hours do organ_type

---

## Próximo passo

Execute a migration SQL no Supabase para adicionar a coluna:

```sql
-- supabase/sql/add_weekly_hours_to_organ_types.sql
ALTER TABLE organ_types 
ADD COLUMN IF NOT EXISTS weekly_hours INTEGER DEFAULT 30 NOT NULL;

UPDATE organ_types SET weekly_hours = 20 WHERE is_federal = true;
UPDATE organ_types SET weekly_hours = 30 WHERE is_federal = false;
```
