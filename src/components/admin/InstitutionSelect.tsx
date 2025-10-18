import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Institution {
  id: string;
  name: string;
  type: string;
}

interface InstitutionSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  onCreateNew: () => void;
}

export function InstitutionSelect({ value, onValueChange, onCreateNew }: InstitutionSelectProps) {
  const [open, setOpen] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const fetchInstitutions = async () => {
    try {
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name, type")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setInstitutions(data || []);
    } catch (error) {
      console.error("Error fetching institutions:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedInstitution = institutions.find((inst) => inst.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {loading ? (
            "Carregando..."
          ) : selectedInstitution ? (
            selectedInstitution.name
          ) : (
            "Digite para pesquisar ou cadastrar uma nova instituição..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-0 bg-background border-border" align="start">
        <Command className="bg-background">
          <CommandInput placeholder="Pesquisar instituição..." className="h-9" />
          <CommandList>
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-6">
                <p className="text-sm text-muted-foreground">Instituição não encontrada</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    onCreateNew();
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Cadastrar nova instituição
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {institutions.map((institution) => (
                <CommandItem
                  key={institution.id}
                  value={institution.name}
                  onSelect={() => {
                    onValueChange(institution.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === institution.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{institution.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {institution.type}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              onCreateNew();
            }}
            className="w-full gap-2 justify-start"
          >
            <Plus className="h-4 w-4" />
            Adicionar nova instituição
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
