import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DurationFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DurationFilter({ value, onChange, placeholder = "Filtrar por duração" }: DurationFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full md:w-48">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as durações</SelectItem>
        <SelectItem value="15">15 dias</SelectItem>
        <SelectItem value="45">45 dias</SelectItem>
        <SelectItem value="60">60 dias</SelectItem>
        <SelectItem value="90">90 dias</SelectItem>
      </SelectContent>
    </Select>
  );
}
