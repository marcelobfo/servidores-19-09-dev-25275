import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Sparkles, FileText, Clock, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ModuleEditor from "@/components/admin/ModuleEditor";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { FilterBar } from "@/components/admin/filters/FilterBar";
import { SearchInput } from "@/components/admin/filters/SearchInput";
import { StatusFilter } from "@/components/admin/filters/StatusFilter";
import { AreaFilter } from "@/components/admin/filters/AreaFilter";
import { PeriodFilter } from "@/components/admin/filters/PeriodFilter";
import { CourseImageGenerator } from "@/components/admin/CourseImageGenerator";
interface Course {
  id: string;
  name: string;
  subtitle?: string;
  asaas_title?: string;
  slug: string;
  description: string;
  brief_description: string;
  modules: string;
  image_url: string;
  area_id: string;
  duration_hours: number;
  start_date: string;
  end_date: string;
  duration_days?: number | null;
  pre_enrollment_fee?: number | null;
  enrollment_fee?: number | null;
  discounted_enrollment_fee?: number | null;
  published: boolean;
  areas?: { name: string };
}

interface Area {
  id: string;
  name: string;
}

type ModuleItem = { name: string; hours: number };

const CoursesPage = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [autoGenerateCover, setAutoGenerateCover] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState("all");
  const [publishedFilter, setPublishedFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  
  const { toast } = useToast();

const [formData, setFormData] = useState({
  name: "",
  subtitle: "",
  asaas_title: "Licenca Capacitacao",
  slug: "",
  description: "",
  brief_description: "",
  image_url: "",
  area_id: "",
  duration_hours: 0,
  duration_days: 30,
  pre_enrollment_fee: 0,
  enrollment_fee: 0,
  discounted_enrollment_fee: 0,
  published: false
});

const [modules, setModules] = useState<ModuleItem[]>([{ name: "", hours: 0 }]);

useEffect(() => {
  const total = modules.reduce((sum, m) => sum + (Number(m.hours) || 0), 0);
  setFormData(prev => ({ ...prev, duration_hours: total }));
}, [modules]);

// Calcular taxas automaticamente baseado em duration_days
useEffect(() => {
  const calculateFees = (days: number) => {
    const fees = {
      15: { enrollment: 267.00, preEnrollment: 57.00 },
      30: { enrollment: 294.00, preEnrollment: 57.00 },
      45: { enrollment: 367.00, preEnrollment: 57.00 },
      60: { enrollment: 437.00, preEnrollment: 57.00 },
      90: { enrollment: 597.00, preEnrollment: 57.00 }
    };
    return fees[days as keyof typeof fees] || { enrollment: 0, preEnrollment: 57.00 };
  };
  
  const fees = calculateFees(formData.duration_days);
  const discountedFee = Math.max(fees.enrollment - fees.preEnrollment, 5);
  
  setFormData(prev => ({
    ...prev,
    enrollment_fee: fees.enrollment,
    pre_enrollment_fee: fees.preEnrollment,
    discounted_enrollment_fee: discountedFee
  }));
}, [formData.duration_days]);

// Recalcular discounted_enrollment_fee quando mudar enrollment_fee ou pre_enrollment_fee manualmente
useEffect(() => {
  const discountedFee = Math.max(formData.enrollment_fee - formData.pre_enrollment_fee, 5);
  if (formData.discounted_enrollment_fee !== discountedFee) {
    setFormData(prev => ({
      ...prev,
      discounted_enrollment_fee: discountedFee
    }));
  }
}, [formData.enrollment_fee, formData.pre_enrollment_fee]);

useEffect(() => {
  fetchCourses();
  fetchAreas();
}, []);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          areas (name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar cursos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAreas = async () => {
    try {
      const { data, error } = await supabase
        .from("areas")
        .select("*")
        .order("name");

      if (error) throw error;
      setAreas(data || []);
    } catch (error) {
      console.error("Error fetching areas:", error);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  };

  const generateAsaasTitle = (courseName: string): string => {
    return courseName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove caracteres especiais
      .trim()
      .substring(0, 30); // Limita a 30 caracteres para Asaas
  };

  const handleGenerateAsaasTitle = () => {
    // Sempre usar "Licenca Capacitacao" para todos os cursos
    setFormData({ 
      ...formData, 
      asaas_title: 'Licenca Capacitacao' 
    });
    toast({
      title: "Título definido",
      description: "Título Asaas: Licenca Capacitacao",
    });
  };

  const generateCourseImage = async (courseName: string, areaName?: string, description?: string) => {
    try {
      // Verificar se a API key está configurada
      const { data: settings } = await supabase
        .from('system_settings')
        .select('gemini_api_key')
        .single();

      if (!settings?.gemini_api_key) {
        toast({
          title: "API Key não configurada",
          description: "Configure a chave do Google AI Studio nas Configurações do Sistema.",
          variant: "destructive",
        });
        return null;
      }

      setIsGenerating(true);
      
      toast({
        title: "Gerando capa com IA...",
        description: "Aguarde enquanto a imagem é criada.",
      });

      const { data, error } = await supabase.functions.invoke('generate-course-image-v2', {
        body: { courseName, areaName, description }
      });
      
      if (error) {
        console.error('Error invoking function:', error);
        throw new Error(error.message || 'Erro ao chamar função de geração');
      }
      
      if (!data?.imageUrl) {
        throw new Error(data?.error || 'Nenhuma imagem foi retornada pela função');
      }
      
      // Converter base64 para blob e fazer upload
      const base64Data = data.imageUrl.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      
      const fileName = `course-cover-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, blob);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Erro ao gerar capa:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao gerar capa automaticamente",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let finalImageUrl = formData.image_url;
      
      // Se o toggle está ativado e não há imagem, gerar automaticamente
      if (autoGenerateCover && !finalImageUrl && formData.name) {
        toast({
          title: "Gerando capa com IA...",
          description: "Por favor, aguarde.",
        });
        
        const areaName = areas.find(a => a.id === formData.area_id)?.name;
        const cleanDescription = formData.brief_description.replace(/<[^>]*>/g, '');
        finalImageUrl = await generateCourseImage(
          formData.name,
          areaName,
          cleanDescription
        );
        
        if (finalImageUrl) {
          toast({
            title: "Capa gerada!",
            description: "A capa foi gerada automaticamente com IA.",
          });
        }
      }

      const courseDataWithDays = {
        ...formData,
        asaas_title: 'Licenca Capacitacao', // Força o valor correto sempre
        image_url: finalImageUrl || formData.image_url,
        slug: generateSlug(formData.name),
        area_id: formData.area_id || null,
        modules: JSON.stringify(modules),
      } as any;

      const saveWithFallback = async () => {
        if (editingCourse) {
          const { error } = await supabase
            .from("courses")
            .update(courseDataWithDays)
            .eq("id", editingCourse.id);
          if (error) throw error;
          toast({ title: "Sucesso", description: "Curso atualizado com sucesso!" });
        } else {
          const { error } = await supabase
            .from("courses")
            .insert([courseDataWithDays]);
          if (error) throw error;
          toast({ title: "Sucesso", description: "Curso criado com sucesso!" });
        }
      };

      try {
        await saveWithFallback();
      } catch (err: any) {
        // If the column duration_days does not exist in DB, retry without it
        if (String(err?.message || err).toLowerCase().includes("duration_days")) {
          const { duration_days, ...withoutDays } = courseDataWithDays;
          if (editingCourse) {
            const { error } = await supabase
              .from("courses")
              .update(withoutDays)
              .eq("id", editingCourse.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("courses")
              .insert([withoutDays]);
            if (error) throw error;
          }
          toast({ title: "Aviso", description: "Campo de duração em dias não salvo (coluna ausente)." });
        } else {
          throw err;
        }
      }

      fetchCourses();
      resetForm();
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error("Falha ao salvar curso:", error);
      toast({
        title: "Erro",
        description: error?.message || "Falha ao salvar curso",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (course: Course) => {
setEditingCourse(course);
let parsedModules: ModuleItem[] = [];
try {
  const raw = course.modules ? JSON.parse(course.modules) : [];
  if (Array.isArray(raw)) {
    parsedModules = raw.map((m: any) => ({
      name: m.name ?? m.nome ?? m.title ?? "",
      hours: Number(m.hours ?? m.carga_horaria ?? m.cargaHoraria ?? 0) || 0,
    }));
  } else if (raw && Array.isArray((raw as any)["módulos"])) {
    parsedModules = (raw as any)["módulos"].map((m: any) => ({
      name: m.nome ?? "",
      hours: Number(m.carga_horaria ?? 0) || 0,
    }));
  }
} catch (e) {
  parsedModules = [];
}
if (parsedModules.length === 0) parsedModules = [{ name: "", hours: 0 }];
setModules(parsedModules);
const enrollmentFee = course.enrollment_fee || 0;
const preEnrollmentFee = course.pre_enrollment_fee || 0;
const discountedFee = course.discounted_enrollment_fee ?? Math.max(enrollmentFee - preEnrollmentFee, 5);

setFormData({
  name: course.name,
  subtitle: course.subtitle || "",
  asaas_title: "Licenca Capacitacao", // Sempre força o valor correto
  slug: course.slug,
  description: course.description || "",
  brief_description: course.brief_description || "",
  image_url: course.image_url || "",
  area_id: course.area_id || "",
  duration_hours: course.duration_hours || parsedModules.reduce((s, m) => s + (Number(m.hours) || 0), 0),
  duration_days: (course as any).duration_days ?? 30,
  pre_enrollment_fee: preEnrollmentFee,
  enrollment_fee: enrollmentFee,
  discounted_enrollment_fee: discountedFee,
  published: course.published
});
setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este curso?")) return;

    try {
      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Curso excluído com sucesso!" });
      fetchCourses();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao excluir curso",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
setFormData({
  name: "",
  subtitle: "",
  asaas_title: "Licenca Capacitacao",
  slug: "",
  description: "",
  brief_description: "",
  image_url: "",
  area_id: "",
  duration_hours: 0,
  duration_days: 30,
  pre_enrollment_fee: 0,
  enrollment_fee: 0,
  discounted_enrollment_fee: 0,
  published: false
});
setModules([{ name: "", hours: 0 }]);
setEditingCourse(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  const filteredCourses = courses.filter(course => {
    const matchesSearch = searchTerm === "" || 
      course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (course.brief_description || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesArea = selectedArea === "all" || course.area_id === selectedArea;
    
    const matchesPublished = publishedFilter === "all" || 
      (publishedFilter === "published" && course.published) ||
      (publishedFilter === "draft" && !course.published);
    
    const matchesPeriod = periodFilter === "all" || 
      String(course.duration_days) === periodFilter;
    
    return matchesSearch && matchesArea && matchesPublished && matchesPeriod;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedArea("all");
    setPublishedFilter("all");
    setPeriodFilter("all");
  };

  const statusOptions = [
    { value: "all", label: "Todos" },
    { value: "published", label: "Publicados" },
    { value: "draft", label: "Rascunhos" }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestão de Cursos</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setFullScreen(false); }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Curso
            </Button>
          </DialogTrigger>
<DialogContent className={fullScreen ? "w-[100vw] h-[100vh] max-w-none max-h-none p-4 md:p-6 overflow-y-auto" : "w-[95vw] max-w-[1000px] max-h-[90vh] overflow-y-auto"}>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>
                  {editingCourse ? "Editar Curso" : "Novo Curso"}
                </DialogTitle>
                <Button variant="outline" size="sm" onClick={() => setFullScreen((v) => !v)}>
                  {fullScreen ? "Janela" : "Tela cheia"}
                </Button>
              </div>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do Curso</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="subtitle">Subtítulo</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="Texto complementar do curso (opcional)"
                />
              </div>

              <div>
                <Label htmlFor="asaas_title">Título Asaas (interno)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="asaas_title"
                    value="Licenca Capacitacao"
                    disabled
                    className="bg-muted"
                  />
                  <span className="text-xs text-muted-foreground">
                    (fixo para todos os cursos)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Título usado apenas na API Asaas para pagamentos. O nome completo do curso é usado para certificados, documentos e no resto do sistema.
                </p>
              </div>

              <div>
                <Label htmlFor="area_id">Área</Label>
                <Select value={formData.area_id} onValueChange={(value) => setFormData({ ...formData, area_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma área" />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="brief_description">Descrição Breve</Label>
                <ReactQuill
                  theme="snow"
                  value={formData.brief_description}
                  onChange={(value) => setFormData({ ...formData, brief_description: value })}
                  style={{ height: '150px', marginBottom: '50px' }}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ 'background': [] }],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      [{ 'align': [] }],
                      ['link', 'blockquote'],
                      ['clean']
                    ]
                  }}
                  formats={[
                    'header', 'bold', 'italic', 'underline', 'strike',
                    'background', 'list', 'bullet', 'align', 'link', 'blockquote'
                  ]}
                  className="bg-background mb-4"
                />
              </div>

              <div>
                <Label htmlFor="description">Descrição Completa (Conteúdo Programático)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Este conteúdo será exibido na seção "Conteúdo Programático" do Plano de Estudos e outros documentos.
                </p>
                <ReactQuill
                  theme="snow"
                  value={formData.description}
                  onChange={(value) => setFormData({ ...formData, description: value })}
                  style={{ height: '200px', marginBottom: '50px' }}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                      [{ 'font': [] }],
                      [{ 'size': ['small', false, 'large', 'huge'] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ 'background': [] }],
                      [{ 'script': 'sub'}, { 'script': 'super' }],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
                      [{ 'direction': 'rtl' }, { 'align': [] }],
                      ['link', 'image', 'video', 'blockquote', 'code-block'],
                      ['clean']
                    ]
                  }}
                  formats={[
                    'header', 'font', 'size', 'bold', 'italic', 'underline', 'strike',
                    'background', 'script', 'list', 'bullet', 'indent', 'direction', 'align',
                    'link', 'image', 'video', 'blockquote', 'code-block'
                  ]}
                  className="bg-background mb-4"
                />
              </div>

<div>
  <Label>Módulos</Label>
  <ModuleEditor modules={modules} onChange={setModules} />
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>
    <Label htmlFor="duration_hours">Carga Horária (horas)</Label>
    <Input
      id="duration_hours"
      type="number"
      value={formData.duration_hours}
      readOnly
    />
  </div>

  <div>
    <Label htmlFor="duration_days">Duração (dias)</Label>
    <Select
      value={String(formData.duration_days)}
      onValueChange={(value) => setFormData({ ...formData, duration_days: parseInt(value) })}
    >
      <SelectTrigger id="duration_days">
        <SelectValue placeholder="Selecione a duração" />
      </SelectTrigger>
      <SelectContent className="z-50">
        {[15, 30, 45, 60, 90, 120].map((d) => (
          <SelectItem key={d} value={String(d)}>
            {d} dias
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
</div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="pre_enrollment_fee">Taxa Pré-Matrícula</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input
                      id="pre_enrollment_fee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.pre_enrollment_fee}
                      onChange={(e) => setFormData({ ...formData, pre_enrollment_fee: parseFloat(e.target.value) || 0 })}
                      placeholder="0,00"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="enrollment_fee">Taxa Matrícula</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input
                      id="enrollment_fee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.enrollment_fee}
                      onChange={(e) => setFormData({ ...formData, enrollment_fee: parseFloat(e.target.value) || 0 })}
                      placeholder="0,00"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="discounted_enrollment_fee">Taxa com Desconto (calculado)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input
                      id="discounted_enrollment_fee"
                      type="number"
                      step="0.01"
                      min="5"
                      value={formData.discounted_enrollment_fee}
                      onChange={(e) => setFormData({ ...formData, discounted_enrollment_fee: parseFloat(e.target.value) || 5 })}
                      placeholder="0,00"
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Matrícula - Pré-Matrícula (mín. R$ 5,00)
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto_generate">Gerar capa automaticamente com IA</Label>
                  <Switch
                    id="auto_generate"
                    checked={autoGenerateCover}
                    onCheckedChange={setAutoGenerateCover}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Se ativado, uma capa será gerada automaticamente ao salvar o curso (caso não haja imagem).
                </p>
              </div>

              <div>
                <Label htmlFor="image_url">URL da Imagem</Label>
                <div className="flex gap-2">
                  <Input
                    id="image_url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://..."
                  />
                  <Dialog open={isGeneratorOpen} onOpenChange={setIsGeneratorOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="icon" title="Gerar capa manualmente">
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Gerar Capa com IA</DialogTitle>
                      </DialogHeader>
                      <CourseImageGenerator
                        courseId={editingCourse?.id}
                        courseName={formData.name}
                        areaName={areas.find(a => a.id === formData.area_id)?.name}
                        description={formData.brief_description.replace(/<[^>]*>/g, '')}
                        onImageGenerated={(url) => {
                          setFormData({ ...formData, image_url: url });
                          setIsGeneratorOpen(false);
                        }}
                        onCancel={() => setIsGeneratorOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
                {formData.image_url && (
                  <div className="mt-2">
                    <img 
                      src={formData.image_url} 
                      alt="Preview" 
                      className="w-full h-32 object-cover rounded border"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="published"
                  checked={formData.published}
                  onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
                />
                <Label htmlFor="published">Publicado</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isGenerating}>
                  {isGenerating ? "Gerando capa..." : editingCourse ? "Atualizar" : "Criar"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isGenerating}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <FilterBar onClearFilters={clearFilters}>
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por nome ou descrição..."
          label="Buscar Cursos"
        />
        <AreaFilter
          value={selectedArea}
          onChange={setSelectedArea}
        />
        <PeriodFilter
          value={periodFilter}
          onChange={setPeriodFilter}
        />
        <StatusFilter
          value={publishedFilter}
          onChange={setPublishedFilter}
          options={statusOptions}
          label="Status de Publicação"
        />
      </FilterBar>

      <div className="mb-4 text-sm text-muted-foreground">
        Mostrando {filteredCourses.length} de {courses.length} cursos
      </div>

      <div className="space-y-4">
        {filteredCourses.map((course) => (
          <Card key={course.id} className="overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_auto] gap-0">
              {/* Imagem com overlay */}
              <div className="relative aspect-video md:aspect-auto md:h-full">
                <img 
                  src={course.image_url || "/placeholder.svg"} 
                  alt={course.name}
                  className="object-cover w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <Button 
                  variant="secondary" 
                  size="sm"
                  className="absolute bottom-3 left-3 gap-2"
                  onClick={() => handleEdit(course)}
                >
                  <FileText className="h-4 w-4" />
                  Gerenciar Conteúdo
                </Button>
              </div>

              {/* Informações do curso */}
              <CardContent className="p-6 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="line-clamp-2 text-xl">{course.name}</CardTitle>
                      {course.subtitle && (
                        <p className="text-sm text-muted-foreground mt-1">{course.subtitle}</p>
                      )}
                    </div>
                  </div>
                  
                  {course.areas?.name && (
                    <div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        {course.areas.name}
                      </span>
                    </div>
                  )}
                  
                  <div 
                    className="text-sm text-muted-foreground line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: course.brief_description || "" }}
                  />
                </div>

                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{course.duration_hours}h</span>
                  </div>
                  {course.duration_days && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{course.duration_days} dias</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      course.published 
                        ? 'bg-green-500/10 text-green-700 dark:text-green-400' 
                        : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                    }`}>
                      {course.published ? "Publicado" : "Rascunho"}
                    </span>
                  </div>
                </div>
              </CardContent>

              {/* Botões de ação */}
              <div className="flex md:flex-col gap-2 p-4 items-center md:items-start justify-center">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => handleEdit(course)}
                  title="Editar curso"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => handleDelete(course.id)}
                  title="Excluir curso"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CoursesPage;