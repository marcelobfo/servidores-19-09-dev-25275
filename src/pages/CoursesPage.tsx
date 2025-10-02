import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Clock, Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface Course {
  id: string;
  name: string;
  slug: string;
  description: string;
  brief_description: string;
  image_url: string;
  duration_hours: number;
  start_date: string;
  end_date: string;
  areas?: { name: string };
}

interface Area {
  id: string;
  name: string;
}

const CoursesPage = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("all");

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
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error("Error fetching courses:", error);
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

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.brief_description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArea = selectedArea === "all" || course.areas?.name === selectedArea;
    return matchesSearch && matchesArea;
  });

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1F2C] via-[#221F3D] to-[#2A1F3D]">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Cursos Disponíveis
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Explore nossos cursos e encontre o que melhor se adequa às suas necessidades profissionais.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 max-w-4xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Buscar cursos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card/50 border-border/50 backdrop-blur-sm"
            />
          </div>
          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger className="w-full md:w-64 bg-card/50 border-border/50 backdrop-blur-sm">
              <SelectValue placeholder="Filtrar por área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as áreas</SelectItem>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.name}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <Card key={course.id} className="group hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 bg-card/50 backdrop-blur-sm border-border/50 overflow-hidden">
              {course.image_url && (
                <div className="relative aspect-video overflow-hidden">
                  <img 
                    src={course.image_url} 
                    alt={course.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent"></div>
                  <Badge className="absolute top-3 left-3 bg-primary/90 backdrop-blur-sm text-primary-foreground">
                    {course.areas?.name}
                  </Badge>
                </div>
              )}
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {course.duration_hours}h
                  </div>
                </div>
                <CardTitle className="line-clamp-2 text-foreground group-hover:text-primary transition-colors">
                  {course.name}
                </CardTitle>
                <CardDescription className="line-clamp-3 text-muted-foreground">
                  {course.brief_description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {course.start_date && course.end_date && (
                  <div className="flex items-center text-sm text-muted-foreground mb-4">
                    <Calendar className="h-4 w-4 mr-1" />
                    {new Date(course.start_date).toLocaleDateString()} - {new Date(course.end_date).toLocaleDateString()}
                  </div>
                )}
                <div className="flex gap-2">
                  <Link to={`/course/${course.slug}`} className="flex-1">
                    <Button variant="outline" className="w-full border-primary/30 hover:bg-primary/10 group/btn">
                      Ver Detalhes
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </Link>
                  <Link to={`/pre-enrollment?course=${course.id}`} className="flex-1">
                    <Button className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90">
                      Inscrever-se
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredCourses.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Nenhum curso encontrado</h3>
            <p className="text-muted-foreground">
              Tente ajustar os filtros ou termos de busca.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoursesPage;
