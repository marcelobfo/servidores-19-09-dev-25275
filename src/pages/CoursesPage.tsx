import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Clock, Calendar } from "lucide-react";
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
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Cursos Disponíveis</h1>
        <p className="text-muted-foreground mb-6">
          Explore nossos cursos e encontre o que melhor se adequa às suas necessidades profissionais.
        </p>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cursos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger className="w-full md:w-48">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course) => (
          <Card key={course.id} className="hover:shadow-lg transition-shadow">
            {course.image_url && (
              <div className="aspect-video overflow-hidden rounded-t-lg">
                <img 
                  src={course.image_url} 
                  alt={course.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <Badge variant="secondary">{course.areas?.name}</Badge>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-1" />
                  {course.duration_hours}h
                </div>
              </div>
              <CardTitle className="line-clamp-2">{course.name}</CardTitle>
              <CardDescription className="line-clamp-3">
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
                  <Button variant="outline" className="w-full">
                    Ver Detalhes
                  </Button>
                </Link>
                <Link to={`/pre-enrollment?course=${course.id}`} className="flex-1">
                  <Button className="w-full">
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
          <h3 className="text-lg font-semibold mb-2">Nenhum curso encontrado</h3>
          <p className="text-muted-foreground">
            Tente ajustar os filtros ou termos de busca.
          </p>
        </div>
      )}
    </div>
  );
};

export default CoursesPage;