import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Database, Lock, Eye, Download, Trash2, FileText, AlertCircle } from "lucide-react";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-12">
        {/* Header Section */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Política de Privacidade
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Sua privacidade é importante para nós. Conheça como coletamos, usamos e protegemos seus dados pessoais.
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
              <h3 className="font-semibold text-sm">Compromisso com a LGPD</h3>
              <p className="text-sm text-muted-foreground">
                Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018). 
                Respeitamos seus direitos e garantimos transparência no tratamento de dados pessoais.
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
                <span className="font-semibold">1. Introdução e Definições</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>
                Bem-vindo à nossa Política de Privacidade. Este documento explica como a <strong>Infomar Cursos Livres</strong> 
                ("nós", "nosso" ou "empresa") coleta, usa, armazena e protege seus dados pessoais.
              </p>
              <div className="pl-4 border-l-2 border-primary/30 space-y-2">
                <p><strong>Dados Pessoais:</strong> Informações relacionadas a pessoa natural identificada ou identificável.</p>
                <p><strong>Titular:</strong> Pessoa natural a quem se referem os dados pessoais.</p>
                <p><strong>Tratamento:</strong> Toda operação realizada com dados pessoais (coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação ou controle da informação, modificação, comunicação, transferência, difusão ou extração).</p>
                <p><strong>Controlador:</strong> A Infomar Cursos Livres é a responsável pelas decisões sobre o tratamento de dados pessoais.</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Data Collected */}
          <AccordionItem value="data" className="border rounded-lg px-6" id="data-collected">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <span className="font-semibold">2. Dados Coletados</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-4">
              <p>Coletamos as seguintes categorias de dados:</p>
              
              <div className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="font-semibold text-foreground mb-2">Dados de Cadastro</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Nome completo</li>
                    <li>E-mail</li>
                    <li>CPF</li>
                    <li>Telefone</li>
                    <li>Data de nascimento</li>
                    <li>Endereço (quando aplicável)</li>
                  </ul>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="font-semibold text-foreground mb-2">Dados de Navegação</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Endereço IP</li>
                    <li>Tipo de navegador</li>
                    <li>Páginas visitadas</li>
                    <li>Tempo de permanência</li>
                    <li>Dispositivo utilizado</li>
                    <li>Cookies (conforme Política de Cookies)</li>
                  </ul>
                </div>

                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="font-semibold text-foreground mb-2">Dados de Uso dos Serviços</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Cursos acessados e matriculados</li>
                    <li>Progresso e desempenho</li>
                    <li>Certificados emitidos</li>
                    <li>Histórico de matrículas</li>
                    <li>Documentos enviados</li>
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Purpose */}
          <AccordionItem value="purpose" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-primary" />
                <span className="font-semibold">3. Finalidades do Tratamento</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>Utilizamos seus dados para as seguintes finalidades:</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Prestação de serviços educacionais:</strong> Gerenciar matrículas, oferecer cursos e acompanhar progresso</li>
                <li><strong>Emissão de certificados:</strong> Gerar e validar certificados de conclusão</li>
                <li><strong>Comunicação:</strong> Enviar notificações, atualizações sobre cursos e suporte técnico</li>
                <li><strong>Melhorias no sistema:</strong> Analisar uso para aprimorar funcionalidades</li>
                <li><strong>Cumprimento legal:</strong> Atender obrigações legais e regulatórias</li>
                <li><strong>Segurança:</strong> Prevenir fraudes e proteger direitos</li>
                <li><strong>Marketing (com consentimento):</strong> Enviar ofertas e conteúdos personalizados</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* Legal Basis */}
          <AccordionItem value="legal" className="border rounded-lg px-6" id="lgpd">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-semibold">4. Base Legal (LGPD Art. 7º)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>Fundamentamos o tratamento de dados nas seguintes bases legais:</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Consentimento (Art. 7º, I):</strong> Para envio de comunicações de marketing e uso de cookies não essenciais</li>
                <li><strong>Execução de contrato (Art. 7º, V):</strong> Para prestação dos serviços educacionais contratados</li>
                <li><strong>Cumprimento de obrigação legal (Art. 7º, II):</strong> Para atender exigências legais e regulatórias</li>
                <li><strong>Legítimo interesse (Art. 7º, IX):</strong> Para melhorias no sistema e segurança</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* Sharing */}
          <AccordionItem value="sharing" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <span className="font-semibold">5. Compartilhamento de Dados</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p className="font-semibold text-foreground">Não vendemos seus dados pessoais.</p>
              <p>Compartilhamos dados apenas quando necessário:</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Prestadores de serviços:</strong> Empresas que nos auxiliam na operação (hospedagem, e-mail, pagamentos)</li>
                <li><strong>Autoridades:</strong> Quando exigido por lei ou ordem judicial</li>
                <li><strong>Parceiros educacionais:</strong> Com seu consentimento explícito</li>
              </ul>
              <p className="mt-4">
                <strong>Transferência Internacional:</strong> Alguns de nossos prestadores podem estar localizados fora do Brasil. 
                Garantimos que essas transferências seguem as exigências da LGPD.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Rights */}
          <AccordionItem value="rights" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-semibold">6. Seus Direitos (LGPD Art. 18)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-4">
              <p>Como titular de dados, você possui os seguintes direitos:</p>
              
              <div className="grid gap-3">
                <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-lg">
                  <Eye className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Confirmação e Acesso</p>
                    <p className="text-sm">Confirmar se tratamos seus dados e acessá-los</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-lg">
                  <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Correção</p>
                    <p className="text-sm">Solicitar correção de dados incompletos, inexatos ou desatualizados</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-lg">
                  <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Anonimização ou Bloqueio</p>
                    <p className="text-sm">Solicitar anonimização ou bloqueio de dados desnecessários ou excessivos</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-lg">
                  <Trash2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Eliminação</p>
                    <p className="text-sm">Solicitar eliminação de dados tratados com seu consentimento</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-lg">
                  <Download className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Portabilidade</p>
                    <p className="text-sm">Solicitar portabilidade dos dados para outro fornecedor</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-lg">
                  <Database className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Informação sobre Compartilhamento</p>
                    <p className="text-sm">Conhecer entidades com as quais compartilhamos seus dados</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">Revogação do Consentimento</p>
                    <p className="text-sm">Revogar consentimento a qualquer momento</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm font-semibold text-foreground mb-2">Como exercer seus direitos:</p>
                <p className="text-sm">
                  Entre em contato através do e-mail <a href="mailto:dpo@infomar.com" className="text-primary hover:underline">dpo@infomar.com</a> ou 
                  pela área do aluno. Responderemos sua solicitação em até 15 dias.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Security */}
          <AccordionItem value="security" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-primary" />
                <span className="font-semibold">7. Segurança dos Dados</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>Implementamos medidas técnicas e administrativas para proteger seus dados:</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>Criptografia de dados em trânsito e em repouso (SSL/TLS)</li>
                <li>Controle de acesso baseado em funções</li>
                <li>Monitoramento contínuo de segurança</li>
                <li>Backups regulares</li>
                <li>Treinamento de equipe em proteção de dados</li>
                <li>Auditorias periódicas de segurança</li>
              </ul>
              <p className="mt-4 text-sm bg-muted/30 p-3 rounded-lg">
                <strong>Importante:</strong> Apesar de nossos esforços, nenhum sistema é 100% seguro. 
                Caso ocorra um incidente de segurança, notificaremos você e a ANPD conforme exigido pela LGPD.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Retention */}
          <AccordionItem value="retention" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <span className="font-semibold">8. Retenção de Dados</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>Mantemos seus dados pelo tempo necessário para:</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>Cumprir as finalidades para as quais foram coletados</li>
                <li>Atender obrigações legais (ex: registros fiscais por 5 anos)</li>
                <li>Resolver disputas e fazer cumprir acordos</li>
              </ul>
              <p className="mt-4">
                Após o término do período de retenção, os dados serão excluídos ou anonimizados de forma segura.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Cookies */}
          <AccordionItem value="cookies" className="border rounded-lg px-6" id="cookies">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-semibold">9. Política de Cookies</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>Utilizamos cookies e tecnologias similares para:</p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong>Cookies Essenciais:</strong> Necessários para funcionamento básico (login, segurança)</li>
                <li><strong>Cookies de Analytics:</strong> Entender como você usa o site</li>
                <li><strong>Cookies de Marketing:</strong> Personalizar anúncios (com seu consentimento)</li>
              </ul>
              <p className="mt-4">
                Você pode gerenciar suas preferências de cookies a qualquer momento através do banner de cookies ou 
                configurações do navegador.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Contact */}
          <AccordionItem value="contact" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-semibold">10. Contato e DPO</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>Para questões sobre privacidade e proteção de dados:</p>
              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                <p><strong className="text-foreground">Encarregado de Dados (DPO):</strong></p>
                <p>E-mail: <a href="mailto:dpo@infomar.com" className="text-primary hover:underline">dpo@infomar.com</a></p>
                <p>E-mail geral: <a href="mailto:contato@infomar.com" className="text-primary hover:underline">contato@infomar.com</a></p>
                <p>Telefone: (00) 0000-0000</p>
                <p className="text-sm">Prazo de resposta: até 15 dias úteis</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Changes */}
          <AccordionItem value="changes" className="border rounded-lg px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-primary" />
                <span className="font-semibold">11. Alterações na Política</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 text-muted-foreground space-y-3">
              <p>
                Podemos atualizar esta Política de Privacidade periodicamente. Mudanças significativas serão comunicadas 
                através de e-mail ou notificação no site com pelo menos 10 dias de antecedência.
              </p>
              <p>
                Recomendamos revisar esta política regularmente. O uso continuado dos serviços após alterações 
                constitui aceitação das mudanças.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Action Buttons */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" size="lg" className="gap-2">
            <Download className="h-4 w-4" />
            Baixar Meus Dados
          </Button>
          <Button variant="outline" size="lg" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Solicitar Exclusão de Dados
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
