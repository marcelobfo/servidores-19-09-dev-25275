import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, CheckCircle, Clock, X, CreditCard, Mail } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [studentEmail, setStudentEmail] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && !paymentData) {
      fetchStudentEmail();
      createPayment();
    }
  }, [isOpen]);

  const fetchStudentEmail = async () => {
    try {
      const { data, error } = await supabase
        .from('pre_enrollments')
        .select('email')
        .eq('id', preEnrollmentId)
        .single();
      
      if (error) throw error;
      if (data?.email) {
        setStudentEmail(data.email);
      }
    } catch (error) {
      console.error('Error fetching student email:', error);
    }
  };

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
      // Validate required data before calling function
      if (!preEnrollmentId || !amount || amount <= 0) {
        throw new Error('Dados de pagamento inválidos. Verifique se todos os dados obrigatórios estão preenchidos.');
      }

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

      // Log full error details for debugging
      if (error) {
        console.error('Full error object:', JSON.stringify(error, null, 2));
      }

      if (error) {
        console.error('Supabase function error:', error);
        
        // Erro específico: API keys não configuradas
        if (error.message?.includes('API key não configurada') || 
            error.message?.includes('Chave API') ||
            error.message?.includes('payment_settings') ||
            error.message?.includes('não configurado')) {
          throw new Error(
            'Sistema de pagamento não configurado. Por favor, entre em contato com o administrador para configurar as chaves API do Asaas em /admin/payment-settings.'
          );
        }
        
        // Erro específico: dados obrigatórios faltando
        if (error.message?.includes('obrigatório') || 
            error.message?.includes('faltando') ||
            error.message?.includes('CPF') ||
            error.message?.includes('telefone')) {
          throw new Error(
            'Alguns dados obrigatórios estão faltando no seu cadastro. Verifique se preencheu todos os campos do formulário de pré-matrícula, incluindo CPF e telefone.'
          );
        }

        // Erro 500 genérico
        if (error.message?.includes('non-2xx status code') || error.message?.includes('500')) {
          throw new Error(
            'Erro ao processar pagamento. Verifique se: 1) O sistema de pagamento está configurado; 2) Todos os seus dados obrigatórios estão preenchidos (CPF, telefone); 3) A taxa do curso está configurada. Se o erro persistir, contate o administrador.'
          );
        }
        
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
      
      // Check if this is an existing payment being reused
      if (data.isExisting) {
        toast({
          title: "Pagamento encontrado",
          description: "Você já possui um pagamento pendente válido. Use o QR Code abaixo.",
        });
      }
      
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
              {/* Copy Paste Code */}
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Copy className="h-5 w-5 text-primary" />
                    Código PIX Copia e Cola
                  </CardTitle>
                  <CardDescription>
                    Cole este código no app do seu banco para efetuar o pagamento
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-4 bg-muted rounded-lg border">
                    <p className="text-xs font-mono break-all leading-relaxed">
                      {paymentData.pix_payload}
                    </p>
                  </div>
                  <Button 
                    onClick={copyToClipboard}
                    className="w-full"
                    size="lg"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Código PIX
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Expiration Info */}
              {timeLeft > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-5 w-5 text-orange-500" />
                      Validade do Código
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Expira em:</span>
                        <span className="text-sm font-semibold">
                          {paymentData.pix_expiration_date && format(
                            new Date(paymentData.pix_expiration_date), 
                            "dd/MM/yyyy 'às' HH:mm",
                            { locale: ptBR }
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Tempo restante:</span>
                        <span className="text-sm font-mono">
                          {formatTime(timeLeft)}
                        </span>
                      </div>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                  </CardContent>
                </Card>
              )}

              {/* Email Notification */}
              {studentEmail && (
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription className="ml-2">
                    <p className="font-medium mb-1">Cobrança enviada por email</p>
                    <p className="text-sm text-muted-foreground">
                      A cobrança também foi enviada para <strong>{studentEmail}</strong>. 
                      Verifique sua caixa de entrada!
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={checkPaymentStatus}
                  disabled={checkingStatus}
                  className="w-full"
                  size="lg"
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
                  Fechar
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