# Implementação do Sistema de Instituições

## ⚠️ IMPORTANTE: Execute as Migrations PRIMEIRO

Antes de usar o sistema, você DEVE executar estas 3 migrations SQL no Supabase:

### 1️⃣ Criar tabela de instituições
```sql
-- Arquivo: supabase/sql/2025-01-20_create_institutions_table.sql
-- Execute este SQL completo no SQL Editor do Supabase
```

### 2️⃣ Adicionar institution_id aos cursos
```sql
-- Arquivo: supabase/sql/2025-01-20_add_institution_to_courses.sql
-- Execute este SQL completo no SQL Editor do Supabase
```

### 3️⃣ Popular instituições federais (273 instituições)
```sql
-- Arquivo: supabase/sql/2025-01-20_populate_institutions.sql
-- Execute este SQL completo no SQL Editor do Supabase
```

## 📋 Como Executar as Migrations

1. Acesse seu projeto no Supabase Dashboard
2. Vá em **SQL Editor** no menu lateral
3. Clique em **New Query**
4. Copie e cole o conteúdo de cada arquivo SQL (na ordem acima)
5. Clique em **Run** para executar
6. Aguarde confirmação de sucesso
7. Repita para os 3 arquivos

## ✅ Após Executar as Migrations

Confirme aqui no chat que executou as migrations para que eu possa:
- Atualizar os tipos TypeScript do Supabase
- Modificar a página de cursos para usar instituições
- Adicionar a rota da nova página de gestão de instituições
- Atualizar o menu administrativo

## 🎯 Recursos Implementados

- ✅ 3 migrations SQL criadas
- ✅ Componente InstitutionSelect (autocomplete)
- ✅ Componente QuickInstitutionCreate (modal rápido)
- ✅ Página InstitutionsPage (gestão completa)
- ⏳ Aguardando migrations para continuar...
