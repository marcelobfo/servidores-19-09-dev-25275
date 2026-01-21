import { useSearchParams, Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, CheckCircle2, ArrowLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function EmailSent() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const type = searchParams.get("type") || "signup"; // signup or reset
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    
    setResending(true);
    
    try {
      if (type === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: email,
        });
        
        if (error) throw error;
      }
      
      toast({
        title: "Email reenviado! ✉️",
        description: "Verifique sua caixa de entrada novamente.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao reenviar",
        description: error.message || "Tente novamente em alguns minutos.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  const isReset = type === "reset";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-4 pb-2">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          
          <div className="space-y-2">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-primary" />
              {isReset ? "Link Enviado!" : "Quase lá!"}
            </CardTitle>
            <CardDescription className="text-base">
              {isReset 
                ? "Enviamos um link para redefinir sua senha"
                : "Enviamos um email de confirmação para você"
              }
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {email && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Email enviado para:</p>
              <p className="font-medium text-foreground">{email}</p>
            </div>
          )}
          
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg p-5 space-y-3">
            <h3 className="font-semibold text-foreground">📬 Próximos passos:</h3>
            <ol className="text-sm text-muted-foreground text-left space-y-2 list-decimal list-inside">
              <li>Abra sua caixa de entrada</li>
              <li>Procure pelo email da <strong className="text-foreground">Infomar Cursos</strong></li>
              <li>
                Clique no botão{" "}
                <span className="text-primary font-medium">
                  {isReset ? '"Redefinir minha Senha"' : '"Confirmar meu Email"'}
                </span>
              </li>
            </ol>
          </div>
          
          <div className="bg-muted border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">💡 Dica:</strong> Não encontrou o email? Verifique sua pasta de{" "}
              <strong className="text-foreground">spam</strong> ou <strong className="text-foreground">lixo eletrônico</strong>.
            </p>
          </div>
          
          <div className="flex flex-col gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={handleResend}
              disabled={resending || !email}
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${resending ? "animate-spin" : ""}`} />
              {resending ? "Reenviando..." : "Reenviar email"}
            </Button>
            
            <Link to="/auth" className="w-full">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para o login
              </Button>
            </Link>
          </div>
          
          <p className="text-xs text-muted-foreground pt-2">
            O link expira em {isReset ? "1 hora" : "24 horas"}. 
            Se tiver problemas, entre em contato conosco.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
