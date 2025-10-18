import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface PeriodFilterProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function PeriodFilter({ 
  value, 
  onChange, 
  label = "Período" 
}: PeriodFilterProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Filtrar por período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os períodos</SelectItem>
          <SelectItem value="15">15 dias</SelectItem>
          <SelectItem value="30">30 dias</SelectItem>
          <SelectItem value="45">45 dias</SelectItem>
          <SelectItem value="60">60 dias</SelectItem>
          <SelectItem value="90">90 dias</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
