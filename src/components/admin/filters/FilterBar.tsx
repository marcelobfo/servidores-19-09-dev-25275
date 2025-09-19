import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface FilterBarProps {
  children: ReactNode;
  onClearFilters?: () => void;
  className?: string;
}

export const FilterBar = ({ children, onClearFilters, className = "" }: FilterBarProps) => {
  return (
    <Card className={`mb-6 ${className}`}>
      <CardContent className="pt-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
          <div className="flex-1 flex flex-col sm:flex-row gap-4 flex-wrap">
            {children}
          </div>
          {onClearFilters && (
            <Button variant="outline" onClick={onClearFilters} className="shrink-0">
              <X className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};