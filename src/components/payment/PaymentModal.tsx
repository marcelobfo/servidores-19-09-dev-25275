import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QrCode, Copy, CheckCircle, Clock, X, CreditCard } from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preEnrollmentId: string;
  courseName: string;
  amount: number;
  onPaymentSuccess: () => void;
  kind?: 'pre_enrollment' | 'enrollment';
  enrollmentId?: string;
}

interface PaymentData {
  id: string;
  pix_qr_code: string;
  pix_payload: string;
  status: string;
  pix_expiration_date: string;
}

export function PaymentModal({ 
  isOpen, 
  onClose, 
  preEnrollmentId, 
  courseName, 
  amount,
  onPaymentSuccess,
  kind = 'pre_enrollment',
  enrollmentId
}: PaymentModalProps) {
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && !paymentData) {
      createPayment();
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (paymentData && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [paymentData, timeLeft]);

  useEffect(() => {
    if (paymentData?.pix_expiration_date) {
      const expirationTime = new Date(paymentData.pix_expiration_date).getTime();
      const currentTime = new Date().getTime();
      const timeDiff = Math.max(0, Math.floor((expirationTime - currentTime) / 1000));
      setTimeLeft(timeDiff);
    }
  }, [paymentData]);

  const createPayment = async () => {
    setLoading(true);
    try {
      console.log('Creating payment with:', {
        pre_enrollment_id: preEnrollmentId,
        amount: amount,
        kind,
        enrollment_id: enrollmentId
      });

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          pre_enrollment_id: preEnrollmentId,
          amount: amount,
          kind,
          enrollment_id: enrollmentId
        }
      });

      console.log('Payment response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Nenhum dado retornado do servidor');
      }

      // Check if the response indicates an error
      if (data.error) {
        throw new Error(data.error);
      }

      // Validate required fields
      if (!data.pix_qr_code || !data.pix_payload) {
        console.error('Invalid payment data:', data);
        throw new Error(
          data.error || 
          'QR Code não foi gerado. Isso pode acontecer devido a problemas temporários com o sistema de pagamento. Tente novamente em alguns instantes ou entre em contato com o suporte.'
        );
      }

      console.log('Payment created successfully:', data);
      setPaymentData(data);
    } catch (error: any) {
      console.error('Payment creation error:', error);
      toast({
        title: "Erro ao gerar pagamento",
        description: error.message || "Falha ao criar pagamento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (paymentData?.pix_payload) {
      try {
        await navigator.clipboard.writeText(paymentData.pix_payload);
        setCopied(true);
        toast({
          title: "Copiado!",
          description: "Código PIX copiado para a área de transferência"
        });
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast({
          title: "Erro",
          description: "Falha ao copiar código",
          variant: "destructive"
        });
      }
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentData) return;
    
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('status')
        .eq('id', paymentData.id)
        .single();

      if (error) throw error;

      if (data.status === 'received' || data.status === 'confirmed') {
        toast({
          title: "Pagamento confirmado!",
          description: "Seu pagamento foi processado com sucesso."
        });
        onPaymentSuccess();
        onClose();
      } else {
        toast({
          title: "Pagamento pendente",
          description: "O pagamento ainda está sendo processado. Tente novamente em alguns minutos."
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao verificar status do pagamento",
        variant: "destructive"
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = paymentData?.pix_expiration_date 
    ? Math.max(0, Math.min(100, (timeLeft / (24 * 60 * 60)) * 100))
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Pagamento PIX
          </DialogTitle>
          <DialogDescription>
            {kind === 'enrollment' ? 'Finalize seu pagamento para confirmar a matrícula' : 'Finalize seu pagamento para confirmar a pré-matrícula'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Course Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{courseName}</CardTitle>
              <CardDescription className="flex justify-between items-center">
                <span>{kind === 'enrollment' ? 'Taxa de matrícula' : 'Taxa de pré-matrícula'}</span>
                <Badge variant="secondary" className="text-lg font-semibold">
                  R$ {amount.toFixed(2)}
                </Badge>
              </CardDescription>
            </CardHeader>
          </Card>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">Gerando pagamento...</p>
            </div>
          ) : paymentData ? (
            <>
              {/* QR Code */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Escaneie o QR Code</CardTitle>
                  <CardDescription>
                    Use o app do seu banco para escanear o código
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <div className="relative">
                    {paymentData.pix_qr_code ? (
                      <img 
                        src={`data:image/png;base64,${paymentData.pix_qr_code}`}
                        alt="QR Code PIX"
                        className="w-48 h-48 border rounded-lg"
                      />
                    ) : (
                      <div className="w-48 h-48 border rounded-lg flex items-center justify-center bg-muted">
                        <QrCode className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* Copy Paste Code */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Ou copie o código</CardTitle>
                  <CardDescription>
                    Cole o código PIX diretamente no seu app de banco
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <div className="flex-1 p-3 bg-muted rounded text-xs font-mono break-all">
                      {paymentData.pix_payload}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={copyToClipboard}
                      className="flex-shrink-0"
                    >
                      {copied ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Timer */}
              {timeLeft > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Tempo restante</span>
                        <span className="text-sm text-muted-foreground">
                          {formatTime(timeLeft)}
                        </span>
                      </div>
                      <Progress value={progressPercentage} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={checkPaymentStatus}
                  disabled={checkingStatus}
                  className="w-full"
                >
                  {checkingStatus ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Já paguei
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <X className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">Falha ao gerar pagamento</p>
              <Button onClick={createPayment} variant="outline" size="sm">
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}