import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { FileText, CheckCircle, XCircle, AlertCircle, Scale } from "lucide-react";

const TermsOfUse = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-12">
        {/* Header Section */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Scale className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Termos de Uso
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Leia atentamente os termos e condições para utilização da nossa plataforma de cursos online.
          </p>
          <p className="text-sm text-muted-foreground">
            Última atualização: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Alert Box */}
        <Card className="p-6 mb-8 border-primary/20 bg-primary/5">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">Aceitação dos Termos</h3>
              <p className="text-sm text-muted-foreground">
                Ao acessar e usar nossa plataforma, você concorda com estes Termos de Uso. 
                Se não concordar com algum item, por favor não utilize nossos serviços.
              </p>
            </div>
          </div>
        </Card>

        {/* Accordion Sections */}
        <Accordion type="single" collapsible className="space-y-4">
          {/* Introduction */}
          <AccordionItem value="intro" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-semibold">1. Definições e Aceitação</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>
                Estes Termos de Uso ("Termos") estabelecem as condições para uso da plataforma 
                <strong className="text-foreground"> Sistema de Matrícula Infomar</strong>, operada pela 
                <strong className="text-foreground"> Infomar Cursos Livres</strong>.
              </p>
              <div className="pl-4 border-l-2 border-primary/30 space-y-2">
                <p><strong>Plataforma:</strong> Sistema online de cursos e matrículas.</p>
                <p><strong>Usuário:</strong> Pessoa que acessa e utiliza a plataforma.</p>
                <p><strong>Serviços:</strong> Cursos, matrículas, certificados e funcionalidades oferecidas.</p>
                <p><strong>Conteúdo:</strong> Materiais educacionais, textos, vídeos, imagens e documentos.</p>
              </div>
              <p className="mt-4">
                Ao criar uma conta e utilizar nossos serviços, você declara ter lido, compreendido e 
                concordado com estes Termos e com nossa <a href="/privacy-policy" className="text-primary hover:underline">Política de Privacidade</a>.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Account */}
          <AccordionItem value="account" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="font-semibold">2. Cadastro e Conta de Usuário</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p><strong className="text-foreground">Requisitos de Cadastro:</strong></p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>Ser maior de 18 anos ou possuir autorização dos responsáveis legais</li>
                <li>Fornecer informações verdadeiras, precisas e atualizadas</li>
                <li>Manter a confidencialidade de suas credenciais de acesso</li>
                <li>Notificar imediatamente sobre uso não autorizado de sua conta</li>
              </ul>

              <p className="mt-4"><strong className="text-foreground">Responsabilidades do Usuário:</strong></p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>Você é responsável por todas as atividades realizadas em sua conta</li>
                <li>Não compartilhar sua conta com terceiros</li>
                <li>Atualizar suas informações cadastrais quando necessário</li>
                <li>Não criar múltiplas contas ou contas falsas</li>
              </ul>

              <p className="mt-4 bg-muted/30 p-3 rounded-lg text-sm">
                <strong>Importante:</strong> Podemos suspender ou encerrar contas que violem estes Termos, 
                forneçam informações falsas ou sejam usadas para atividades fraudulentas.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Services */}
          <AccordionItem value="services" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-semibold">3. Uso dos Serviços</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p><strong className="text-foreground">Licença de Uso:</strong></p>
              <p>
                Concedemos a você uma licença limitada, não exclusiva, intransferível e revogável para 
                acessar e usar nossa plataforma para fins educacionais pessoais.
              </p>

              <p className="mt-4"><strong className="text-foreground">Restrições de Uso:</strong></p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>Não reproduzir, distribuir ou vender conteúdo da plataforma</li>
                <li>Não fazer engenharia reversa ou tentar acessar código-fonte</li>
                <li>Não usar automação (bots, scripts) sem autorização</li>
                <li>Não interferir no funcionamento da plataforma</li>
                <li>Não carregar vírus, malware ou código malicioso</li>
                <li>Não violar direitos de propriedade intelectual</li>
                <li>Não usar a plataforma para fins ilegais ou não autorizados</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* Enrollment */}
          <AccordionItem value="enrollment" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="font-semibold">4. Matrículas e Pagamentos</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p><strong className="text-foreground">Processo de Matrícula:</strong></p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>Pré-matrículas estão sujeitas à aprovação administrativa</li>
                <li>A confirmação da matrícula ocorre após análise e pagamento (quando aplicável)</li>
                <li>Você receberá notificação por e-mail sobre o status da matrícula</li>
              </ul>

              <p className="mt-4"><strong className="text-foreground">Pagamentos:</strong></p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>Preços e formas de pagamento estão descritos na página do curso</li>
                <li>Pagamentos são processados por sistemas seguros de terceiros</li>
                <li>Não armazenamos dados completos de cartão de crédito</li>
                <li>Todos os valores estão em Reais (R$) e incluem impostos aplicáveis</li>
              </ul>

              <p className="mt-4"><strong className="text-foreground">Reembolsos e Cancelamentos:</strong></p>
              <p>
                Políticas de reembolso variam por curso e devem ser consultadas antes da matrícula. 
                Entre em contato com nosso suporte para solicitar cancelamento dentro do prazo estipulado.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Content */}
          <AccordionItem value="content" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-semibold">5. Propriedade Intelectual</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>
                Todo o conteúdo da plataforma (textos, gráficos, logos, ícones, imagens, vídeos, áudio, 
                software e compilação de dados) é propriedade da Infomar Cursos Livres ou de seus 
                licenciadores e está protegido por leis de direitos autorais.
              </p>

              <p className="mt-4"><strong className="text-foreground">Direitos do Usuário:</strong></p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>Acesso ao conteúdo do curso para fins de aprendizado pessoal</li>
                <li>Download de materiais apenas quando expressamente permitido</li>
                <li>Uso de certificados para comprovação de conclusão</li>
              </ul>

              <p className="mt-4 bg-muted/30 p-3 rounded-lg text-sm">
                <strong>Proibido:</strong> Copiar, modificar, distribuir, vender, alugar ou sublicenciar 
                qualquer conteúdo sem autorização prévia por escrito.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Certificates */}
          <AccordionItem value="certificates" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="font-semibold">6. Certificados</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p><strong className="text-foreground">Emissão de Certificados:</strong></p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>Certificados são emitidos após conclusão dos requisitos do curso</li>
                <li>Cada certificado possui código único de verificação</li>
                <li>Certificados são válidos e podem ser verificados em nosso sistema</li>
              </ul>

              <p className="mt-4"><strong className="text-foreground">Uso de Certificados:</strong></p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>Certificados são para fins de comprovação de conclusão de curso livre</li>
                <li>Não garantem reconhecimento por órgãos oficiais de educação</li>
                <li>Falsificação ou uso indevido de certificados pode resultar em ações legais</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* Prohibited */}
          <AccordionItem value="prohibited" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-primary" />
                <span className="font-semibold">7. Condutas Proibidas</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>É estritamente proibido:</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>Violar leis, regulamentos ou direitos de terceiros</li>
                <li>Publicar conteúdo ofensivo, discriminatório ou ilegal</li>
                <li>Assediar, ameaçar ou intimidar outros usuários</li>
                <li>Fazer spam ou enviar comunicações não solicitadas</li>
                <li>Tentar obter acesso não autorizado a sistemas ou dados</li>
                <li>Interferir no funcionamento da plataforma</li>
                <li>Criar contas falsas ou se passar por terceiros</li>
                <li>Usar a plataforma para fraude ou atividades comerciais não autorizadas</li>
              </ul>

              <p className="mt-4 bg-destructive/10 border border-destructive/20 p-3 rounded-lg text-sm">
                <strong>Consequências:</strong> Violações podem resultar em suspensão ou exclusão permanente 
                da conta, perda de acesso aos cursos e, quando aplicável, responsabilização legal.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Liability */}
          <AccordionItem value="liability" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Scale className="h-5 w-5 text-primary" />
                <span className="font-semibold">8. Limitações de Responsabilidade</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p><strong className="text-foreground">Isenções:</strong></p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>A plataforma é fornecida "como está" e "conforme disponível"</li>
                <li>Não garantimos funcionamento ininterrupto ou livre de erros</li>
                <li>Não nos responsabilizamos por danos indiretos ou consequenciais</li>
                <li>Não garantimos resultados específicos de aprendizado</li>
                <li>Não nos responsabilizamos por conteúdo de terceiros ou links externos</li>
              </ul>

              <p className="mt-4"><strong className="text-foreground">Manutenção e Atualizações:</strong></p>
              <p>
                Reservamos o direito de realizar manutenções, atualizações e modificações na plataforma 
                a qualquer momento, o que pode resultar em interrupções temporárias do serviço.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Changes */}
          <AccordionItem value="changes" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-primary" />
                <span className="font-semibold">9. Alterações nos Termos</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>
                Podemos modificar estes Termos de Uso a qualquer momento. Mudanças significativas serão 
                comunicadas com antecedência mínima de 10 dias através de notificação na plataforma ou por e-mail.
              </p>
              <p>
                Seu uso continuado da plataforma após alterações constitui aceitação dos novos Termos. 
                Se não concordar com as mudanças, você deve interromper o uso da plataforma.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Jurisdiction */}
          <AccordionItem value="jurisdiction" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Scale className="h-5 w-5 text-primary" />
                <span className="font-semibold">10. Lei Aplicável e Foro</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>
                Estes Termos são regidos pelas leis da República Federativa do Brasil, sem consideração a 
                conflitos de disposições legais.
              </p>
              <p>
                Qualquer disputa relacionada a estes Termos ou ao uso da plataforma será submetida ao 
                foro da comarca da sede da empresa, renunciando expressamente a qualquer outro, por mais 
                privilegiado que seja.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Contact */}
          <AccordionItem value="contact" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-semibold">11. Contato</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>Para dúvidas sobre estes Termos de Uso:</p>
              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                <p><strong className="text-foreground">Infomar Cursos Livres</strong></p>
                <p>E-mail: <a href="mailto:contato@infomar.com" className="text-primary hover:underline">contato@infomar.com</a></p>
                <p>Telefone: (00) 0000-0000</p>
                <p>CNPJ: 00.000.000/0000-00</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Final Note */}
        <Card className="p-6 mt-8 bg-muted/30">
          <p className="text-sm text-center text-muted-foreground">
            Ao utilizar nossa plataforma, você reconhece ter lido e concordado com estes Termos de Uso. 
            Se tiver dúvidas, entre em contato conosco antes de prosseguir.
          </p>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default TermsOfUse;
