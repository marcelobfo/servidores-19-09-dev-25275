import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

export type ModuleItem = { name: string; hours: number };

interface ModuleEditorProps {
  modules: ModuleItem[];
  onChange: (modules: ModuleItem[]) => void;
}

export default function ModuleEditor({ modules, onChange }: ModuleEditorProps) {
  const handleChange = (index: number, key: keyof ModuleItem, value: string) => {
    const next = [...modules];
    if (key === "hours") {
      next[index][key] = Number(value) || 0;
    } else {
      next[index][key] = value as any;
    }
    onChange(next);
  };

  const addModule = () => onChange([...modules, { name: "", hours: 0 }]);
  const removeModule = (idx: number) => onChange(modules.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {modules.map((m, idx) => (
        <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
          <div className="md:col-span-7">
            <Label htmlFor={`module-name-${idx}`}>Nome do módulo</Label>
            <Input
              id={`module-name-${idx}`}
              value={m.name}
              onChange={(e) => handleChange(idx, "name", e.target.value)}
              placeholder={`Módulo ${idx + 1}`}
            />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor={`module-hours-${idx}`}>Horas</Label>
            <Input
              id={`module-hours-${idx}`}
              type="number"
              value={m.hours}
              onChange={(e) => handleChange(idx, "hours", e.target.value)}
              min={0}
            />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button type="button" variant="outline" onClick={() => removeModule(idx)} aria-label="Remover módulo">
              <Trash2 className="h-4 w-4" />
            </Button>
            {idx === modules.length - 1 && (
              <Button type="button" onClick={addModule} aria-label="Adicionar módulo">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
