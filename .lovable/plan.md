

# Plano: Sistema Completo de Gerenciamento de Usuarios pelo Admin

## Problemas Identificados

1. **Botao "Convidar Usuario" nao faz nada** -- e apenas visual, sem logica
2. **Nao existe funcionalidade de excluir usuario**
3. **Nao existe funcionalidade de editar perfil pelo admin**
4. **Convite de usuario requer uma Edge Function** -- o Supabase Auth nao permite criar usuarios pelo client-side com `supabase.auth.admin`; isso so funciona com a `service_role_key` no servidor

## Solucao

### 1. Edge Function: `admin-invite-user`

Criar uma nova Edge Function que usa a `service_role_key` para:
- **Convidar usuario por email** (cria conta + envia email de convite)
- **Excluir usuario** (remove de `auth.users`, cascata para `profiles` e `user_roles`)

A funcao valida que o chamador e admin antes de executar qualquer acao.

Acoes suportadas:
- `invite` -- recebe email, nome, e role opcional; cria o usuario via `supabase.auth.admin.createUser` com `email_confirm: false` (envia convite)
- `delete` -- recebe userId; remove via `supabase.auth.admin.deleteUser`

### 2. Hook `useUserManagement.tsx` -- Novos Hooks

Adicionar:
- `useInviteUser` -- chama a edge function com acao `invite`
- `useDeleteUser` -- chama a edge function com acao `delete`
- `useUpdateUserProfile` -- atualiza nome, email e whatsapp na tabela `profiles` diretamente (admin ja tem permissao via RLS)

### 3. Modal de Convite de Usuario

Criar componente `InviteUserDialog` com formulario:
- Email (obrigatorio)
- Nome completo (obrigatorio)
- Role inicial (admin ou aluno, padrao: aluno)

Acionado pelo botao "Convidar Usuario" ja existente na pagina.

### 4. Atualizar `UserActionsDropdown`

Adicionar novas opcoes ao menu de acoes:
- **Editar Perfil** -- abre dialog para editar nome/email
- **Excluir Usuario** -- com confirmacao, chama edge function

### 5. Atualizar `UsersManagementPage`

- Conectar o botao "Convidar Usuario" ao novo dialog
- Passar callbacks necessarios aos componentes filhos

---

## Detalhes Tecnicos

### Edge Function `admin-invite-user`

```text
POST /admin-invite-user
Headers: Authorization: Bearer <user_token>
Body: { action: "invite" | "delete", email?, fullName?, role?, userId? }
```

Fluxo:
1. Extrai token JWT do header
2. Verifica se o usuario e admin via `has_role`
3. Executa acao com `supabase.auth.admin.*` usando `service_role_key`
4. Para `invite`: cria usuario + insere na `user_roles` se role = admin
5. Para `delete`: impede auto-exclusao, remove usuario

### Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/admin-invite-user/index.ts` | Edge function para invite/delete |
| `src/components/admin/InviteUserDialog.tsx` | Modal de convite |
| `src/components/admin/EditUserDialog.tsx` | Modal de edicao de perfil |

### Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useUserManagement.tsx` | Adicionar `useInviteUser`, `useDeleteUser`, `useUpdateUserProfile` |
| `src/components/admin/UserActionsDropdown.tsx` | Adicionar opcoes "Editar" e "Excluir" |
| `src/pages/admin/UsersManagementPage.tsx` | Conectar botao "Convidar" ao dialog |

### Seguranca

- A edge function valida o papel de admin no servidor usando `has_role` antes de qualquer operacao
- Nenhuma credencial administrativa e exposta ao client
- Auto-exclusao e bloqueada
- Auto-remocao de admin e bloqueada (ja implementado no dropdown)

