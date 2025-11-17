import { useState, useEffect } from "react";
import { GraduationCap, Mail, Phone, Clock, Facebook, Instagram, Linkedin } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface FooterSettings {
  institution_name: string;
  institution_cnpj: string;
  institution_phone: string;
  footer_description: string;
  social_facebook: string;
  social_instagram: string;
  social_linkedin: string;
  contact_email: string;
  dpo_email: string;
  business_hours: string;
}

export const Footer = () => {
  const [settings, setSettings] = useState<FooterSettings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("institution_name, institution_cnpj, institution_phone, footer_description, social_facebook, social_instagram, social_linkedin, contact_email, dpo_email, business_hours")
      .limit(1)
      .maybeSingle();
    
    if (data) setSettings(data);
  };

  // Default values if settings not loaded
  const footerData = settings || {
    institution_name: "Sistema de Matrícula",
    institution_cnpj: "00.000.000/0000-00",
    institution_phone: "(00) 0000-0000",
    footer_description: "Educação online de qualidade para impulsionar sua carreira.",
    social_facebook: "https://facebook.com",
    social_instagram: "https://instagram.com",
    social_linkedin: "https://linkedin.com",
    contact_email: "contato@infomar.com",
    dpo_email: "dpo@infomar.com",
    business_hours: "Seg-Sex: 9h às 18h"
  };

  return (
    <footer className="bg-muted/30 border-t mt-auto">
      <div className="container py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Column 1: Logo + Description */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center space-x-2 group">
              <GraduationCap className="h-6 w-6 text-primary transition-transform group-hover:scale-110" />
              <span className="font-bold text-lg">{footerData.institution_name}</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              {footerData.footer_description}
            </p>
            <div className="flex space-x-3">
              {footerData.social_facebook && (
                <a 
                  href={footerData.social_facebook} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4 text-primary" />
                </a>
              )}
              {footerData.social_instagram && (
                <a 
                  href={footerData.social_instagram} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4 text-primary" />
                </a>
              )}
              {footerData.social_linkedin && (
                <a 
                  href={footerData.social_linkedin} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-4 w-4 text-primary" />
                </a>
              )}
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Navegação</h3>
            <ul className="space-y-2.5">
              <li>
                <Link 
                  to="/courses" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Cursos Disponíveis
                </Link>
              </li>
              <li>
                <Link 
                  to="/verify-certificate" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Verificar Certificado
                </Link>
              </li>
              <li>
                <Link 
                  to="/auth" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Fazer Login
                </Link>
              </li>
              <li>
                <Link 
                  to="/student" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Área do Aluno
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Legal</h3>
            <ul className="space-y-2.5">
              <li>
                <Link 
                  to="/privacy-policy" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link 
                  to="/terms-of-use" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link 
                  to="/privacy-policy#lgpd" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  LGPD e Proteção de Dados
                </Link>
              </li>
              <li>
                <Link 
                  to="/privacy-policy#cookies" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Política de Cookies
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Contato</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center space-x-2">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span>{footerData.contact_email}</span>
              </li>
              <li className="flex items-center space-x-2">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span>{footerData.dpo_email} (LGPD)</span>
              </li>
              <li className="flex items-center space-x-2">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>{footerData.institution_phone}</span>
              </li>
              <li className="flex items-center space-x-2">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>{footerData.business_hours}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {footerData.institution_name}. Todos os direitos reservados.</p>
          <p className="mt-2">CNPJ: {footerData.institution_cnpj}</p>
        </div>
      </div>
    </footer>
  );
};
