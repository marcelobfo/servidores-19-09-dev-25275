import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FilterBar } from "@/components/admin/filters/FilterBar";
import { SearchInput } from "@/components/admin/filters/SearchInput";
import { DateRangeFilter } from "@/components/admin/filters/DateRangeFilter";
import { DateRange } from "react-day-picker";

interface Area {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

const AreasPage = () => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: ""
  });

  useEffect(() => {
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    try {
      const { data, error } = await supabase
        .from("areas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAreas(data || []);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar áreas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingArea) {
        const { error } = await supabase
          .from("areas")
          .update(formData)
          .eq("id", editingArea.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Área atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from("areas")
          .insert([formData]);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Área criada com sucesso!" });
      }

      fetchAreas();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar área",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (area: Area) => {
    setEditingArea(area);
    setFormData({
      name: area.name,
      description: area.description || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta área?")) return;

    try {
      const { error } = await supabase
        .from("areas")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Área excluída com sucesso!" });
      fetchAreas();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao excluir área",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: ""
    });
    setEditingArea(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  const filteredAreas = areas.filter(area => {
    const matchesSearch = searchTerm === "" ||
      area.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (area.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDateRange = !dateRange?.from ||
      (new Date(area.created_at) >= dateRange.from &&
       (!dateRange.to || new Date(area.created_at) <= dateRange.to));
    
    return matchesSearch && matchesDateRange;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setDateRange(undefined);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestão de Áreas</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Área
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingArea ? "Editar Área" : "Nova Área"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Área</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingArea ? "Atualizar" : "Criar"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <FilterBar onClearFilters={clearFilters}>
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por nome ou descrição..."
          label="Buscar Áreas"
        />
        <DateRangeFilter
          value={dateRange}
          onChange={setDateRange}
          label="Data de Criação"
        />
      </FilterBar>

      <div className="mb-4 text-sm text-muted-foreground">
        Mostrando {filteredAreas.length} de {areas.length} áreas
      </div>

      <div className="grid gap-4">
        {filteredAreas.map((area) => (
          <Card key={area.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{area.name}</CardTitle>
                  <CardDescription>
                    Criada em {new Date(area.created_at).toLocaleDateString()}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(area)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(area.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {area.description && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{area.description}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AreasPage;