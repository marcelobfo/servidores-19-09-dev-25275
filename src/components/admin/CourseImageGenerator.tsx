import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";

interface CourseImageGeneratorProps {
  courseName: string;
  areaName?: string;
  description?: string;
  onImageGenerated: (imageUrl: string) => void;
  onCancel: () => void;
}

export function CourseImageGenerator({
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
  const [uploading, setUploading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!courseName.trim()) {
      toast({
        title: "Erro",
        description: "Nome do curso é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setGenerating(true);
    setGeneratedImage(null);
    console.log('🎨 Starting image generation for:', courseName);

    try {
      console.log('📤 Invoking generate-course-image function...');
      const { data, error } = await supabase.functions.invoke('generate-course-image', {
        body: {
          courseName,
          areaName,
          description
        }
      });

      console.log('📥 Function response:', { data, error });

      if (error) {
        console.error('❌ Function returned error:', error);
        throw error;
      }

      if (!data?.imageUrl) {
        console.error('❌ No imageUrl in response:', data);
        throw new Error(data?.error || 'Nenhuma imagem foi gerada');
      }

      console.log('✅ Image generated successfully');
      setGeneratedImage(data.imageUrl);
      
      toast({
        title: "Sucesso",
        description: "Imagem gerada com sucesso!"
      });
    } catch (error: any) {
      console.error('❌ Error generating image:', error);
      const errorMessage = error.message || 'Falha ao gerar imagem. Verifique a configuração do Lovable AI.';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleUseImage = async () => {
    if (!generatedImage) return;

    setUploading(true);
    try {
      // Converter base64 para blob
      const base64Data = generatedImage.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      // Upload para o bucket do Supabase
      const fileName = `course-cover-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      onImageGenerated(data.publicUrl);
      
      toast({
        title: "Sucesso",
        description: "Imagem salva com sucesso!"
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar imagem",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
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

      {!generatedImage && (
        <Button
          onClick={handleGenerate}
          disabled={generating || !courseName.trim()}
          className="w-full"
        >
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando Capa...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Gerar Capa com IA
            </>
          )}
        </Button>
      )}

      {generatedImage && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border overflow-hidden bg-muted">
            <img
              src={generatedImage}
              alt="Capa gerada"
              className="w-full h-auto"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleUseImage}
              disabled={uploading}
              className="flex-1"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Usar esta Imagem"
              )}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              variant="outline"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Gerar Novamente
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onCancel} variant="ghost">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
