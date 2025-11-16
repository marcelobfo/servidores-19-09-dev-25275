import { Link } from "react-router-dom";
import { GraduationCap, Facebook, Instagram, Linkedin, Mail, Phone } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-muted/30 border-t mt-auto">
      <div className="container py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Column 1: Logo + Description */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center space-x-2 group">
              <GraduationCap className="h-6 w-6 text-primary transition-transform group-hover:scale-110" />
              <span className="font-bold text-lg">Sistema de Matrícula</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Educação online de qualidade para impulsionar sua carreira e desenvolvimento profissional.
            </p>
            <div className="flex space-x-3">
              <a 
                href="https://facebook.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4 text-primary" />
              </a>
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4 text-primary" />
              </a>
              <a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4 text-primary" />
              </a>
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
            <ul className="space-y-2.5">
              <li>
                <a 
                  href="mailto:contato@infomar.com" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  contato@infomar.com
                </a>
              </li>
              <li>
                <a 
                  href="mailto:dpo@infomar.com" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  DPO: dpo@infomar.com
                </a>
              </li>
              <li>
                <a 
                  href="tel:+5500000000000" 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                >
                  <Phone className="h-4 w-4" />
                  (00) 0000-0000
                </a>
              </li>
              <li className="text-sm text-muted-foreground">
                Seg-Sex: 9h às 18h
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t space-y-2">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Infomar Cursos Livres. Todos os direitos reservados.
          </p>
          <p className="text-center text-xs text-muted-foreground">
            CNPJ: 00.000.000/0000-00
          </p>
        </div>
      </div>
    </footer>
  );
};
