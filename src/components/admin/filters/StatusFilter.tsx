import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface StatusOption {
  value: string;
  label: string;
}

interface StatusFilterProps {
  value: string;
  onChange: (value: string) => void;
  options: StatusOption[];
  label?: string;
  placeholder?: string;
  className?: string;
}

export const StatusFilter = ({ 
  value, 
  onChange, 
  options, 
  label = "Status",
  placeholder = "Selecionar status",
  className = ""
}: StatusFilterProps) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full min-w-[160px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};