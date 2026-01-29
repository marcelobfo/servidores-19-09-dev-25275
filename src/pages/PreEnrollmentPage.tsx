import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { Shield, User, Calendar, GraduationCap, DollarSign, FileText, Clock, Award, ArrowRight } from "lucide-react";
import { triggerEnrollmentWebhook } from "@/lib/webhookService";
import { DateOfBirthPicker } from "@/components/ui/date-of-birth-picker";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

interface Course {
  id: string;
  name: string;
  duration_hours: number;
  duration_days?: number;
}

interface CourseDetails extends Course {
  area_id?: string;
  pre_enrollment_fee?: number;
  areas?: {
    name: string;
  };
}

interface OrganType {
  id: string;
  name: string;
  hours_multiplier: number;
  is_federal: boolean;
}

const PreEnrollmentPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCourseDetails, setLoadingCourseDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [preEnrollmentId, setPreEnrollmentId] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [selectedCourseName, setSelectedCourseName] = useState<string>("");
  const [selectedCourseDetails, setSelectedCourseDetails] = useState<CourseDetails | null>(null);
  const [importing, setImporting] = useState(false);
  const [organTypes, setOrganTypes] = useState<OrganType[]>([]);
  const [selectedOrganType, setSelectedOrganType] = useState<OrganType | null>(null);

  const [formData, setFormData] = useState({
    course_id: searchParams.get("course") || "",
    full_name: "",
    email: user?.email || "",
    whatsapp: "",
    cpf: "",
    birth_date: "",
    organization: "",
    postal_code: "",
    address: "",
    address_number: "",
    complement: "",
    city: "",
    state: "",
    license_start_date: "",
    license_end_date: "",
    license_duration: "",
    additional_info: "",
    organ_type_id: "",
  });

  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);

  // Scroll to top quando a página carrega
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    fetchCourses();
    fetchOrganTypes();
  }, []);

  // Fetch full course details when course_id comes from URL
  useEffect(() => {
    const courseIdFromUrl = searchParams.get("course");
    if (courseIdFromUrl) {
      fetchCourseDetails(courseIdFromUrl);
    }
  }, [searchParams]);

  const fetchCourseDetails = async (courseId: string) => {
    setLoadingCourseDetails(true);
    try {
      const { data, error } = await supabase
        .from("courses")
        .select(
          `
          id,
          name,
          duration_hours,
          duration_days,
          pre_enrollment_fee,
          area_id,
          areas (
            name
          )
        `,
        )
        .eq("id", courseId)
        .eq("published", true)
        .single();

      if (error) {
        console.error("Error fetching course details:", error);
        toast({
          title: "Erro",
          description: "Curso não encontrado ou não está disponível",
          variant: "destructive",
        });
        return;
      }

      setSelectedCourseDetails(data);
      setSelectedCourseName(data.name);

      // Auto-select license duration based on course duration_days
      if (data.duration_days) {
        setFormData((prev) => ({
          ...prev,
          course_id: courseId,
          license_duration: data.duration_days.toString(),
        }));
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoadingCourseDetails(false);
    }
  };

  const fetchCourses = async () => {
    try {
      // Fetch published courses including duration_days only; do not derive from hours
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, duration_hours, duration_days")
        .eq("published", true)
        .order("name");

      if (error) throw error;

      // Keep as-is; we will only use duration_days for filtering
      setCourses((data || []) as any);
    } catch (error) {
      console.error("Error fetching courses:", error);
      setCourses([]);
    }
  };

  const fetchOrganTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("organ_types" as any)
        .select("*")
        .order("is_federal", { ascending: true })
        .order("name");

      if (error) throw error;
      const types = (data as unknown as OrganType[]) || [];
      setOrganTypes(types);

      // Set default to "Normal" type
      const normalType = types.find((t) => t.name === "Normal");
      if (normalType) {
        setSelectedOrganType(normalType);
        setFormData((prev) => ({ ...prev, organ_type_id: normalType.id }));
      }
    } catch (error) {
      console.error("Error fetching organ types:", error);
    }
  };

  const handleOrganTypeChange = (organTypeId: string) => {
    const organType = organTypes.find((t) => t.id === organTypeId);
    setSelectedOrganType(organType || null);
    setFormData((prev) => ({ ...prev, organ_type_id: organTypeId }));
  };

  // Calculate effective hours based on organ type multiplier
  const getEffectiveHours = (baseHours: number): number => {
    if (!selectedOrganType) return baseHours;
    return Math.round(baseHours * selectedOrganType.hours_multiplier);
  };
  // Calculate end date based on start date and duration
  const calculateEndDate = (startDate: string, duration: string) => {
    if (!startDate || !duration) return "";

    const start = new Date(startDate);
    const days = parseInt(duration);
    const end = new Date(start);
    end.setDate(start.getDate() + days - 1); // Subtract 1 because the start day counts

    return end.toISOString().split("T")[0];
  };

  // Filter courses based on selected duration
  useEffect(() => {
    if (formData.license_duration && courses.length > 0) {
      const duration = parseInt(formData.license_duration);
      const filtered = courses.filter((course) => {
        const courseDays = course.duration_days;
        return typeof courseDays === "number" && courseDays === duration;
      });
      setFilteredCourses(filtered);
    } else {
      setFilteredCourses([]);
    }
  }, [formData.license_duration, courses]);

  // Auto-calculate end date when start date or duration changes
  useEffect(() => {
    if (formData.license_start_date && formData.license_duration) {
      const endDate = calculateEndDate(formData.license_start_date, formData.license_duration);
      setFormData((prev) => ({ ...prev, license_end_date: endDate }));
    }
  }, [formData.license_start_date, formData.license_duration]);

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const formatWhatsApp = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d{1,4})/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");
  };

  const formatCEP = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{3})\d+?$/, "$1");
  };

  const importFromProfile = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user?.id).maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        toast({
          title: "Erro",
          description: "Erro ao buscar dados do perfil",
          variant: "destructive",
        });
        return;
      }

      if (!data) {
        toast({
          title: "Nenhum perfil encontrado",
          description: "Complete seu perfil primeiro para usar esta função",
          variant: "destructive",
        });
        return;
      }

      setFormData((prev) => ({
        ...prev,
        full_name: data.full_name || prev.full_name,
        email: data.email || prev.email,
        whatsapp: data.phone || prev.whatsapp,
        cpf: data.cpf || prev.cpf,
        birth_date: data.birth_date || prev.birth_date,
        postal_code: data.postal_code || prev.postal_code,
        address: data.address || prev.address,
        address_number: data.address_number || prev.address_number,
        complement: data.complement || prev.complement,
        city: data.city || prev.city,
        state: data.state || prev.state,
      }));

      toast({
        title: "Dados importados!",
        description: "Seus dados do perfil foram preenchidos automaticamente",
      });
    } catch (error) {
      console.error("Error importing from profile:", error);
      toast({
        title: "Erro",
        description: "Erro ao importar dados do perfil",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  // Insere diretamente no banco com refresh forçado do token
  const insertPreEnrollmentWithRetry = async (enrollmentData: any) => {
    try {
      // SEMPRE renovar sessão antes de inserir
      console.log("🔄 Renovando sessão antes da inserção...");
      const {
        data: { session },
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (refreshError || !session) {
        console.error("❌ Erro ao renovar sessão:", refreshError);
        throw new Error("Falha ao renovar sessão: " + refreshError?.message);
      }

      console.log("✅ Sessão renovada com sucesso");
      console.log("📋 Dados a inserir:", {
        user_id: enrollmentData.user_id,
        course_id: enrollmentData.course_id,
        full_name: enrollmentData.full_name,
        session_exists: !!session,
        token_preview: session?.access_token?.substring(0, 20) + "...",
      });

      // Aguardar 300ms para garantir que o token está ativo
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Inserir diretamente no banco
      console.log("💾 Inserindo pre_enrollment no banco...");
      const { data, error } = await supabase.from("pre_enrollments").insert([enrollmentData]).select().single();

      if (error) {
        console.error("❌ Erro ao inserir:", error);
        throw error;
      }

      console.log("✅ Pre-enrollment criado:", data.id);
      return data;
    } catch (error) {
      console.error("❌ Falha total ao criar pre-enrollment:", error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para fazer uma pré-matrícula",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // 1. Preparar os dados (mantendo sua lógica original)
      const enrollmentData = {
        user_id: user.id,
        course_id: formData.course_id,
        full_name: formData.full_name,
        email: formData.email,
        whatsapp: formData.whatsapp,
        cpf: formData.cpf,
        birth_date: formData.birth_date || null,
        organization: formData.organization,
        postal_code: formData.postal_code,
        address: formData.address,
        address_number: formData.address_number,
        complement: formData.complement,
        city: formData.city,
        state: formData.state,
        license_duration: formData.license_duration,
        license_start_date: formData.license_start_date,
        license_end_date: formData.license_end_date,
        additional_info: formData.additional_info,
        organ_type_id: formData.organ_type_id || null,
        custom_hours:
          selectedOrganType && selectedCourseDetails ? getEffectiveHours(selectedCourseDetails.duration_hours) : null,
      };

      // 2. CORREÇÃO VITAL: Primeiro salvamos no banco para garantir que temos o ID real
      console.log("Salvando dados no banco de dados...");
      const preEnrollmentData = await insertPreEnrollmentWithRetry(enrollmentData);

      // 3. Pegamos o ID gerado pelo banco para evitar o erro 500 na Edge Function
      const generatedId = preEnrollmentData.id;
      console.log("ID Gerado:", generatedId);

      // 4. Verificamos o curso novamente para garantir o valor da taxa
      const { data: course } = await supabase
        .from("courses")
        .select("name, pre_enrollment_fee")
        .eq("id", formData.course_id)
        .single();

      const preEnrollmentFee = course?.pre_enrollment_fee || 0;

      if (preEnrollmentFee > 0) {
        // Atualizamos o status para pendente de pagamento
        await supabase.from("pre_enrollments").update({ status: "pending_payment" }).eq("id", generatedId);

        // DISPARAMOS O MODAL com o ID CORRETO
        setPreEnrollmentId(generatedId); // Define o ID real vindo do banco
        setPaymentAmount(preEnrollmentFee);
        setSelectedCourseName(course?.name || "");
        setShowPaymentModal(true);

        // Webhook opcional
        await triggerEnrollmentWebhook(generatedId, "enrollment_created");
      } else {
        toast({
          title: "Sucesso",
          description: "Pré-matrícula enviada com sucesso!",
        });
        navigate("/student");
      }
    } catch (error: any) {
      console.error("Erro detalhado:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao processar matrícula.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    toast({
      title: "Pagamento confirmado!",
      description: "Sua pré-matrícula foi registrada e está sendo processada.",
    });
    navigate("/student/pre-enrollments");
  };

  const durationOptions = [
    { value: "120", label: "120 dias" },
    { value: "90", label: "90 dias" },
    { value: "60", label: "60 dias" },
    { value: "45", label: "45 dias" },
    { value: "30", label: "30 dias" },
    { value: "15", label: "15 dias" },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-center">FORMULÁRIO DE ANTECIPAÇÃO DE MATRÍCULA – LICENÇA CAPACITAÇÃO</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* CURSO SELECIONADO */}
            {selectedCourseDetails && (
              <Card className="border-primary bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs">
                            {selectedCourseDetails.areas?.name || "Curso"}
                          </Badge>
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-3">{selectedCourseDetails.name}</h3>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>
                              {selectedOrganType && selectedOrganType.hours_multiplier !== 1 ? (
                                <>
                                  <span className="line-through text-muted-foreground/50">
                                    {selectedCourseDetails.duration_hours}h
                                  </span>
                                  {" → "}
                                  <span className="font-semibold text-primary">
                                    {getEffectiveHours(selectedCourseDetails.duration_hours)}h
                                  </span>
                                  <span className="ml-1 text-xs">
                                    ({Math.round(selectedOrganType.hours_multiplier * 100)}%)
                                  </span>
                                </>
                              ) : (
                                <>{selectedCourseDetails.duration_hours}h de carga horária</>
                              )}
                            </span>
                          </div>
                          {selectedCourseDetails.duration_days && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{selectedCourseDetails.duration_days} dias</span>
                            </div>
                          )}
                          {selectedOrganType && selectedOrganType.is_federal && (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            >
                              <Building2 className="h-3 w-3 mr-1" />
                              {selectedOrganType.name}
                            </Badge>
                          )}
                          {selectedCourseDetails.pre_enrollment_fee && selectedCourseDetails.pre_enrollment_fee > 0 && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              <span>Taxa: R$ {selectedCourseDetails.pre_enrollment_fee.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => navigate("/courses")}>
                        Trocar curso
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {loadingCourseDetails && (
              <Alert>
                <AlertDescription>Carregando informações do curso...</AlertDescription>
              </Alert>
            )}

            {/* SEÇÃO 1 - AVISO DE PRIVACIDADE */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Shield className="h-5 w-5" />
                  🔒 Aviso de Privacidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertDescription>
                    <strong>Antes de prosseguir, leia atentamente:</strong>
                    <br />
                    <br />
                    Respeitamos a sua privacidade conforme a Lei Geral de Proteção de Dados (13.709/2018)
                    <br />
                    Os dados coletados serão usados exclusivamente para emissão de documentos para licença capacitação.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* BOTÃO DE IMPORTAR DO PERFIL */}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={importFromProfile}
                disabled={importing || !user}
                className="flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    Importando...
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4" />
                    Preencher com dados do perfil
                  </>
                )}
              </Button>
            </div>

            {/* SEÇÃO 1 - DADOS PESSOAIS */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  📌 SEÇÃO 1 – DADOS PESSOAIS
                </CardTitle>
                <CardDescription>Campos obrigatórios (*)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="full_name">Nome completo *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="organization">Instituição onde trabalha *</Label>
                  <Input
                    id="organization"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="cpf">CPF (formato 000.000.000-00) *</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="birth_date">Data de Nascimento *</Label>
                    <DateOfBirthPicker
                      value={formData.birth_date ? new Date(formData.birth_date) : undefined}
                      onChange={(date) =>
                        setFormData({ ...formData, birth_date: date ? date.toISOString().split("T")[0] : "" })
                      }
                      placeholder="Selecione sua data de nascimento"
                    />
                  </div>

                  <div>
                    <Label htmlFor="whatsapp">WhatsApp (formato (xx) xxxxx-xxxx) *</Label>
                    <Input
                      id="whatsapp"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: formatWhatsApp(e.target.value) })}
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="postal_code">CEP *</Label>
                    <Input
                      id="postal_code"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: formatCEP(e.target.value) })}
                      placeholder="00000-000"
                      maxLength={9}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="state">Estado *</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) => setFormData({ ...formData, state: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="AC">Acre</SelectItem>
                        <SelectItem value="AL">Alagoas</SelectItem>
                        <SelectItem value="AP">Amapá</SelectItem>
                        <SelectItem value="AM">Amazonas</SelectItem>
                        <SelectItem value="BA">Bahia</SelectItem>
                        <SelectItem value="CE">Ceará</SelectItem>
                        <SelectItem value="DF">Distrito Federal</SelectItem>
                        <SelectItem value="ES">Espírito Santo</SelectItem>
                        <SelectItem value="GO">Goiás</SelectItem>
                        <SelectItem value="MA">Maranhão</SelectItem>
                        <SelectItem value="MT">Mato Grosso</SelectItem>
                        <SelectItem value="MS">Mato Grosso do Sul</SelectItem>
                        <SelectItem value="MG">Minas Gerais</SelectItem>
                        <SelectItem value="PA">Pará</SelectItem>
                        <SelectItem value="PB">Paraíba</SelectItem>
                        <SelectItem value="PR">Paraná</SelectItem>
                        <SelectItem value="PE">Pernambuco</SelectItem>
                        <SelectItem value="PI">Piauí</SelectItem>
                        <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                        <SelectItem value="RN">Rio Grande do Norte</SelectItem>
                        <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                        <SelectItem value="RO">Rondônia</SelectItem>
                        <SelectItem value="RR">Roraima</SelectItem>
                        <SelectItem value="SC">Santa Catarina</SelectItem>
                        <SelectItem value="SP">São Paulo</SelectItem>
                        <SelectItem value="SE">Sergipe</SelectItem>
                        <SelectItem value="TO">Tocantins</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="address">Endereço/Rua *</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Rua, Avenida, etc."
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="address_number">Número *</Label>
                    <Input
                      id="address_number"
                      value={formData.address_number}
                      onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                      placeholder="123"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="complement">Complemento</Label>
                    <Input
                      id="complement"
                      value={formData.complement}
                      onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                      placeholder="Apto, Sala, etc. (opcional)"
                    />
                  </div>

                  <div>
                    <Label htmlFor="city">Cidade *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Nome da cidade"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SEÇÃO 2 - PERÍODO DA LICENÇA */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  📆 SEÇÃO 2 – PERÍODO DA LICENÇA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="license_start_date">Data de início da licença (formato 00/00/0000) *</Label>
                    <Input
                      id="license_start_date"
                      type="date"
                      value={formData.license_start_date}
                      onChange={(e) => setFormData({ ...formData, license_start_date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="license_end_date">Data de término da licença (calculado automaticamente)</Label>
                    <Input
                      id="license_end_date"
                      type="date"
                      value={formData.license_end_date}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div>
                  <Label>Quantos dias de duração? *</Label>
                  <RadioGroup
                    value={formData.license_duration}
                    onValueChange={(value) => setFormData({ ...formData, license_duration: value, course_id: "" })}
                    className="mt-2"
                  >
                    {durationOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`duration-${option.value}`} />
                        <Label htmlFor={`duration-${option.value}`}>{option.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            {/* SEÇÃO 3 - ESCOLHA DO CURSO */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  🎓 SEÇÃO 3 – ESCOLHA DO CURSO
                </CardTitle>
                <CardDescription>
                  Selecione o curso compatível com a duração da sua licença
                  {formData.license_duration && ` (${formData.license_duration} dias)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!formData.license_duration ? (
                  <Alert>
                    <AlertDescription>
                      Primeiro selecione a duração da licença na seção anterior para ver os cursos disponíveis.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div>
                    <Label htmlFor="course_id">
                      Cursos de {formData.license_duration} dias ({filteredCourses.length} opções) *
                    </Label>
                    <Select
                      value={formData.course_id}
                      onValueChange={(value) => setFormData({ ...formData, course_id: value })}
                      disabled={!!selectedCourseDetails}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={selectedCourseDetails ? selectedCourseDetails.name : "Selecione um curso"}
                        />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        {filteredCourses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.name} ({course.duration_hours}h)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedCourseDetails && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Curso pré-selecionado. Use o botão "Trocar curso" acima para mudar.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SEÇÃO 4 - TIPO DE ÓRGÃO */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  🏛️ SEÇÃO 4 – TIPO DE ÓRGÃO
                </CardTitle>
                <CardDescription>
                  Selecione o tipo de órgão onde você trabalha. Órgãos federais possuem carga horária diferenciada.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="organ_type_id">Tipo de Órgão *</Label>
                  <Select value={formData.organ_type_id} onValueChange={handleOrganTypeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de órgão" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {organTypes.map((organType) => (
                        <SelectItem key={organType.id} value={organType.id}>
                          {organType.name}{" "}
                          {organType.is_federal &&
                            `(${Math.round(organType.hours_multiplier * 100)}% da carga horária)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedOrganType && selectedOrganType.is_federal && selectedCourseDetails && (
                  <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                      <strong>Carga horária ajustada para órgão federal:</strong>
                      <br />
                      {selectedCourseDetails.duration_hours}h × {Math.round(selectedOrganType.hours_multiplier * 100)}%
                      =<strong className="ml-1">{getEffectiveHours(selectedCourseDetails.duration_hours)}h</strong>
                      <br />
                      <span className="text-sm">
                        Esta carga horária será exibida em todos os documentos (certificado, declaração, plano de
                        estudos).
                      </span>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* SEÇÃO 5 - PAGAMENTO */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  💵 SEÇÃO 5 – PAGAMENTO
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertDescription>
                    <strong>A taxa de matrícula deve ser paga pelo link:</strong> Taxa de Matrícula
                    <br />
                    Envie o comprovante de pagamento via WhatsApp para receber os documentos.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* SEÇÃO 6 - ORIENTAÇÕES FINAIS */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  📄 SEÇÃO 6 – ORIENTAÇÕES FINAIS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>• A licença pode ser dividida em até 6 períodos.</p>
                  <p>• Nenhuma parcela pode ser inferior a 15 dias.</p>
                  <p>• Deve haver intervalo de 60 dias entre licenças e outros afastamentos.</p>
                  <p>• Períodos não são acumuláveis entre quinquênios.</p>
                  <p>• Desistência ou abandono implica ressarcimento.</p>
                  <p>• Pode ser interrompida por solicitação ou por interesse da administração.</p>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label htmlFor="additional_info">Informações Adicionais</Label>
              <Textarea
                id="additional_info"
                value={formData.additional_info}
                onChange={(e) => setFormData({ ...formData, additional_info: e.target.value })}
                placeholder="Adicione qualquer informação relevante sobre sua solicitação"
                rows={3}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? "Enviando..." : "Enviar Pré-Matrícula"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/courses")}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        preEnrollmentId={preEnrollmentId}
        courseName={selectedCourseName}
        amount={paymentAmount}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default PreEnrollmentPage;
