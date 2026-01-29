import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, CheckCircle, Clock, X, CreditCard, Mail, ExternalLink, Loader2 } from "lucide-react";
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
  checkout_url?: string;
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
  const navigate = useNavigate();
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [studentEmail, setStudentEmail] = useState<string>("");
  
  // Estados para confirmação visual
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Limpa o countdown ao desmontar
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Handler para quando o pagamento é confirmado
  const handlePaymentConfirmed = useCallback(() => {
    if (paymentConfirmed) return; // Evita múltiplas execuções
    
    console.log('✅ Pagamento confirmado! Iniciando animação de sucesso...');
    setPaymentConfirmed(true);
    setRedirectCountdown(3);
    
    // Iniciar countdown de 3 segundos
    let count = 3;
    countdownRef.current = setInterval(() => {
      count--;
      setRedirectCountdown(count);
      
      if (count <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
        handleRedirect();
      }
    }, 1000);
  }, [paymentConfirmed]);

  // Redireciona para a página correta
  const handleRedirect = useCallback(() => {
    setIsRedirecting(true);
    onPaymentSuccess();
    onClose();
    
    // Redireciona baseado no tipo de pagamento
    if (kind === "enrollment") {
      navigate("/student/enrollments");
    } else {
      navigate("/student/pre-enrollments");
    }
  }, [kind, navigate, onPaymentSuccess, onClose]);

  // Realtime subscription + Polling fallback para garantir atualização
  useEffect(() => {
    if (!paymentData?.id || !isOpen || paymentConfirmed) return;

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
            handlePaymentConfirmed();
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
        handlePaymentConfirmed();
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [paymentData?.id, isOpen, paymentConfirmed, handlePaymentConfirmed]);

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
    if (paymentData && timeLeft > 0 && !paymentConfirmed) {
      interval = setInterval(() => {
        setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [paymentData, timeLeft, paymentConfirmed]);

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

      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          pre_enrollment_id: preEnrollmentId,
          amount: amount,
          kind: kind,
          enrollment_id: enrollmentIdToSend,
          billing_type: kind === "enrollment" ? "UNDEFINED" : "PIX",
        },
      });

      if (error) {
        console.error("Erro na Edge Function:", error);
        throw new Error("Falha na comunicação com o servidor de pagamentos.");
      }

      // LÓGICA DE REDIRECIONAMENTO para Cartão/Boleto
      if (data?.checkout_url && kind === "enrollment") {
        toast({ title: "Redirecionando...", description: "Abrindo portal de pagamento seguro." });
        window.location.href = data.checkout_url;
        return;
      }

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
        handlePaymentConfirmed();
      } else {
        toast({ title: "Aguardando pagamento", description: "O pagamento ainda não foi confirmado." });
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

  // Tela de redirecionamento
  if (isRedirecting) {
    return (
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md mx-auto">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium text-center">
              Carregando suas {kind === "enrollment" ? "matrículas" : "pré-matrículas"}...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Tela de pagamento confirmado com countdown
  if (paymentConfirmed) {
    return (
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md mx-auto">
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            {/* Ícone de sucesso animado */}
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/40 opacity-25" />
              <div className="relative rounded-full bg-primary p-4">
                <CheckCircle className="h-12 w-12 text-primary-foreground" />
              </div>
            </div>

            {/* Mensagem de sucesso */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-primary">
                Pagamento Confirmado!
              </h2>
              <p className="text-muted-foreground">
                Seu pagamento foi processado com sucesso.
              </p>
            </div>

            {/* Countdown visual */}
            <div className="text-center space-y-3 w-full">
              <p className="text-sm text-muted-foreground">
                Redirecionando em <span className="font-bold text-primary text-lg">{redirectCountdown}</span> segundos...
              </p>
              <Progress value={(redirectCountdown / 3) * 100} className="h-2" />
            </div>

            {/* Botão manual para redirecionamento imediato */}
            <Button 
              onClick={handleRedirect} 
              size="lg" 
              className="w-full"
            >
              {kind === "enrollment" ? "Ir para Minhas Matrículas" : "Ir para Minhas Pré-Matrículas"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              
              {/* Indicador de verificação automática */}
              <Alert className="border-primary/30 bg-primary/5">
                <Clock className="h-4 w-4 text-primary" />
                <AlertDescription className="text-foreground text-sm">
                  Verificando pagamento automaticamente... Não feche esta janela.
                </AlertDescription>
              </Alert>
              
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
              {checkingStatus ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Já realizei o pagamento"
              )}
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
