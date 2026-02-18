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
        title: "Nome do curso obrigatório",
        description: "Por favor, preencha o nome do curso.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setGeneratedImage(null);
    console.log('🎨 Starting image generation for:', courseName);

    try {
      console.log('📤 Enviando para proxy N8N via Edge Function...');
      const { data, error } = await supabase.functions.invoke('n8n-image-proxy', {
        body: { courseName, areaName, description },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao chamar proxy N8N');
      }

      console.log('📥 Resposta do proxy:', data);

      if (!data?.imageUrl) {
        throw new Error(data?.error || 'Nenhuma imagem foi retornada pelo webhook');
      }

      console.log('✅ Imagem gerada com sucesso via N8N');
      setGeneratedImage(data.imageUrl);
      
      toast({
        title: "Imagem gerada!",
        description: "A capa foi gerada com sucesso.",
      });
    } catch (error: any) {
      console.error('❌ Erro na geração:', error);
      toast({
        title: "Erro ao gerar imagem",
        description: error.message || "Não foi possível gerar a imagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleUseImage = async () => {
    if (!generatedImage) return;

    setUploading(true);
    try {
      let blob: Blob;
      let imageSource = generatedImage;

      // Se começa com data: mas contém uma URL dentro (ex: N8N encapsulou URL em data:)
      if (imageSource.startsWith('data:')) {
        try {
          const base64Data = imageSource.split(',')[1];
          const mimeMatch = imageSource.match(/data:([^;]+);/);
          const mimeType = mimeMatch?.[1] || 'image/png';
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
        } catch (base64Error) {
          console.warn('⚠️ Base64 decode failed, trying as URL fallback...');
          // Extrair URL se estiver embutida no data URI malformado
          const urlMatch = imageSource.match(/https?:\/\/[^\s"']+/);
          if (urlMatch) {
            imageSource = urlMatch[0];
          }
          const imgResponse = await fetch(imageSource);
          blob = await imgResponse.blob();
        }
      } else {
        // URL pública - baixar a imagem
        const imgResponse = await fetch(imageSource);
        blob = await imgResponse.blob();
      }

      const fileName = `course-cover-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

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
