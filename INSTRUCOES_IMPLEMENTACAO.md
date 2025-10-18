# Instruções para Implementação do Módulo de Instituições

## 📋 Passo a Passo

### 1️⃣ Executar Migrations SQL no Supabase (FAZER PRIMEIRO)

Acesse o Supabase Dashboard > SQL Editor e execute as migrations **na ordem abaixo**:

#### Migration 1: Criar tabela de instituições
**Arquivo:** `supabase/sql/2025-01-20_create_institutions_table.sql`

Esta migration cria:
- Tabela `institutions` com campos: id, name, type, workload_rules, is_active
- Índices para otimizar buscas
- Policies RLS usando a função `has_role()` (evita recursão)
- Trigger para atualizar `updated_at`

✅ **Execute este arquivo primeiro**

---

#### Migration 2: Adicionar campo institution_id em courses
**Arquivo:** `supabase/sql/2025-01-20_add_institution_to_courses.sql`

Esta migration:
- Adiciona coluna `institution_id` na tabela `courses`
- Cria foreign key para `institutions`
- Atualiza constraint de `duration_days` para incluir 75 dias
- Adiciona índice para melhor performance

✅ **Execute este arquivo em segundo lugar**

---

#### Migration 3: Popular instituições federais
**Arquivo:** `supabase/sql/2025-01-20_populate_institutions.sql`

Esta migration insere:
- 1 instituição padrão "Regras Padrão (Infomar)"
- 273 instituições federais (universidades, IFs, órgãos)
- Instituições judiciais com regras específicas (TRTs, STJ, TSE, Câmara)
- Atualiza cursos existentes para usar a instituição padrão

✅ **Execute este arquivo por último**

---

### 2️⃣ Verificar se as migrations funcionaram

No SQL Editor, execute:

```sql
-- Verificar se a tabela foi criada
SELECT COUNT(*) FROM public.institutions;
-- Deve retornar 274 (273 federais + 1 padrão)

-- Verificar se o campo foi adicionado
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'courses' AND column_name = 'institution_id';

-- Verificar policies
SELECT policyname FROM pg_policies WHERE tablename = 'institutions';
```

---

### 3️⃣ Após executar as migrations

Volte ao chat e confirme que executou as 3 migrations. O sistema TypeScript será atualizado automaticamente e você terá:

✅ Dropdown de instituições no cadastro de cursos
✅ Cálculo automático de carga horária baseado na instituição
✅ Página de gestão de instituições no admin
✅ Cadastro rápido de novas instituições
✅ Opção de 75 dias nos cursos

---

## ⚠️ Troubleshooting

### Erro: "function has_role does not exist"
A função `has_role()` deve ter sido criada anteriormente no sistema. Verifique se existe:

```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'has_role' AND routine_schema = 'public';
```

Se não existir, execute primeiro:

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### Erro: "type app_role does not exist"
Verifique se o enum existe:

```sql
SELECT typname FROM pg_type WHERE typname = 'app_role';
```

Se não existir, crie:

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'student', 'instructor');
```

---

## 📌 Próximos Passos (após migrations)

1. ✅ Tipos TypeScript serão atualizados automaticamente
2. ✅ Componentes React já estão criados
3. ✅ Sistema de cálculo automático será integrado
4. ✅ Navegação admin será atualizada

**Aguardo sua confirmação de que executou as 3 migrations para continuar!**
