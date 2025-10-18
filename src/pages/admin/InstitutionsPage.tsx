import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Institution, InstitutionInsert, InstitutionUpdate } from "@/types/institutions";

export default function InstitutionsPage() {
  const { toast } = useToast();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "federal",
    workload_rules: { "15": 65, "30": 130, "45": 195, "60": 260, "75": 295, "90": 390 },
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const fetchInstitutions = async () => {
    try {
      const { data, error } = await supabase
        .from("institutions" as any)
        .select("*")
        .order("name");

      if (error) throw error;
      setInstitutions((data as unknown as Institution[]) || []);
    } catch (error) {
      console.error("Error fetching institutions:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as instituições",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredInstitutions = institutions.filter((inst) => {
    const matchesSearch = inst.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || inst.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleEdit = (institution: Institution) => {
    setEditingInstitution(institution);
    setFormData({
      name: institution.name,
      type: institution.type,
      workload_rules: institution.workload_rules,
    });
    setShowCreateDialog(true);
  };

  const handleToggleActive = async (institution: Institution) => {
    try {
      const updateData: InstitutionUpdate = { is_active: !institution.is_active };
      
      const { error } = await supabase
        .from("institutions" as any)
        .update(updateData)
        .eq("id", institution.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Instituição ${institution.is_active ? "desativada" : "ativada"} com sucesso`,
      });

      fetchInstitutions();
    } catch (error) {
      console.error("Error toggling institution:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status da instituição",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingInstitution) {
        const updateData: InstitutionUpdate = {
          name: formData.name,
          type: formData.type,
          workload_rules: formData.workload_rules,
        };

        const { error } = await supabase
          .from("institutions" as any)
          .update(updateData)
          .eq("id", editingInstitution.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Instituição atualizada com sucesso" });
      } else {
        const insertData: InstitutionInsert = {
          name: formData.name,
          type: formData.type,
          workload_rules: formData.workload_rules,
        };

        const { error } = await supabase
          .from("institutions" as any)
          .insert(insertData);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Instituição cadastrada com sucesso" });
      }

      setShowCreateDialog(false);
      setEditingInstitution(null);
      setFormData({ name: "", type: "federal", workload_rules: formData.workload_rules });
      fetchInstitutions();
    } catch (error: any) {
      console.error("Error saving institution:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar a instituição",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateWorkloadRule = (days: string, hours: number) => {
    setFormData({
      ...formData,
      workload_rules: { ...formData.workload_rules, [days]: hours },
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestão de Instituições</h1>
            <p className="text-muted-foreground">
              Gerencie instituições e suas regras de carga horária
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Instituição
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar instituições..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="federal">Federal</SelectItem>
              <SelectItem value="estadual">Estadual</SelectItem>
              <SelectItem value="municipal">Municipal</SelectItem>
              <SelectItem value="particular">Particular</SelectItem>
              <SelectItem value="padrao">Padrão (Infomar)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Carga Horária</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInstitutions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma instituição encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInstitutions.map((institution) => (
                    <TableRow key={institution.id}>
                      <TableCell className="font-medium">{institution.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {institution.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {Object.entries(institution.workload_rules)
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([days, hours]) => `${days}d=${hours}h`)
                          .join(", ")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={institution.is_active ? "default" : "secondary"}>
                          {institution.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(institution)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(institution)}
                          >
                            {institution.is_active ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setEditingInstitution(null);
            setFormData({ name: "", type: "federal", workload_rules: formData.workload_rules });
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingInstitution ? "Editar Instituição" : "Nova Instituição"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da instituição e suas regras de carga horária
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="federal">Federal</SelectItem>
                    <SelectItem value="estadual">Estadual</SelectItem>
                    <SelectItem value="municipal">Municipal</SelectItem>
                    <SelectItem value="particular">Particular</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Regras de Carga Horária</Label>
                <div className="grid grid-cols-2 gap-3">
                  {["15", "30", "45", "60", "75", "90"].map((days) => (
                    <div key={days} className="flex items-center gap-2">
                      <Label className="w-16">{days} dias:</Label>
                      <Input
                        type="number"
                        value={formData.workload_rules[days] || 0}
                        onChange={(e) => updateWorkloadRule(days, Number(e.target.value))}
                        className="flex-1"
                        min="0"
                        disabled={submitting}
                      />
                      <span className="text-sm text-muted-foreground">horas</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingInstitution ? "Salvar Alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
