import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Building2, Percent, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OrganType {
  id: string;
  name: string;
  hours_multiplier: number;
  is_federal: boolean;
  created_at: string;
}

const OrganTypesPage = () => {
  const { toast } = useToast();
  const [organTypes, setOrganTypes] = useState<OrganType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    hours_multiplier: "1.0",
    is_federal: false
  });

  useEffect(() => {
    fetchOrganTypes();
  }, []);

  const fetchOrganTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("organ_types" as any)
        .select("*")
        .order("is_federal", { ascending: true })
        .order("name");

      if (error) throw error;
      setOrganTypes((data as unknown as OrganType[]) || []);
    } catch (error: any) {
      console.error("Error fetching organ types:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar tipos de órgãos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        hours_multiplier: parseFloat(formData.hours_multiplier),
        is_federal: formData.is_federal
      };

      if (editingId) {
        const { error } = await supabase
          .from("organ_types" as any)
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Tipo de órgão atualizado!" });
      } else {
        const { error } = await supabase
          .from("organ_types" as any)
          .insert(payload);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Tipo de órgão criado!" });
      }

      resetForm();
      fetchOrganTypes();
    } catch (error: any) {
      console.error("Error saving organ type:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar tipo de órgão",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (organType: OrganType) => {
    setEditingId(organType.id);
    setFormData({
      name: organType.name,
      hours_multiplier: organType.hours_multiplier.toString(),
      is_federal: organType.is_federal
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (name === "Normal") {
      toast({
        title: "Não permitido",
        description: "O tipo 'Normal' não pode ser excluído.",
        variant: "destructive"
      });
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir "${name}"?`)) return;

    try {
      const { error } = await supabase
        .from("organ_types" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Tipo de órgão excluído!" });
      fetchOrganTypes();
    } catch (error: any) {
      console.error("Error deleting organ type:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir. Pode estar em uso.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({ name: "", hours_multiplier: "1.0", is_federal: false });
    setEditingId(null);
    setDialogOpen(false);
  };

  const getMultiplierPercentage = (multiplier: number) => {
    return Math.round(multiplier * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Tipos de Órgãos</h1>
          <p className="text-muted-foreground">
            Gerencie os multiplicadores de carga horária para órgãos federais
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Tipo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Tipo de Órgão" : "Novo Tipo de Órgão"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do Tipo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Tribunal de Contas da União"
                  required
                />
              </div>

              <div>
                <Label htmlFor="hours_multiplier">Multiplicador de Carga Horária *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="hours_multiplier"
                    type="number"
                    step="0.01"
                    min="0.1"
                    max="1.0"
                    value={formData.hours_multiplier}
                    onChange={(e) => setFormData({ ...formData, hours_multiplier: e.target.value })}
                    className="w-24"
                    required
                  />
                  <span className="text-muted-foreground">
                    = {getMultiplierPercentage(parseFloat(formData.hours_multiplier) || 1)}% da carga horária
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ex: 0.5 = 50% da carga horária (390h → 195h)
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_federal"
                  checked={formData.is_federal}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_federal: checked })}
                />
                <Label htmlFor="is_federal">É órgão federal</Label>
              </div>

              {formData.is_federal && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Órgãos federais possuem carga horária diferenciada nos certificados e declarações.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Salvando..." : (editingId ? "Atualizar" : "Criar")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Como funciona?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Órgãos federais como a <strong>Câmara dos Deputados</strong> e o <strong>Senado Federal</strong> 
            possuem tabelas de carga horária diferenciadas para cursos de capacitação.
          </p>
          <p>
            O <strong>multiplicador</strong> define qual percentual da carga horária normal será aplicado.
            Por exemplo, um multiplicador de 0.5 (50%) transforma um curso de 390 horas em 195 horas.
          </p>
          <p>
            A carga horária ajustada aparecerá em todos os documentos: <strong>certificados</strong>, 
            <strong>declarações de matrícula</strong> e <strong>planos de estudo</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-center">Multiplicador</TableHead>
                <TableHead className="text-center">Exemplo (390h)</TableHead>
                <TableHead className="text-center">Federal</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organTypes.map((organType) => (
                <TableRow key={organType.id}>
                  <TableCell className="font-medium">{organType.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="gap-1">
                      <Percent className="h-3 w-3" />
                      {getMultiplierPercentage(organType.hours_multiplier)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-muted-foreground">
                      {Math.round(390 * organType.hours_multiplier)}h
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {organType.is_federal ? (
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Federal
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(organType)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(organType.id, organType.name)}
                        disabled={organType.name === "Normal"}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganTypesPage;
