import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter } from "@/components/admin/filters/DateRangeFilter";
import { CourseFilter } from "@/components/admin/filters/CourseFilter";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Search, Receipt, TrendingDown, Calculator, CalendarDays } from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

interface DiscountData {
  id: string;
  studentName: string;
  email: string;
  courseName: string;
  preEnrollmentPaid: number;
  originalFee: number;
  finalAmount: number;
  discount: number;
  paidAt: string;
}

export default function DiscountsReportPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Fetch enrollment payments with pre-enrollment data
  const { data: enrollmentPayments, isLoading: isLoadingEnrollments } = useQuery({
    queryKey: ["enrollment-payments-for-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          paid_at,
          kind,
          status,
          pre_enrollment_id,
          pre_enrollments!inner (
            id,
            full_name,
            email,
            course_id,
            courses!inner (
              id,
              name,
              enrollment_fee,
              pre_enrollment_fee
            )
          )
        `)
        .eq("kind", "enrollment")
        .in("status", ["confirmed", "received"])
        .order("paid_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch pre-enrollment payments to calculate discounts
  const { data: preEnrollmentPayments, isLoading: isLoadingPreEnrollments } = useQuery({
    queryKey: ["pre-enrollment-payments-for-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, pre_enrollment_id")
        .eq("kind", "pre_enrollment")
        .in("status", ["confirmed", "received"]);

      if (error) throw error;
      return data;
    },
  });

  // Fetch courses for filter
  const { data: courses } = useQuery({
    queryKey: ["courses-for-discounts-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Process and calculate discounts
  const discountsData = useMemo<DiscountData[]>(() => {
    if (!enrollmentPayments || !preEnrollmentPayments) return [];

    // Create a map of pre-enrollment payments by pre_enrollment_id
    const preEnrollmentMap = new Map<string, number>();
    preEnrollmentPayments.forEach((p) => {
      if (p.pre_enrollment_id) {
        const current = preEnrollmentMap.get(p.pre_enrollment_id) || 0;
        preEnrollmentMap.set(p.pre_enrollment_id, current + (p.amount || 0));
      }
    });

    return enrollmentPayments
      .map((payment) => {
        const preEnrollment = payment.pre_enrollments as any;
        const course = preEnrollment?.courses;
        
        if (!preEnrollment || !course) return null;

        const preEnrollmentPaid = preEnrollmentMap.get(preEnrollment.id) || 0;
        const originalFee = course.enrollment_fee || 0;
        const finalAmount = payment.amount || 0;
        const discount = originalFee - finalAmount;

        // Only include if there was a discount applied
        if (discount <= 0) return null;

        return {
          id: payment.id,
          studentName: preEnrollment.full_name || "N/A",
          email: preEnrollment.email || "N/A",
          courseName: course.name || "N/A",
          preEnrollmentPaid,
          originalFee,
          finalAmount,
          discount,
          paidAt: payment.paid_at || "",
        };
      })
      .filter((d): d is DiscountData => d !== null);
  }, [enrollmentPayments, preEnrollmentPayments]);

  // Apply filters
  const filteredData = useMemo(() => {
    return discountsData.filter((item) => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        item.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.email.toLowerCase().includes(searchTerm.toLowerCase());

      // Course filter
      const matchesCourse =
        courseFilter === "all" ||
        courses?.find((c) => c.id === courseFilter)?.name === item.courseName;

      // Date range filter
      let matchesDate = true;
      if (dateRange?.from && item.paidAt) {
        const paymentDate = new Date(item.paidAt);
        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        matchesDate = isWithinInterval(paymentDate, { start: from, end: to });
      }

      return matchesSearch && matchesCourse && matchesDate;
    });
  }, [discountsData, searchTerm, courseFilter, dateRange, courses]);

  // Calculate summary metrics
  const summary = useMemo(() => {
    const total = filteredData.length;
    const totalDiscount = filteredData.reduce((sum, d) => sum + d.discount, 0);
    const avgDiscount = total > 0 ? totalDiscount / total : 0;

    return { total, totalDiscount, avgDiscount };
  }, [filteredData]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Aluno",
      "Email",
      "Curso",
      "Pré-Matrícula Paga (R$)",
      "Valor Original (R$)",
      "Desconto (R$)",
      "Valor Final (R$)",
      "Data",
    ];

    const rows = filteredData.map((d) => [
      d.studentName,
      d.email,
      d.courseName,
      d.preEnrollmentPaid.toFixed(2),
      d.originalFee.toFixed(2),
      d.discount.toFixed(2),
      d.finalAmount.toFixed(2),
      d.paidAt ? format(new Date(d.paidAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
    ]);

    const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-descontos-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const isLoading = isLoadingEnrollments || isLoadingPreEnrollments;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatório de Descontos</h1>
        <p className="text-muted-foreground">
          Visualize todos os descontos aplicados por pré-matrícula paga
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Descontos</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{summary.total}</div>
            )}
            <p className="text-xs text-muted-foreground">matrículas com desconto</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalDiscount)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">em descontos aplicados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Matrícula</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(summary.avgDiscount)}</div>
            )}
            <p className="text-xs text-muted-foreground">desconto médio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Período</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {dateRange?.from
                ? `${format(dateRange.from, "dd/MM/yy", { locale: ptBR })} - ${
                    dateRange.to ? format(dateRange.to, "dd/MM/yy", { locale: ptBR }) : "..."
                  }`
                : "Todo período"}
            </div>
            <p className="text-xs text-muted-foreground">filtro de data ativo</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Buscar aluno</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="min-w-[200px]">
              <CourseFilter value={courseFilter} onChange={setCourseFilter} />
            </div>

            <div className="min-w-[280px]">
              <DateRangeFilter
                value={dateRange}
                onChange={setDateRange}
                label="Período"
                placeholder="Selecione o período"
              />
            </div>

            <Button variant="outline" onClick={handleExportCSV} disabled={filteredData.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Descontos Aplicados</CardTitle>
          <CardDescription>
            {filteredData.length} registro{filteredData.length !== 1 ? "s" : ""} encontrado
            {filteredData.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum desconto encontrado com os filtros aplicados.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead className="text-right">Pré-Matrícula</TableHead>
                    <TableHead className="text-right">Valor Original</TableHead>
                    <TableHead className="text-right">Desconto</TableHead>
                    <TableHead className="text-right">Valor Final</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.studentName}</p>
                          <p className="text-xs text-muted-foreground">{item.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.courseName}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.preEnrollmentPaid)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(item.originalFee)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-green-600 font-medium">
                          -{formatCurrency(item.discount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.finalAmount)}
                      </TableCell>
                      <TableCell>
                        {item.paidAt
                          ? format(new Date(item.paidAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
