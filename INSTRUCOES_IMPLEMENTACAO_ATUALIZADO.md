# 🚀 Instruções ATUALIZADAS - Implementação do Módulo de Instituições

## ⚠️ ORDEM DE EXECUÇÃO É CRÍTICA

Execute os arquivos SQL **EXATAMENTE NESTA ORDEM** no Supabase Dashboard > SQL Editor:

---

## 1️⃣ PRIMEIRO: Criar Dependências
**Arquivo:** `supabase/sql/2025-01-20_00_create_dependencies.sql`

Este arquivo cria:
- Enum `app_role` (se não existir)
- Tabela `user_roles` (se não existir)
- Função `has_role()` (essencial para RLS sem recursão)

✅ **Execute este arquivo PRIMEIRO**

```sql
-- Para verificar se funcionou:
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'has_role' AND routine_schema = 'public';
-- Deve retornar 1 linha com 'has_role'
```

---

## 2️⃣ SEGUNDO: Criar Tabela de Instituições
**Arquivo:** `supabase/sql/2025-01-20_create_institutions_table.sql`

Este arquivo cria:
- Tabela `institutions` com campos necessários
- Índices para performance
- Policies RLS usando `has_role()` (já criada no passo 1)
- Trigger para `updated_at`

✅ **Execute este arquivo EM SEGUNDO LUGAR**

```sql
-- Para verificar se funcionou:
SELECT COUNT(*) FROM public.institutions;
-- Deve retornar 0 (tabela vazia por enquanto)
```

---

## 3️⃣ TERCEIRO: Adicionar institution_id em Cursos
**Arquivo:** `supabase/sql/2025-01-20_add_institution_to_courses.sql`

Este arquivo:
- Adiciona coluna `institution_id` em `courses`
- Cria foreign key para `institutions`
- Atualiza constraint de `duration_days` para incluir 75 dias
- Adiciona índice

✅ **Execute este arquivo EM TERCEIRO LUGAR**

```sql
-- Para verificar se funcionou:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'courses' AND column_name = 'institution_id';
-- Deve retornar 1 linha mostrando a coluna institution_id
```

---

## 4️⃣ QUARTO: Popular com Instituições
**Arquivo:** `supabase/sql/2025-01-20_populate_institutions.sql`

Este arquivo:
- Insere 1 instituição padrão "Regras Padrão (Infomar)"
- Insere 273 instituições federais
- Insere instituições judiciais com regras específicas
- Atualiza cursos existentes para usar a instituição padrão

✅ **Execute este arquivo POR ÚLTIMO**

```sql
-- Para verificar se funcionou:
SELECT COUNT(*) FROM public.institutions;
-- Deve retornar 274 ou mais (273 federais + 1 padrão + judiciais)

SELECT name, type FROM public.institutions LIMIT 5;
-- Deve mostrar algumas instituições
```

---

## ✅ Verificação Final Completa

Execute todos estes comandos para confirmar que tudo funcionou:

```sql
-- 1. Verificar função has_role
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'has_role';

-- 2. Verificar tabela institutions
SELECT COUNT(*) FROM public.institutions;

-- 3. Verificar coluna institution_id em courses
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'courses' AND column_name = 'institution_id';

-- 4. Verificar policies
SELECT policyname FROM pg_policies WHERE tablename = 'institutions';

-- 5. Ver exemplo de instituição
SELECT id, name, type, is_active 
FROM public.institutions 
WHERE name = 'Regras Padrão (Infomar)';
```

---

## 🎯 Após Executar TODOS os 4 Arquivos

Volte ao chat do Lovable e confirme que executou todos os 4 arquivos SQL. 

O sistema TypeScript será atualizado e você terá acesso a:
- ✅ Menu "Instituições" no painel admin
- ✅ Página de gestão de instituições
- ✅ Dropdown de instituições no cadastro de cursos
- ✅ Cálculo automático de carga horária
- ✅ Opção de 75 dias nos cursos

---

## ⚠️ Troubleshooting

### Erro: "function has_role does not exist"
**Solução:** Execute o arquivo `2025-01-20_00_create_dependencies.sql` primeiro!

### Erro: "type app_role does not exist"
**Solução:** Execute o arquivo `2025-01-20_00_create_dependencies.sql` primeiro!

### Erro: "table institutions does not exist"
**Solução:** Verifique se executou os arquivos na ordem correta:
1. `00_create_dependencies.sql`
2. `create_institutions_table.sql`
3. `add_institution_to_courses.sql`
4. `populate_institutions.sql`

### Erro: "column institution_id does not exist"
**Solução:** Execute o arquivo `add_institution_to_courses.sql`

---

## 📝 Resumo da Ordem de Execução

```
1. supabase/sql/2025-01-20_00_create_dependencies.sql
   ↓
2. supabase/sql/2025-01-20_create_institutions_table.sql
   ↓
3. supabase/sql/2025-01-20_add_institution_to_courses.sql
   ↓
4. supabase/sql/2025-01-20_populate_institutions.sql
```

**AGUARDO SUA CONFIRMAÇÃO DE QUE EXECUTOU OS 4 ARQUIVOS PARA CONTINUAR! 🚀**
