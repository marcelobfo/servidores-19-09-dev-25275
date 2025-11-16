import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cookie, X } from "lucide-react";

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: string;
}

const COOKIE_CONSENT_KEY = "cookie-consent-v1";

export const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
    timestamp: new Date().toISOString(),
    version: "1.0"
  });

  useEffect(() => {
    const savedPreferences = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!savedPreferences) {
      // Delay banner appearance for better UX
      setTimeout(() => setShowBanner(true), 1000);
    }
  }, []);

  const savePreferences = (prefs: CookiePreferences) => {
    const updatedPrefs = {
      ...prefs,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(updatedPrefs));
    setPreferences(updatedPrefs);
    setShowBanner(false);
    setShowModal(false);
  };

  const acceptAll = () => {
    savePreferences({
      essential: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
      version: "1.0"
    });
  };

  const rejectAll = () => {
    savePreferences({
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
      version: "1.0"
    });
  };

  const saveCustomPreferences = () => {
    savePreferences(preferences);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Cookie Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 bg-card/95 backdrop-blur-lg border-t shadow-lg animate-fade-in">
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">🍪 Utilizamos cookies</p>
                <p className="text-sm text-muted-foreground">
                  Utilizamos cookies para melhorar sua experiência, personalizar conteúdo e analisar o tráfego. 
                  Ao continuar navegando, você concorda com nossa{" "}
                  <a href="/privacy-policy" className="underline hover:text-primary">Política de Privacidade</a>.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowModal(true)}
                className="flex-1 md:flex-none"
              >
                Personalizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={rejectAll}
                className="flex-1 md:flex-none"
              >
                Rejeitar
              </Button>
              <Button
                size="sm"
                onClick={acceptAll}
                className="flex-1 md:flex-none"
              >
                Aceitar Todos
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-primary" />
              Preferências de Cookies
            </DialogTitle>
            <DialogDescription>
              Personalize suas preferências de cookies. Você pode alterar suas escolhas a qualquer momento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Essential Cookies */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label className="text-sm font-medium">
                    Cookies Essenciais
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Necessários para o funcionamento básico do site. Não podem ser desativados.
                  </p>
                </div>
                <Switch
                  checked={preferences.essential}
                  disabled
                  className="ml-3"
                />
              </div>
            </div>

            {/* Analytics Cookies */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="analytics" className="text-sm font-medium">
                    Cookies de Analytics
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Nos ajudam a entender como você usa nosso site para melhorarmos a experiência.
                  </p>
                </div>
                <Switch
                  id="analytics"
                  checked={preferences.analytics}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, analytics: checked })
                  }
                  className="ml-3"
                />
              </div>
            </div>

            {/* Marketing Cookies */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="marketing" className="text-sm font-medium">
                    Cookies de Marketing
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Usados para personalizar anúncios e conteúdo relevante para você.
                  </p>
                </div>
                <Switch
                  id="marketing"
                  checked={preferences.marketing}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, marketing: checked })
                  }
                  className="ml-3"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={saveCustomPreferences}>
              Salvar Preferências
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
