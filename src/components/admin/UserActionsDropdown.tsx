import { useState } from "react";
import { MoreHorizontal, Shield, ShieldOff, KeyRound, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGrantAdminRole, useRevokeAdminRole, useResetUserPassword, useDeleteUser } from "@/hooks/useUserManagement";
import { useAuth } from "@/hooks/useAuth";
import { EditUserDialog } from "./EditUserDialog";

interface UserActionsDropdownProps {
  userId: string;
  userEmail: string;
  userName: string | null;
  isAdmin: boolean;
}

export function UserActionsDropdown({ userId, userEmail, userName, isAdmin }: UserActionsDropdownProps) {
  const { user } = useAuth();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "grant" | "revoke" | "reset" | "delete" | null;
  }>({ open: false, type: null });
  const [editOpen, setEditOpen] = useState(false);

  const grantAdmin = useGrantAdminRole();
  const revokeAdmin = useRevokeAdminRole();
  const resetPassword = useResetUserPassword();
  const deleteUser = useDeleteUser();

  const isCurrentUser = user?.id === userId;

  const handleConfirm = () => {
    if (confirmDialog.type === "grant") {
      grantAdmin.mutate(userId);
    } else if (confirmDialog.type === "revoke") {
      revokeAdmin.mutate(userId);
    } else if (confirmDialog.type === "reset") {
      resetPassword.mutate(userEmail);
    } else if (confirmDialog.type === "delete") {
      deleteUser.mutate(userId);
    }
    setConfirmDialog({ open: false, type: null });
  };

  const getDialogContent = () => {
    switch (confirmDialog.type) {
      case "grant":
        return {
          title: "Conceder permissão de administrador",
          description: `Tem certeza que deseja tornar ${userEmail} um administrador?`,
        };
      case "revoke":
        return {
          title: "Remover permissão de administrador",
          description: `Tem certeza que deseja remover as permissões de administrador de ${userEmail}?`,
        };
      case "reset":
        return {
          title: "Resetar senha do usuário",
          description: `Um email será enviado para ${userEmail} com instruções para redefinir a senha.`,
        };
      case "delete":
        return {
          title: "Excluir usuário",
          description: `Tem certeza que deseja excluir ${userEmail}? Esta ação não pode ser desfeita.`,
        };
      default:
        return { title: "", description: "" };
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Abrir menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
            <Pencil className="mr-2 h-4 w-4" />
            Editar Perfil
          </DropdownMenuItem>

          {!isAdmin && (
            <DropdownMenuItem
              onClick={() => setConfirmDialog({ open: true, type: "grant" })}
              className="cursor-pointer"
            >
              <Shield className="mr-2 h-4 w-4" />
              Tornar Admin
            </DropdownMenuItem>
          )}

          {isAdmin && !isCurrentUser && (
            <DropdownMenuItem
              onClick={() => setConfirmDialog({ open: true, type: "revoke" })}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <ShieldOff className="mr-2 h-4 w-4" />
              Remover Admin
            </DropdownMenuItem>
          )}

          {isAdmin && isCurrentUser && (
            <DropdownMenuItem disabled className="opacity-50">
              <ShieldOff className="mr-2 h-4 w-4" />
              Remover Admin (você)
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setConfirmDialog({ open: true, type: "reset" })}
            className="cursor-pointer"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Resetar Senha
          </DropdownMenuItem>

          {!isCurrentUser && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmDialog({ open: true, type: "delete" })}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir Usuário
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ open, type: open ? confirmDialog.type : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getDialogContent().title}</AlertDialogTitle>
            <AlertDialogDescription>{getDialogContent().description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditUserDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        user={userId ? { id: userId, email: userEmail, full_name: userName } : null}
      />
    </>
  );
}
