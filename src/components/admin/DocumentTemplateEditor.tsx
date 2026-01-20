import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Plus,
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings,
  Eye,
  Loader2,
  Type,
  AlignLeft,
  Table,
  Image,
  PenTool,
  LayoutGrid,
  QrCode,
  Minus,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DocumentPreview } from "./DocumentPreview";
import {
  DocumentTemplate,
  ContentBlock,
  ContentBlockType,
  ContentBlockConfig,
  TEMPLATE_VARIABLES,
  FRAME_PRESETS,
  FrameStyle,
  BlockAlignment,
  HeaderLayout,
  ImageSource,
} from "@/types/document-templates";

interface DocumentTemplateEditorProps {
  template: DocumentTemplate;
  onSave: () => void;
  onCancel: () => void;
}

const BLOCK_TYPE_CONFIG: Record<ContentBlockType, { label: string; icon: typeof Type }> = {
  header: { label: 'Cabeçalho', icon: LayoutGrid },
  title: { label: 'Título', icon: Type },
  paragraph: { label: 'Parágrafo', icon: AlignLeft },
  table: { label: 'Tabela', icon: Table },
  modules_table: { label: 'Tabela de Módulos', icon: Table },
  cronograma_table: { label: 'Cronograma', icon: Table },
  signature: { label: 'Assinatura', icon: PenTool },
  footer: { label: 'Rodapé', icon: LayoutGrid },
  image: { label: 'Imagem', icon: Image },
  qrcode: { label: 'QR Code', icon: QrCode },
  spacer: { label: 'Espaçador', icon: Minus },
  frame: { label: 'Moldura', icon: LayoutGrid },
  course_content: { label: 'Conteúdo Programático', icon: AlignLeft },
};

export function DocumentTemplateEditor({ template, onSave, onCancel }: DocumentTemplateEditorProps) {
  const [localTemplate, setLocalTemplate] = useState<DocumentTemplate>(template);
  const [showPreview, setShowPreview] = useState(true);
  const [expandedBlocks, setExpandedBlocks] = useState<string[]>([]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (templateData: DocumentTemplate) => {
      const { error } = await (supabase as any)
        .from('document_templates')
        .update({
          name: templateData.name,
          page_orientation: templateData.page_orientation,
          page_format: templateData.page_format,
          margins: templateData.margins,
          content_blocks: templateData.content_blocks,
          styles: templateData.styles,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateData.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template salvo com sucesso!');
      onSave();
    },
    onError: (error) => {
      console.error('Error saving template:', error);
      toast.error('Erro ao salvar template');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(localTemplate);
  };

  const addBlock = (type: ContentBlockType) => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type,
      order: localTemplate.content_blocks.length + 1,
      config: getDefaultConfigForType(type),
    };

    setLocalTemplate(prev => ({
      ...prev,
      content_blocks: [...prev.content_blocks, newBlock],
    }));

    setExpandedBlocks(prev => [...prev, newBlock.id]);
  };

  const getDefaultConfigForType = (type: ContentBlockType): ContentBlockConfig => {
    switch (type) {
      case 'title':
        return { text: 'Título', fontSize: 16, fontWeight: 'bold' as const, align: 'center' as const, marginTop: 10 };
      case 'paragraph':
        return { text: 'Digite o texto aqui...', fontSize: 11, align: 'justify' as const, marginTop: 10 };
      case 'spacer':
        return { marginTop: 20 };
      case 'header':
        return { imageField: 'logo' as const, showLogo: true, showInstitutionInfo: true };
      case 'footer':
        return { footerAlign: 'center' as const };
      case 'signature':
        return { imageField: 'signature' as const, marginTop: 20 };
      case 'modules_table':
      case 'cronograma_table':
        return { marginTop: 10 };
      case 'qrcode':
        return { width: 60, height: 60, marginTop: 20 };
      case 'frame':
        return { frameStyle: 'classic', frameColor: '#1E40AF', frameWidth: 4 };
      case 'course_content':
        return { fontSize: 10, align: 'justify' as const, marginTop: 10 };
      default:
        return {};
    }
  };

  const updateBlock = (blockId: string, updates: Partial<ContentBlock['config']>) => {
    setLocalTemplate(prev => ({
      ...prev,
      content_blocks: prev.content_blocks.map(block =>
        block.id === blockId
          ? { ...block, config: { ...block.config, ...updates } }
          : block
      ),
    }));
  };

  const removeBlock = (blockId: string) => {
    setLocalTemplate(prev => ({
      ...prev,
      content_blocks: prev.content_blocks
        .filter(b => b.id !== blockId)
        .map((b, i) => ({ ...b, order: i + 1 })),
    }));
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    const blocks = [...localTemplate.content_blocks];
    const index = blocks.findIndex(b => b.id === blockId);
    
    if (direction === 'up' && index > 0) {
      [blocks[index], blocks[index - 1]] = [blocks[index - 1], blocks[index]];
    } else if (direction === 'down' && index < blocks.length - 1) {
      [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
    }

    setLocalTemplate(prev => ({
      ...prev,
      content_blocks: blocks.map((b, i) => ({ ...b, order: i + 1 })),
    }));
  };

  const toggleBlockExpanded = (blockId: string) => {
    setExpandedBlocks(prev =>
      prev.includes(blockId)
        ? prev.filter(id => id !== blockId)
        : [...prev, blockId]
    );
  };

  const variables = TEMPLATE_VARIABLES[localTemplate.type] || [];

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Input
              value={localTemplate.name}
              onChange={(e) => setLocalTemplate(prev => ({ ...prev, name: e.target.value }))}
              className="text-lg font-semibold h-auto py-1 px-2 border-transparent hover:border-input focus:border-input"
            />
            <Badge variant="outline" className="mt-1">
              {BLOCK_TYPE_CONFIG[localTemplate.content_blocks[0]?.type]?.label || localTemplate.type}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? 'Ocultar' : 'Mostrar'} Preview
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className={`${showPreview ? 'w-1/2' : 'w-full'} border-r flex flex-col`}>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Page Settings */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Configurações da Página
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 p-4 border rounded-lg space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Orientação</Label>
                      <Select
                        value={localTemplate.page_orientation}
                        onValueChange={(v) => setLocalTemplate(prev => ({ ...prev, page_orientation: v as 'portrait' | 'landscape' }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="portrait">Retrato</SelectItem>
                          <SelectItem value="landscape">Paisagem</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Formato</Label>
                      <Select
                        value={localTemplate.page_format}
                        onValueChange={(v) => setLocalTemplate(prev => ({ ...prev, page_format: v as 'a4' | 'letter' }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a4">A4</SelectItem>
                          <SelectItem value="letter">Carta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">Margem Sup.</Label>
                      <Input
                        type="number"
                        value={localTemplate.margins.top}
                        onChange={(e) => setLocalTemplate(prev => ({
                          ...prev,
                          margins: { ...prev.margins, top: Number(e.target.value) }
                        }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Margem Dir.</Label>
                      <Input
                        type="number"
                        value={localTemplate.margins.right}
                        onChange={(e) => setLocalTemplate(prev => ({
                          ...prev,
                          margins: { ...prev.margins, right: Number(e.target.value) }
                        }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Margem Inf.</Label>
                      <Input
                        type="number"
                        value={localTemplate.margins.bottom}
                        onChange={(e) => setLocalTemplate(prev => ({
                          ...prev,
                          margins: { ...prev.margins, bottom: Number(e.target.value) }
                        }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Margem Esq.</Label>
                      <Input
                        type="number"
                        value={localTemplate.margins.left}
                        onChange={(e) => setLocalTemplate(prev => ({
                          ...prev,
                          margins: { ...prev.margins, left: Number(e.target.value) }
                        }))}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Variables Reference */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Type className="h-4 w-4" />
                      Variáveis Disponíveis
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 p-4 border rounded-lg">
                  <div className="grid gap-2">
                    {variables.map((v) => (
                      <div key={v.key} className="flex items-center justify-between text-sm">
                        <code className="bg-muted px-2 py-1 rounded text-xs">{v.key}</code>
                        <span className="text-muted-foreground text-xs">{v.label}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Frame Presets for Certificates */}
              {localTemplate.type === 'certificate' && (
                <Collapsible defaultOpen>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        Moldura do Certificado
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 p-4 border rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      {FRAME_PRESETS.map((preset) => {
                        const currentFrame = localTemplate.content_blocks.find(b => b.type === 'frame');
                        const isSelected = currentFrame?.config.frameStyle === preset.style;
                        
                        return (
                          <div
                            key={preset.id}
                            className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                              isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''
                            }`}
                            onClick={() => {
                              // Remove existing frame block
                              const blocksWithoutFrame = localTemplate.content_blocks.filter(b => b.type !== 'frame');
                              
                              if (preset.style === 'none') {
                                setLocalTemplate(prev => ({
                                  ...prev,
                                  content_blocks: blocksWithoutFrame.map((b, i) => ({ ...b, order: i + 1 })),
                                }));
                              } else {
                                // Add frame block at the beginning (order 0)
                                const frameBlock: ContentBlock = {
                                  id: crypto.randomUUID(),
                                  type: 'frame',
                                  order: 0,
                                  config: {
                                    frameStyle: preset.style,
                                    frameColor: preset.color,
                                    frameWidth: preset.width,
                                  },
                                };
                                
                                setLocalTemplate(prev => ({
                                  ...prev,
                                  content_blocks: [frameBlock, ...blocksWithoutFrame].map((b, i) => ({ ...b, order: i + 1 })),
                                }));
                              }
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div 
                                className="w-4 h-4 rounded border-2" 
                                style={{ borderColor: preset.color }}
                              />
                              <span className="text-sm font-medium">{preset.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{preset.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              <Separator />

              {/* Content Blocks */}
              <div className="space-y-2">
                <h3 className="font-semibold">Blocos de Conteúdo</h3>
                
                {localTemplate.content_blocks.map((block, index) => {
                  const config = BLOCK_TYPE_CONFIG[block.type];
                  const Icon = config?.icon || Type;
                  const isExpanded = expandedBlocks.includes(block.id);

                  return (
                    <Card key={block.id} className="border">
                      <CardHeader className="py-2 px-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-medium">{config?.label}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveBlock(block.id, 'up')}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveBlock(block.id, 'down')}
                              disabled={index === localTemplate.content_blocks.length - 1}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleBlockExpanded(block.id)}
                            >
                              <Settings className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => removeBlock(block.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      
                      {isExpanded && (
                        <CardContent className="pt-0 pb-3 px-3">
                          <div className="space-y-3">
                            {/* Header settings */}
                            {block.type === 'header' && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs">Exibir Logo</Label>
                                  <Switch
                                    checked={block.config.showLogo !== false}
                                    onCheckedChange={(checked) => updateBlock(block.id, { showLogo: checked })}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs">Exibir Informações da Instituição</Label>
                                  <Switch
                                    checked={block.config.showInstitutionInfo !== false}
                                    onCheckedChange={(checked) => updateBlock(block.id, { showInstitutionInfo: checked })}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Layout do Cabeçalho</Label>
                                  <Select
                                    value={block.config.headerLayout || 'logo-left'}
                                    onValueChange={(v) => updateBlock(block.id, { headerLayout: v as HeaderLayout })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="logo-left">Logo à Esquerda</SelectItem>
                                      <SelectItem value="logo-center">Logo no Centro</SelectItem>
                                      <SelectItem value="logo-right">Logo à Direita</SelectItem>
                                      <SelectItem value="logo-above">Logo Acima das Informações</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {block.config.headerLayout === 'logo-above' && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-xs">Posição da Logo</Label>
                                      <Select
                                        value={block.config.logoAlign || 'center'}
                                        onValueChange={(v) => updateBlock(block.id, { logoAlign: v as BlockAlignment })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="left">Esquerda</SelectItem>
                                          <SelectItem value="center">Centro</SelectItem>
                                          <SelectItem value="right">Direita</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label className="text-xs">Posição das Informações</Label>
                                      <Select
                                        value={block.config.infoAlign || 'center'}
                                        onValueChange={(v) => updateBlock(block.id, { infoAlign: v as BlockAlignment })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="left">Esquerda</SelectItem>
                                          <SelectItem value="center">Centro</SelectItem>
                                          <SelectItem value="right">Direita</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Frame settings */}
                            {block.type === 'frame' && (
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-xs">Estilo da Moldura</Label>
                                  <Select
                                    value={block.config.frameStyle || 'classic'}
                                    onValueChange={(v) => updateBlock(block.id, { frameStyle: v as FrameStyle })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Sem Moldura</SelectItem>
                                      <SelectItem value="simple">Simples</SelectItem>
                                      <SelectItem value="double">Dupla</SelectItem>
                                      <SelectItem value="classic">Clássica</SelectItem>
                                      <SelectItem value="elegant">Elegante</SelectItem>
                                      <SelectItem value="modern">Moderna</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Cor da Moldura</Label>
                                    <Input
                                      type="color"
                                      value={block.config.frameColor || '#1E40AF'}
                                      onChange={(e) => updateBlock(block.id, { frameColor: e.target.value })}
                                      className="h-9 p-1"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Espessura (mm)</Label>
                                    <Input
                                      type="number"
                                      value={block.config.frameWidth || 4}
                                      onChange={(e) => updateBlock(block.id, { frameWidth: Number(e.target.value) })}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Footer settings */}
                            {block.type === 'footer' && (
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-xs">Alinhamento do Rodapé</Label>
                                  <Select
                                    value={block.config.footerAlign || 'center'}
                                    onValueChange={(v) => updateBlock(block.id, { footerAlign: v as 'left' | 'center' | 'right' })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="left">Esquerda</SelectItem>
                                      <SelectItem value="center">Centro</SelectItem>
                                      <SelectItem value="right">Direita</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">Texto do Rodapé (deixe vazio para usar o padrão)</Label>
                                  <Textarea
                                    value={block.config.footerText || ''}
                                    onChange={(e) => updateBlock(block.id, { footerText: e.target.value })}
                                    rows={2}
                                    className="text-sm"
                                    placeholder="Use variáveis: {{institution_name}}, {{institution_cnpj}}, {{institution_phone}}, {{institution_email}}, {{year}}"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Text content for title and paragraph */}
                            {(block.type === 'title' || block.type === 'paragraph') && (
                              <div>
                                <Label className="text-xs">Texto</Label>
                                <Textarea
                                  value={block.config.text || ''}
                                  onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                                  rows={block.type === 'paragraph' ? 4 : 1}
                                  className="text-sm"
                                  placeholder="Use variáveis como {{student_name}}"
                                />
                              </div>
                            )}

                            {/* Font settings */}
                            {(block.type === 'title' || block.type === 'paragraph') && (
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-xs">Tamanho</Label>
                                  <Input
                                    type="number"
                                    value={block.config.fontSize || 11}
                                    onChange={(e) => updateBlock(block.id, { fontSize: Number(e.target.value) })}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Peso</Label>
                                  <Select
                                    value={block.config.fontWeight || 'normal'}
                                    onValueChange={(v) => updateBlock(block.id, { fontWeight: v as 'normal' | 'bold' })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="normal">Normal</SelectItem>
                                      <SelectItem value="bold">Negrito</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">Alinhamento</Label>
                                  <Select
                                    value={block.config.align || 'left'}
                                    onValueChange={(v) => updateBlock(block.id, { align: v as 'left' | 'center' | 'right' | 'justify' })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="left">Esquerda</SelectItem>
                                      <SelectItem value="center">Centro</SelectItem>
                                      <SelectItem value="right">Direita</SelectItem>
                                      <SelectItem value="justify">Justificado</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}

                            {/* Spacing */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Espaço Superior (mm)</Label>
                                <Input
                                  type="number"
                                  value={block.config.marginTop || 0}
                                  onChange={(e) => updateBlock(block.id, { marginTop: Number(e.target.value) })}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Espaço Inferior (mm)</Label>
                                <Input
                                  type="number"
                                  value={block.config.marginBottom || 0}
                                  onChange={(e) => updateBlock(block.id, { marginBottom: Number(e.target.value) })}
                                />
                              </div>
                            </div>

                            {/* QR Code settings */}
                            {block.type === 'qrcode' && (
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-xs">Posição do QR Code</Label>
                                  <Select
                                    value={block.config.qrcodeAlign || 'center'}
                                    onValueChange={(v) => updateBlock(block.id, { qrcodeAlign: v as BlockAlignment })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="left">Esquerda</SelectItem>
                                      <SelectItem value="center">Centro</SelectItem>
                                      <SelectItem value="right">Direita</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Largura (mm)</Label>
                                    <Input
                                      type="number"
                                      value={block.config.width || 60}
                                      onChange={(e) => updateBlock(block.id, { width: Number(e.target.value) })}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Altura (mm)</Label>
                                    <Input
                                      type="number"
                                      value={block.config.height || 60}
                                      onChange={(e) => updateBlock(block.id, { height: Number(e.target.value) })}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Signature settings */}
                            {block.type === 'signature' && (
                              <div>
                                <Label className="text-xs">Posição da Assinatura</Label>
                                <Select
                                  value={block.config.signatureAlign || 'left'}
                                  onValueChange={(v) => updateBlock(block.id, { signatureAlign: v as BlockAlignment })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="left">Esquerda</SelectItem>
                                    <SelectItem value="center">Centro</SelectItem>
                                    <SelectItem value="right">Direita</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {/* Image block settings */}
                            {block.type === 'image' && (
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-xs">Origem da Imagem</Label>
                                  <Select
                                    value={block.config.imageSource || 'system-logo'}
                                    onValueChange={(v) => updateBlock(block.id, { imageSource: v as ImageSource })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="system-logo">Logo do Sistema</SelectItem>
                                      <SelectItem value="director-signature">Assinatura do Diretor</SelectItem>
                                      <SelectItem value="custom-url">URL Personalizada</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {block.config.imageSource === 'custom-url' && (
                                  <div>
                                    <Label className="text-xs">URL da Imagem</Label>
                                    <Input
                                      value={block.config.imageUrl || ''}
                                      onChange={(e) => updateBlock(block.id, { imageUrl: e.target.value })}
                                      placeholder="https://..."
                                    />
                                  </div>
                                )}
                                <div>
                                  <Label className="text-xs">Posição</Label>
                                  <Select
                                    value={block.config.blockAlign || 'center'}
                                    onValueChange={(v) => updateBlock(block.id, { blockAlign: v as BlockAlignment })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="left">Esquerda</SelectItem>
                                      <SelectItem value="center">Centro</SelectItem>
                                      <SelectItem value="right">Direita</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Largura (mm)</Label>
                                    <Input
                                      type="number"
                                      value={block.config.width || 40}
                                      onChange={(e) => updateBlock(block.id, { width: Number(e.target.value) })}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Altura (mm)</Label>
                                    <Input
                                      type="number"
                                      value={block.config.height || 30}
                                      onChange={(e) => updateBlock(block.id, { height: Number(e.target.value) })}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}

                {/* Add Block Button */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {Object.entries(BLOCK_TYPE_CONFIG).map(([type, { label, icon: Icon }]) => (
                    <Button
                      key={type}
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock(type as ContentBlockType)}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="w-1/2 bg-muted/30 overflow-auto p-4">
            <DocumentPreview template={localTemplate} />
          </div>
        )}
      </div>
    </div>
  );
}
