import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Bug, Copy, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface PreEnrollment {
  id: string;
  status: string;
  organ_approval_confirmed: boolean;
  courses: {
    id: string;
    name: string;
    enrollment_fee: number;
    pre_enrollment_fee: number;
    discounted_enrollment_fee: number | null;
  };
}

interface DiagnosticResult {
  success: boolean;
  checkout_url?: string;
  applied_amount?: number;
  reason?: string;
  pre_paid_total?: number;
  candidate_from_db?: number;
  candidate_from_payments?: number;
  discounted_fee_db?: number;
  original_fee?: number;
  reused?: boolean;
  override_received?: string;
  error?: string;
  raw_response?: any;
}

export default function CheckoutDebugPage() {
  const { user, session } = useAuth();
  const [preEnrollments, setPreEnrollments] = useState<PreEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagnosing, setDiagnosing] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, DiagnosticResult>>({});

  useEffect(() => {
    if (user) {
      fetchPreEnrollments();
    }
  }, [user]);

  const fetchPreEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from("pre_enrollments")
        .select(`
          id,
          status,
          organ_approval_confirmed,
          courses (
            id,
            name,
            enrollment_fee,
            pre_enrollment_fee
          )
        `)
        .eq("user_id", user?.id)
        .in("status", ["payment_confirmed", "approved"]);

      if (error) throw error;
      // Cast to any to bypass type check for discounted_enrollment_fee
      setPreEnrollments((data as any) || []);
    } catch (error) {
      console.error("Erro ao buscar pré-matrículas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as pré-matrículas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostic = async (preEnrollment: PreEnrollment) => {
    setDiagnosing(preEnrollment.id);
    
    try {
      // First, check if there's an existing enrollment
      const { data: existingEnrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("pre_enrollment_id", preEnrollment.id)
        .maybeSingle();

      let enrollmentId = existingEnrollment?.id;

      // If no enrollment exists, we need to create one temporarily for the test
      if (!enrollmentId) {
        const { data: newEnrollment, error: enrollError } = await supabase
          .from("enrollments")
          .insert({
            pre_enrollment_id: preEnrollment.id,
            user_id: user?.id,
            course_id: preEnrollment.courses.id,
            status: "pending_payment",
          })
          .select()
          .single();

        if (enrollError) {
          throw new Error(`Erro ao criar enrollment temporário: ${enrollError.message}`);
        }
        enrollmentId = newEnrollment.id;
      }

      console.log("🔍 [DEBUG] Chamando Edge Function com:", {
        pre_enrollment_id: preEnrollment.id,
        enrollment_id: enrollmentId,
        force_recalculate: true,
      });

      // Call the edge function
      const { data, error } = await supabase.functions.invoke(
        "create-enrollment-checkout",
        {
          body: {
            pre_enrollment_id: preEnrollment.id,
            enrollment_id: enrollmentId,
            force_recalculate: true,
          },
        }
      );

      console.log("🔍 [DEBUG] Resposta da Edge Function:", data);

      if (error) {
        setResults((prev) => ({
          ...prev,
          [preEnrollment.id]: {
            success: false,
            error: error.message,
            raw_response: error,
          },
        }));
        return;
      }

      // Extract diagnostic info from response
      const result: DiagnosticResult = {
        success: true,
        checkout_url: data.checkout_url,
        applied_amount: data.applied_amount,
        reason: data.reason,
        pre_paid_total: data.pre_paid_total,
        candidate_from_db: data.candidate_from_db,
        candidate_from_payments: data.candidate_from_payments,
        discounted_fee_db: data.discounted_fee_db,
        original_fee: data.original_fee,
        reused: data.reused,
        override_received: data.override_received,
        raw_response: data,
      };

      setResults((prev) => ({
        ...prev,
        [preEnrollment.id]: result,
      }));

      toast({
        title: "Diagnóstico concluído",
        description: `Valor aplicado: R$ ${result.applied_amount?.toFixed(2)} (${result.reason})`,
      });
    } catch (error: any) {
      console.error("Erro no diagnóstico:", error);
      setResults((prev) => ({
        ...prev,
        [preEnrollment.id]: {
          success: false,
          error: error.message || "Erro desconhecido",
          raw_response: error,
        },
      }));
    } finally {
      setDiagnosing(null);
    }
  };

  const copyToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast({
      title: "Copiado!",
      description: "JSON copiado para a área de transferência.",
    });
  };

  const getReasonBadge = (reason?: string) => {
    switch (reason) {
      case "payments_total":
        return <Badge className="bg-primary text-primary-foreground">Pagamentos</Badge>;
      case "db_discounted_fee":
        return <Badge className="bg-secondary text-secondary-foreground">Banco</Badge>;
      case "no_credit_full_price":
        return <Badge variant="destructive">Sem Desconto</Badge>;
      default:
        return <Badge variant="outline">{reason || "N/A"}</Badge>;
    }
  };

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Faça login para acessar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Debug do Checkout - Diagnóstico de Descontos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Esta página permite diagnosticar problemas com o cálculo de descontos no checkout.
            Clique em "Diagnosticar" para ver exatamente o que a Edge Function retorna sem redirecionar para o Asaas.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">Ambiente: {window.location.hostname}</Badge>
            <Badge variant="outline">User ID: {user?.id?.substring(0, 8)}...</Badge>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : preEnrollments.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              Nenhuma pré-matrícula confirmada encontrada para diagnóstico.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {preEnrollments.map((pe) => (
            <Card key={pe.id}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{pe.courses.name}</span>
                  <Badge variant="outline">{pe.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Info do curso */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Taxa Matrícula</p>
                    <p className="font-medium">R$ {pe.courses.enrollment_fee?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Taxa Pré-Matrícula</p>
                    <p className="font-medium">R$ {pe.courses.pre_enrollment_fee?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Desconto DB</p>
                    <p className="font-medium">
                      {pe.courses.discounted_enrollment_fee
                        ? `R$ ${pe.courses.discounted_enrollment_fee.toFixed(2)}`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Órgão Confirmado</p>
                    <p className="font-medium">{pe.organ_approval_confirmed ? "Sim" : "Não"}</p>
                  </div>
                </div>

                {/* Botão de diagnóstico */}
                <Button
                  onClick={() => runDiagnostic(pe)}
                  disabled={diagnosing === pe.id}
                  className="w-full"
                >
                  {diagnosing === pe.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Diagnosticando...
                    </>
                  ) : (
                    <>
                      <Bug className="mr-2 h-4 w-4" />
                      Diagnosticar Checkout
                    </>
                  )}
                </Button>

                {/* Resultado do diagnóstico */}
                {results[pe.id] && (
                  <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        {results[pe.id].success ? (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        Resultado do Diagnóstico
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(results[pe.id].raw_response)}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copiar JSON
                      </Button>
                    </div>

                    {results[pe.id].error ? (
                      <div className="text-destructive text-sm">
                        <strong>Erro:</strong> {results[pe.id].error}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="col-span-2 p-3 bg-background rounded border">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Valor Aplicado</span>
                            <span className="text-2xl font-bold text-primary">
                              R$ {results[pe.id].applied_amount?.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-muted-foreground">Razão:</span>
                            {getReasonBadge(results[pe.id].reason)}
                          </div>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Pré-pago (payments)</p>
                          <p className="font-medium">
                            R$ {results[pe.id].pre_paid_total?.toFixed(2) || "0.00"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Candidato DB</p>
                          <p className="font-medium">
                            R$ {results[pe.id].candidate_from_db?.toFixed(2) || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Candidato Pagamentos</p>
                          <p className="font-medium">
                            R$ {results[pe.id].candidate_from_payments?.toFixed(2) || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Reutilizado?</p>
                          <p className="font-medium">
                            {results[pe.id].reused ? (
                              <Badge variant="secondary">Sim</Badge>
                            ) : (
                              <Badge variant="outline">Não (novo)</Badge>
                            )}
                          </p>
                        </div>

                        {results[pe.id].checkout_url && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground mb-1">Checkout URL</p>
                            <code className="text-xs bg-background p-2 rounded block break-all">
                              {results[pe.id].checkout_url}
                            </code>
                          </div>
                        )}

                        {/* Análise automática */}
                        <div className="col-span-2 mt-2 p-3 rounded border">
                          <h5 className="font-medium mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                            Análise
                          </h5>
                          <ul className="text-xs space-y-1">
                            {results[pe.id].pre_paid_total === 0 && (
                              <li className="text-destructive">
                                ⚠️ Nenhum pagamento confirmado encontrado na tabela payments
                              </li>
                            )}
                            {results[pe.id].reason === "no_credit_full_price" && (
                              <li className="text-destructive">
                                ⚠️ Desconto NÃO aplicado - valor cheio será cobrado
                              </li>
                            )}
                            {results[pe.id].reason === "db_discounted_fee" && (
                              <li className="text-primary">
                                ✅ Desconto aplicado usando valor do banco de dados
                              </li>
                            )}
                            {results[pe.id].reason === "payments_total" && (
                              <li className="text-primary">
                                ✅ Desconto calculado baseado em pagamentos reais
                              </li>
                            )}
                            {results[pe.id].reused && (
                              <li className="text-muted-foreground">
                                ⚠️ Checkout REUTILIZADO - pode ter valor antigo
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
