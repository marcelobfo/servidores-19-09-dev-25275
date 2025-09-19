import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FilterBar } from "@/components/admin/filters/FilterBar";
import { SearchInput } from "@/components/admin/filters/SearchInput";
import { StatusFilter } from "@/components/admin/filters/StatusFilter";
import { CourseFilter } from "@/components/admin/filters/CourseFilter";
import { DateRangeFilter } from "@/components/admin/filters/DateRangeFilter";
import { DateRange } from "react-day-picker";

interface Enrollment {
  id: string;
  status: string;
  payment_status: string;
  created_at: string;
  pre_enrollment: {
    full_name: string;
    email: string;
  } | null;
  course: {
    name: string;
  } | null;
}

export default function EnrollmentsManagementPage() {
  const [items, setItems] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  const { toast } = useToast();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("enrollments")
        .select(
          `*,
           pre_enrollment:pre_enrollments(full_name,email),
           course:courses(name)`
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems((data as any) || []);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao carregar matrículas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; variant: any }> = {
      awaiting_payment: { label: "Aguardando Pagamento", variant: "secondary" },
      paid: { label: "Pago", variant: "default" },
      canceled: { label: "Cancelado", variant: "destructive" },
    };
    const v = map[s] || { label: s, variant: "outline" };
    return <Badge variant={v.variant}>{v.label}</Badge>;
  };

  const payBadge = (s: string) => {
    const map: Record<string, { label: string; variant: any }> = {
      pending: { label: "Pendente", variant: "secondary" },
      received: { label: "Recebido", variant: "default" },
      confirmed: { label: "Confirmado", variant: "default" },
      failed: { label: "Falhou", variant: "destructive" },
    };
    const v = map[s] || { label: s, variant: "outline" };
    return <Badge variant={v.variant}>{v.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = searchTerm === "" ||
      (item.pre_enrollment?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.pre_enrollment?.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.course?.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesPayment = paymentFilter === "all" || item.payment_status === paymentFilter;
    
    const matchesCourse = selectedCourse === "all" || 
      (item.course?.name || "").toLowerCase().includes(selectedCourse.toLowerCase());
    
    const matchesDateRange = !dateRange?.from ||
      (new Date(item.created_at) >= dateRange.from &&
       (!dateRange.to || new Date(item.created_at) <= dateRange.to));
    
    return matchesSearch && matchesStatus && matchesPayment && matchesCourse && matchesDateRange;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setSelectedCourse("all");
    setDateRange(undefined);
  };

  const statusOptions = [
    { value: "all", label: "Todos" },
    { value: "awaiting_payment", label: "Aguardando Pagamento" },
    { value: "paid", label: "Pago" },
    { value: "canceled", label: "Cancelado" }
  ];

  const paymentOptions = [
    { value: "all", label: "Todos" },
    { value: "pending", label: "Pendente" },
    { value: "received", label: "Recebido" },
    { value: "confirmed", label: "Confirmado" },
    { value: "failed", label: "Falhou" }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gestão de Matrículas</h1>
        <Button variant="outline" onClick={load}>Recarregar</Button>
      </div>

      <FilterBar onClearFilters={clearFilters}>
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por aluno, email ou curso..."
          label="Buscar Matrícula"
        />
        <StatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          label="Status da Matrícula"
        />
        <StatusFilter
          value={paymentFilter}
          onChange={setPaymentFilter}
          options={paymentOptions}
          label="Status do Pagamento"
        />
        <CourseFilter
          value={selectedCourse}
          onChange={setSelectedCourse}
        />
        <DateRangeFilter
          value={dateRange}
          onChange={setDateRange}
          label="Data de Criação"
        />
      </FilterBar>

      <div className="mb-4 text-sm text-muted-foreground">
        Mostrando {filteredItems.length} de {items.length} matrículas
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matrículas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.pre_enrollment?.full_name || "-"}</TableCell>
                  <TableCell>{it.pre_enrollment?.email || "-"}</TableCell>
                  <TableCell>{it.course?.name || "-"}</TableCell>
                  <TableCell>{statusBadge(it.status)}</TableCell>
                  <TableCell>{payBadge(it.payment_status)}</TableCell>
                  <TableCell>{new Date(it.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
