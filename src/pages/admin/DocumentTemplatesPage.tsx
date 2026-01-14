import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus,
  FileText,
  BookOpen,
  Receipt,
  Award,
  Edit,
  Copy,
  Trash2,
  Star,
  Eye,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentTemplateEditor } from "@/components/admin/DocumentTemplateEditor";
import { DocumentPreview } from "@/components/admin/DocumentPreview";
import { 
  DocumentTemplate, 
  DocumentTemplateType, 
  DEFAULT_CONTENT_BLOCKS,
  CERTIFICATE_PRESETS,
} from "@/types/document-templates";

const DOCUMENT_TYPE_CONFIG: Record<DocumentTemplateType, { label: string; icon: typeof FileText; description: string }> = {
  declaration: { 
    label: 'Declaração de Matrícula', 
    icon: FileText, 
    description: 'Documento que declara a matrícula do aluno no curso' 
  },
  study_plan: { 
    label: 'Plano de Estudos', 
    icon: BookOpen, 
    description: 'Documento com cronograma e conteúdo programático do curso' 
  },
  quote: { 
    label: 'Orçamento', 
    icon: Receipt, 
    description: 'Documento com valores e condições de pagamento' 
  },
  certificate: { 
    label: 'Certificado', 
    icon: Award, 
    description: 'Certificado de conclusão do curso' 
  },
};

export default function DocumentTemplatesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DocumentTemplateType>('declaration');
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [showPresetDialog, setShowPresetDialog] = useState(false);

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['document-templates'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('document_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((t: any) => ({
        ...t,
        content_blocks: typeof t.content_blocks === 'string' 
          ? JSON.parse(t.content_blocks) 
          : t.content_blocks,
        margins: typeof t.margins === 'string' 
          ? JSON.parse(t.margins) 
          : t.margins,
        styles: typeof t.styles === 'string' 
          ? JSON.parse(t.styles) 
          : t.styles,
      })) as DocumentTemplate[];
    },
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (type: DocumentTemplateType) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const newTemplate = {
        name: `Novo ${DOCUMENT_TYPE_CONFIG[type].label}`,
        type,
        is_default: false,
        is_active: true,
        page_orientation: 'portrait',
        page_format: 'a4',
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        content_blocks: DEFAULT_CONTENT_BLOCKS[type],
        styles: { primaryColor: '#1E40AF', fontFamily: 'helvetica' },
        created_by: user?.id,
      };

      const { data, error } = await (supabase as any)
        .from('document_templates')
        .insert(newTemplate)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      toast.success('Template criado com sucesso!');
      setEditingTemplate({
        ...data,
        content_blocks: typeof data.content_blocks === 'string' 
          ? JSON.parse(data.content_blocks) 
          : data.content_blocks,
        margins: typeof data.margins === 'string' 
          ? JSON.parse(data.margins) 
          : data.margins,
        styles: typeof data.styles === 'string' 
          ? JSON.parse(data.styles) 
          : data.styles,
      });
    },
    onError: (error) => {
      console.error('Error creating template:', error);
      toast.error('Erro ao criar template');
    },
  });

  // Create template from preset mutation
  const createFromPresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const preset = CERTIFICATE_PRESETS.find(p => p.id === presetId);
      
      if (!preset) throw new Error('Preset not found');
      
      const newTemplate = {
        name: preset.name,
        type: 'certificate' as DocumentTemplateType,
        is_default: false,
        is_active: true,
        page_orientation: 'portrait',
        page_format: 'a4',
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        content_blocks: preset.content_blocks,
        styles: { primaryColor: '#1E40AF', fontFamily: 'helvetica' },
        created_by: user?.id,
      };

      const { data, error } = await (supabase as any)
        .from('document_templates')
        .insert(newTemplate)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      toast.success('Template criado a partir do preset!');
      setShowPresetDialog(false);
      setEditingTemplate({
        ...data,
        content_blocks: typeof data.content_blocks === 'string' 
          ? JSON.parse(data.content_blocks) 
          : data.content_blocks,
        margins: typeof data.margins === 'string' 
          ? JSON.parse(data.margins) 
          : data.margins,
        styles: typeof data.styles === 'string' 
          ? JSON.parse(data.styles) 
          : data.styles,
      });
    },
    onError: (error) => {
      console.error('Error creating from preset:', error);
      toast.error('Erro ao criar template do preset');
    },
  });

  // Duplicate template mutation
  const duplicateTemplateMutation = useMutation({
    mutationFn: async (template: DocumentTemplate) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const newTemplate = {
        name: `${template.name} (Cópia)`,
        type: template.type,
        is_default: false,
        is_active: template.is_active,
        page_orientation: template.page_orientation,
        page_format: template.page_format,
        margins: template.margins,
        content_blocks: template.content_blocks,
        styles: template.styles,
        created_by: user?.id,
      };

      const { data, error } = await (supabase as any)
        .from('document_templates')
        .insert(newTemplate)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      toast.success('Template duplicado com sucesso!');
    },
    onError: (error) => {
      console.error('Error duplicating template:', error);
      toast.error('Erro ao duplicar template');
    },
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async ({ templateId, type }: { templateId: string; type: DocumentTemplateType }) => {
      // Remove default from all templates of this type
      await (supabase as any)
        .from('document_templates')
        .update({ is_default: false })
        .eq('type', type);

      // Set this template as default
      const { error } = await (supabase as any)
        .from('document_templates')
        .update({ is_default: true })
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      toast.success('Template definido como padrão!');
    },
    onError: (error) => {
      console.error('Error setting default:', error);
      toast.error('Erro ao definir template padrão');
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ templateId, isActive }: { templateId: string; isActive: boolean }) => {
      const { error } = await (supabase as any)
        .from('document_templates')
        .update({ is_active: isActive })
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
    },
    onError: (error) => {
      console.error('Error toggling active:', error);
      toast.error('Erro ao atualizar template');
    },
  });

  // Delete mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await (supabase as any)
        .from('document_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      toast.success('Template excluído com sucesso!');
      setDeleteTemplateId(null);
    },
    onError: (error) => {
      console.error('Error deleting template:', error);
      toast.error('Erro ao excluir template');
    },
  });

  const filteredTemplates = templates?.filter(t => t.type === activeTab) || [];

  const handleSaveTemplate = () => {
    queryClient.invalidateQueries({ queryKey: ['document-templates'] });
    setEditingTemplate(null);
  };

  if (editingTemplate) {
    return (
      <DocumentTemplateEditor
        template={editingTemplate}
        onSave={handleSaveTemplate}
        onCancel={() => setEditingTemplate(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Modelos de Documentos</h1>
          <p className="text-muted-foreground">
            Gerencie os templates de documentos PDF gerados pelo sistema
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DocumentTemplateType)}>
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          {Object.entries(DOCUMENT_TYPE_CONFIG).map(([key, { label, icon: Icon }]) => (
            <TabsTrigger key={key} value={key} className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(DOCUMENT_TYPE_CONFIG).map(([key, { label, description }]) => (
          <TabsContent key={key} value={key} className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">{label}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => createTemplateMutation.mutate(key as DocumentTemplateType)}
                  disabled={createTemplateMutation.isPending}
                >
                  {createTemplateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Novo Template
                </Button>
                {key === 'certificate' && (
                  <Button 
                    variant="outline"
                    onClick={() => setShowPresetDialog(true)}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Criar do Preset
                  </Button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Nenhum template encontrado para {label.toLowerCase()}.
                  </p>
                  <Button 
                    className="mt-4" 
                    variant="outline"
                    onClick={() => createTemplateMutation.mutate(key as DocumentTemplateType)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map((template) => (
                  <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {template.name}
                            {template.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="h-3 w-3 mr-1 fill-current" />
                                Padrão
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {template.content_blocks?.length || 0} blocos
                          </CardDescription>
                        </div>
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={(checked) => 
                            toggleActiveMutation.mutate({ 
                              templateId: template.id, 
                              isActive: checked 
                            })
                          }
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setEditingTemplate(template)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setPreviewTemplate(template)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Preview
                        </Button>
                        {!template.is_default && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setDefaultMutation.mutate({ 
                              templateId: template.id, 
                              type: template.type 
                            })}
                          >
                            <Star className="h-3 w-3 mr-1" />
                            Definir Padrão
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => duplicateTemplateMutation.mutate(template)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {!template.is_default && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTemplateId(template.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTemplateId && deleteTemplateMutation.mutate(deleteTemplateId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Pré-visualização: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              Visualização do documento com dados de exemplo
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <DocumentPreview template={previewTemplate} />
          )}
        </DialogContent>
      </Dialog>

      {/* Preset Selection Dialog */}
      <Dialog open={showPresetDialog} onOpenChange={setShowPresetDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Escolher Preset de Certificado</DialogTitle>
            <DialogDescription>
              Selecione um modelo pré-configurado para começar
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-3">
            {CERTIFICATE_PRESETS.map((preset) => (
              <Card 
                key={preset.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => createFromPresetMutation.mutate(preset.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{preset.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{preset.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {preset.content_blocks.length} blocos
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
