import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, CheckCircle, Clock, X, CreditCard, Mail, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preEnrollmentId: string;
  courseName: string;
  amount: number;
  onPaymentSuccess: () => void;
  kind?: "pre_enrollment" | "enrollment";
  enrollmentId?: string;
}

interface PaymentData {
  id: string;
  pix_qr_code?: string;
  pix_payload?: string;
  status: string;
  pix_expiration_date?: string;
  checkout_url?: string; // Novo campo para Cartão/Boleto
  billing_type?: string;
}

export function PaymentModal({
  isOpen,
  onClose,
  preEnrollmentId,
  courseName,
  amount,
  onPaymentSuccess,
  kind = "pre_enrollment",
  enrollmentId,
}: PaymentModalProps) {
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [studentEmail, setStudentEmail] = useState<string>("");
  const { toast } = useToast();

  // Realtime subscription + Polling fallback para garantir atualização
  useEffect(() => {
    if (!paymentData?.id || !isOpen) return;

    console.log('🔔 [REALTIME] Iniciando subscription para payment:', paymentData.id);

    // Realtime subscription
    const channel = supabase
      .channel(`payment-${paymentData.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payments",
          filter: `id=eq.${paymentData.id}`,
        },
        (payload) => {
          console.log('🔔 [REALTIME] Update recebido:', payload);
          const newStatus = (payload.new as any).status;
          if (newStatus === "confirmed" || newStatus === "received") {
            toast({ title: "Pagamento confirmado!", description: "Seu pagamento foi processado com sucesso." });
            onPaymentSuccess();
            onClose();
          }
        },
      )
      .subscribe((status) => {
        console.log('🔔 [REALTIME] Subscription status:', status);
      });

    // Polling fallback - verifica a cada 5 segundos
    const pollingInterval = setInterval(async () => {
      console.log('🔄 [POLLING] Verificando status do pagamento...');
      const { data } = await supabase
        .from("payments")
        .select("status")
        .eq("id", paymentData.id)
        .single();
      
      if (data?.status === "received" || data?.status === "confirmed") {
        console.log('✅ [POLLING] Pagamento confirmado via polling!');
        toast({ title: "Pagamento confirmado!", description: "Seu pagamento foi processado com sucesso." });
        onPaymentSuccess();
        onClose();
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [paymentData?.id, isOpen, onPaymentSuccess, onClose, toast]);

  useEffect(() => {
    if (isOpen && !paymentData) {
      fetchStudentEmail();
      createPayment();
    }
  }, [isOpen]);

  const fetchStudentEmail = async () => {
    try {
      const { data } = await supabase.from("pre_enrollments").select("email").eq("id", preEnrollmentId).single();
      if (data?.email) setStudentEmail(data.email);
    } catch (error) {
      console.error("Error email:", error);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (paymentData && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [paymentData, timeLeft]);

  useEffect(() => {
    if (paymentData?.pix_expiration_date) {
      const expirationTime = new Date(paymentData.pix_expiration_date).getTime();
      const currentTime = new Date().getTime();
      setTimeLeft(Math.max(0, Math.floor((expirationTime - currentTime) / 1000)));
    }
  }, [paymentData]);

  const createPayment = async () => {
    setLoading(true);
    try {
      if (!preEnrollmentId || !amount) throw new Error("Dados inválidos");

      await supabase.auth.refreshSession();

      let enrollmentIdToSend = enrollmentId;
      if (kind === "enrollment" && !enrollmentIdToSend) {
        const { data } = await supabase
          .from("enrollments")
          .select("id")
          .eq("pre_enrollment_id", preEnrollmentId)
          .maybeSingle();
        if (data) enrollmentIdToSend = data.id;
      }

      // AJUSTE 1: Enviar o billing_type dinâmico
      // Se for pré-matrícula: PIX. Se for matrícula: UNDEFINED (libera cartão/boleto)
      // Localize este trecho dentro da sua função createPayment:
      // Localize o invoke('create-enrollment-checkout' ou 'create-payment') e substitua por este:
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          pre_enrollment_id: preEnrollmentId,
          amount: amount,
          kind: kind,
          enrollment_id: enrollmentIdToSend,
          // Garante que se for matrícula completa, abra o checkout multi-pagamento
          billing_type: kind === "enrollment" ? "UNDEFINED" : "PIX",
        },
      });

      if (error) {
        console.error("Erro na Edge Function:", error);
        throw new Error("Falha na comunicação com o servidor de pagamentos.");
      }

      // LÓGICA DE REDIRECIONAMENTO (O segredo para funcionar Cartão/Boleto)
      if (data?.checkout_url && kind === "enrollment") {
        toast({ title: "Redirecionando...", description: "Abrindo portal de pagamento seguro." });
        window.location.href = data.checkout_url;
        return; // Interrompe aqui para o usuário ir para o checkout
      }

      // O restante do seu código (setPaymentData, etc) continua abaixo...

      // O restante do seu código (setPaymentData(data), etc) continua igual

      setPaymentData(data);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (paymentData?.pix_payload) {
      await navigator.clipboard.writeText(paymentData.pix_payload);
      setCopied(true);
      toast({ title: "Copiado!" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentData) return;
    setCheckingStatus(true);
    try {
      const { data } = await supabase.from("payments").select("status").eq("id", paymentData.id).single();
      if (data?.status === "received" || data?.status === "confirmed") {
        onPaymentSuccess();
        onClose();
      } else {
        toast({ title: "Aguardando pagamento" });
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {kind === "enrollment" ? "Pagamento da Matrícula" : "Pagamento PIX"}
          </DialogTitle>
          <DialogDescription>
            {kind === "enrollment" ? "Escolha sua forma de pagamento" : "Escaneie o código para confirmar sua reserva"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{courseName}</CardTitle>
              <CardDescription className="flex justify-between items-center">
                <span>{kind === "enrollment" ? "Matrícula" : "Taxa de pré-matrícula"}</span>
                <Badge variant="secondary" className="text-lg">
                  R$ {amount.toFixed(2)}
                </Badge>
              </CardDescription>
            </CardHeader>
          </Card>

          {loading ? (
            <div className="flex flex-col items-center py-8 space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">Preparando checkout...</p>
            </div>
          ) : paymentData?.pix_payload ? (
            <>
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Copy className="h-5 w-5" /> PIX Copia e Cola
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-4 bg-muted rounded-lg border">
                    <p className="text-xs font-mono break-all">{paymentData.pix_payload}</p>
                  </div>
                  <Button onClick={copyToClipboard} className="w-full">
                    {copied ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? "Copiado!" : "Copiar Código PIX"}
                  </Button>
                </CardContent>
              </Card>
              {timeLeft > 0 && (
                <div className="text-center space-y-2">
                  <p className="text-xs text-muted-foreground">Expira em: {formatTime(timeLeft)}</p>
                  <Progress value={(timeLeft / 86400) * 100} className="h-1" />
                </div>
              )}
            </>
          ) : paymentData?.checkout_url ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Clique no botão abaixo para abrir o portal de pagamento (Cartão, Boleto ou PIX).
                </AlertDescription>
              </Alert>
              <Button onClick={() => window.open(paymentData.checkout_url, "_blank")} className="w-full" size="lg">
                <ExternalLink className="h-4 w-4 mr-2" /> Abrir Portal de Pagamento
              </Button>
            </div>
          ) : (
            <Button onClick={createPayment} variant="outline" className="w-full">
              Tentar novamente
            </Button>
          )}

          <div className="flex flex-col gap-3">
            <Button
              onClick={checkPaymentStatus}
              disabled={checkingStatus}
              className="w-full"
              variant={paymentData?.pix_payload ? "default" : "secondary"}
            >
              {checkingStatus ? "Verificando..." : "Já realizei o pagamento"}
            </Button>
            <Button variant="ghost" onClick={onClose} className="w-full">
              Voltar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
