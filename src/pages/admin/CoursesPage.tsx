import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ModuleEditor from "@/components/admin/ModuleEditor";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { FilterBar } from "@/components/admin/filters/FilterBar";
import { SearchInput } from "@/components/admin/filters/SearchInput";
import { StatusFilter } from "@/components/admin/filters/StatusFilter";
import { AreaFilter } from "@/components/admin/filters/AreaFilter";
interface Course {
  id: string;
  name: string;
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
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState("all");
  const [publishedFilter, setPublishedFilter] = useState("all");
  
  const { toast } = useToast();

const [formData, setFormData] = useState({
  name: "",
  slug: "",
  description: "",
  brief_description: "",
  image_url: "",
  area_id: "",
  duration_hours: 0,
  duration_days: 30,
  pre_enrollment_fee: 0,
  enrollment_fee: 0,
  published: false
});

const [modules, setModules] = useState<ModuleItem[]>([{ name: "", hours: 0 }]);

useEffect(() => {
  const total = modules.reduce((sum, m) => sum + (Number(m.hours) || 0), 0);
  setFormData(prev => ({ ...prev, duration_hours: total }));
}, [modules]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const courseDataWithDays = {
        ...formData,
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
setFormData({
  name: course.name,
  slug: course.slug,
  description: course.description || "",
  brief_description: course.brief_description || "",
  image_url: course.image_url || "",
  area_id: course.area_id || "",
  duration_hours: course.duration_hours || parsedModules.reduce((s, m) => s + (Number(m.hours) || 0), 0),
  duration_days: (course as any).duration_days ?? 30,
  pre_enrollment_fee: course.pre_enrollment_fee || 0,
  enrollment_fee: course.enrollment_fee || 0,
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
  slug: "",
  description: "",
  brief_description: "",
  image_url: "",
  area_id: "",
  duration_hours: 0,
  duration_days: 30,
  pre_enrollment_fee: 0,
  enrollment_fee: 0,
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
    
    return matchesSearch && matchesArea && matchesPublished;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedArea("all");
    setPublishedFilter("all");
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
                      [{ 'color': [] }, { 'background': [] }],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      [{ 'align': [] }],
                      ['link', 'blockquote'],
                      ['clean']
                    ]
                  }}
                  className="bg-background mb-4"
                />
              </div>

              <div>
                <Label htmlFor="description">Descrição Completa</Label>
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
                      [{ 'color': [] }, { 'background': [] }],
                      [{ 'script': 'sub'}, { 'script': 'super' }],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
                      [{ 'direction': 'rtl' }, { 'align': [] }],
                      ['link', 'image', 'video', 'blockquote', 'code-block'],
                      ['clean']
                    ]
                  }}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              <div>
                <Label htmlFor="image_url">URL da Imagem</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
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
                <Button type="submit">
                  {editingCourse ? "Atualizar" : "Criar"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
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

      <div className="grid gap-4">
        {filteredCourses.map((course) => (
    <Card key={course.id}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{course.name}</CardTitle>
            <CardDescription>
              {course.areas?.name} • {course.duration_hours}h
              {course.published ? " • Publicado" : " • Rascunho"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(course)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDelete(course.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{course.brief_description}</p>
        {course.duration_days ? (
          <p className="text-sm mt-2">Duração: {course.duration_days} dias</p>
        ) : (
          course.start_date && course.end_date && (
            <p className="text-sm mt-2">
              {new Date(course.start_date).toLocaleDateString()} - {new Date(course.end_date).toLocaleDateString()}
            </p>
          )
        )}
      </CardContent>
    </Card>
  ))}
</div>
    </div>
  );
};

export default CoursesPage;