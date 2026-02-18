import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";

interface CourseImageGeneratorProps {
  courseId?: string;
  courseName: string;
  areaName?: string;
  description?: string;
  onImageGenerated: (imageUrl: string) => void;
  onCancel: () => void;
}

export function CourseImageGenerator({
  courseId,
  courseName: initialCourseName,
  areaName: initialAreaName,
  description: initialDescription,
  onImageGenerated,
  onCancel
}: CourseImageGeneratorProps) {
  const [courseName, setCourseName] = useState(initialCourseName);
  const [areaName, setAreaName] = useState(initialAreaName || "");
  const [description, setDescription] = useState(initialDescription || "");
  const [generating, setGenerating] = useState(false);
  const [waitingForImage, setWaitingForImage] = useState(false);
  const { toast } = useToast();

  // Subscribe to Realtime changes on courses table to detect image_url updates
  useEffect(() => {
    if (!courseId || !waitingForImage) return;

    console.log('👂 Subscribing to Realtime for course:', courseId);
    
    const channel = supabase
      .channel(`course-image-${courseId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'courses',
          filter: `id=eq.${courseId}`,
        },
        (payload) => {
          console.log('📡 Realtime update received:', payload);
          const newImageUrl = payload.new?.image_url;
          if (newImageUrl && newImageUrl !== payload.old?.image_url) {
            console.log('✅ New image detected:', newImageUrl.substring(0, 80));
            setWaitingForImage(false);
            setGenerating(false);
            onImageGenerated(newImageUrl);
            toast({
              title: "Imagem gerada!",
              description: "A capa foi gerada e salva com sucesso.",
            });
          }
        }
      )
      .subscribe();

    // Timeout after 2 minutes
    const timeout = setTimeout(() => {
      if (waitingForImage) {
        setWaitingForImage(false);
        setGenerating(false);
        toast({
          title: "Tempo esgotado",
          description: "A geração demorou demais. Tente novamente.",
          variant: "destructive",
        });
      }
    }, 120000);

    return () => {
      console.log('🔌 Unsubscribing from Realtime for course:', courseId);
      supabase.removeChannel(channel);
      clearTimeout(timeout);
    };
  }, [courseId, waitingForImage, onImageGenerated, toast]);

  const handleGenerate = async () => {
    if (!courseName.trim()) {
      toast({
        title: "Nome do curso obrigatório",
        description: "Por favor, preencha o nome do curso.",
        variant: "destructive",
      });
      return;
    }

    if (!courseId) {
      toast({
        title: "Salve o curso primeiro",
        description: "É necessário salvar o curso antes de gerar a imagem.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    console.log('🎨 Starting image generation for:', courseName, 'courseId:', courseId);

    try {
      const { data, error } = await supabase.functions.invoke('n8n-image-proxy', {
        body: { courseName, areaName, description, courseId },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao enviar para N8N');
      }

      console.log('📥 Proxy response:', data);

      // Fire-and-forget mode: start listening for Realtime updates
      setWaitingForImage(true);
      
      toast({
        title: "Gerando imagem...",
        description: "A IA está criando a capa. Você será notificado quando estiver pronta.",
      });
    } catch (error: any) {
      console.error('❌ Erro na geração:', error);
      setGenerating(false);
      toast({
        title: "Erro ao gerar imagem",
        description: error.message || "Não foi possível iniciar a geração. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="gen-course-name">Título do Curso *</Label>
          <Input
            id="gen-course-name"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="Ex: Introdução ao Python"
          />
        </div>

        <div>
          <Label htmlFor="gen-area-name">Área</Label>
          <Input
            id="gen-area-name"
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
            placeholder="Ex: Tecnologia"
          />
        </div>

        <div>
          <Label htmlFor="gen-description">Descrição / Tema</Label>
          <Textarea
            id="gen-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva o tema ou conceitos principais do curso..."
            rows={3}
          />
        </div>
      </div>

      {!courseId && (
        <p className="text-sm text-muted-foreground">
          ⚠️ Salve o curso primeiro para poder gerar a imagem.
        </p>
      )}

      {waitingForImage ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground text-center">
            A IA está gerando a capa do curso...<br />
            A imagem aparecerá automaticamente quando estiver pronta.
          </p>
        </div>
      ) : (
        <Button
          onClick={handleGenerate}
          disabled={generating || !courseName.trim() || !courseId}
          className="w-full"
        >
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Gerar Capa com IA
            </>
          )}
        </Button>
      )}

      <div className="flex justify-end">
        <Button onClick={onCancel} variant="ghost">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
