import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface QuickInstitutionCreateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (institutionId: string) => void;
}

const FEDERAL_DEFAULT_RULES = {
  "15": 65,
  "30": 130,
  "45": 195,
  "60": 260,
  "75": 295,
  "90": 390,
};

export function QuickInstitutionCreate({
  open,
  onOpenChange,
  onSuccess,
}: QuickInstitutionCreateProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "federal",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, preencha o nome da instituição",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("institutions")
        .insert({
          name: formData.name.trim(),
          type: formData.type,
          workload_rules: FEDERAL_DEFAULT_RULES,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Instituição cadastrada com sucesso",
      });

      onSuccess(data.id);
      onOpenChange(false);
      setFormData({ name: "", type: "federal" });
    } catch (error: any) {
      console.error("Error creating institution:", error);
      toast({
        title: "Erro ao cadastrar",
        description: error.message || "Não foi possível cadastrar a instituição",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Cadastrar Nova Instituição</DialogTitle>
            <DialogDescription>
              Preencha os dados da nova instituição. A carga horária seguirá as regras padrão federais.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome da Instituição *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Universidade Federal do..."
                disabled={loading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Tipo de Instituição</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
                disabled={loading}
              >
                <SelectTrigger id="type">
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
            <div className="rounded-lg border border-border bg-muted p-3">
              <p className="text-sm font-medium mb-2">Regras de Carga Horária (padrão federal)</p>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div>15 dias = 65h</div>
                <div>30 dias = 130h</div>
                <div>45 dias = 195h</div>
                <div>60 dias = 260h</div>
                <div>75 dias = 295h</div>
                <div>90 dias = 390h</div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar Instituição
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
