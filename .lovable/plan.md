
# Plano de Melhorias: Tabela de Cronograma e Carga Horária Semanal

## Resumo

Este plano aborda três melhorias importantes para o sistema de documentos:

1. **Reformatar a tabela de cronograma** para corresponder exatamente ao formato do documento de referência enviado
2. **Adicionar coluna `weekly_hours` na tabela `organ_types`** para definir carga horária semanal (20h para federais, 30h para outros)
3. **Tornar os dados dinâmicos na tabela** de cronograma, puxando informações do sistema de cadastro

---

## Análise do Documento de Referência

O cronograma no PDF do Plano de Estudos segue este formato:

```text
+------------------+---------------+------------------+-----------------------------+------------------+
| Data             | Horário       | Carga Horária    | Atividade/Conteúdo a ser    | Local            |
|                  |               | Semanal (horas)  | Desenvolvido                |                  |
+------------------+---------------+------------------+-----------------------------+------------------+
| 02/04/2026 a     | 8:00 às 12:00 | 30               | Assistir aos vídeos         | Plataforma       |
| 30/06/2026       |               |                  | Participação em fóruns      | Infomar Cursos   |
|                  | 14:00 às      |                  | de discussão                |                  |
|                  | 16:00         |                  | Avaliação                   |                  |
+------------------+---------------+------------------+-----------------------------+------------------+
```

---

## 1. Alteração no Banco de Dados

### Adicionar coluna `weekly_hours` à tabela `organ_types`

**Arquivo a criar:** `supabase/sql/add_weekly_hours_to_organ_types.sql`

```sql
-- Adicionar coluna weekly_hours (carga horária semanal)
ALTER TABLE organ_types 
ADD COLUMN IF NOT EXISTS weekly_hours INTEGER DEFAULT 30 NOT NULL;

-- Atualizar valores padrão:
-- Órgãos federais = 20h/semana
-- Outros = 30h/semana
UPDATE organ_types 
SET weekly_hours = 20 
WHERE is_federal = true;

UPDATE organ_types 
SET weekly_hours = 30 
WHERE is_federal = false;
```

---

## 2. Interface de Gerenciamento de Tipos de Órgãos

### Arquivo: `src/pages/admin/OrganTypesPage.tsx`

**Alterações:**
- Adicionar campo `weekly_hours` no formulário de criação/edição
- Adicionar coluna "Carga Horária Semanal" na tabela
- Valores padrão: 20h (federais), 30h (outros)

**Novo formulário:**
```text
+----------------------------------------+
| Nome do Tipo *                         |
| [________________________]             |
|                                        |
| Multiplicador de Carga Horária *       |
| [0.5 ] = 50% da carga horária          |
|                                        |
| Carga Horária Semanal (horas) * [NOVO] |
| [20  ] horas/semana                    |
|                                        |
| [x] É órgão federal                    |
+----------------------------------------+
```

**Nova coluna na tabela:**
```text
| Nome     | Multiplicador | CH Semanal | Exemplo | Federal |
| Normal   | 100%          | 30h        | 390h    | -       |
| Câmara   | 50%           | 20h        | 195h    | Federal |
```

---

## 3. Reformatação da Tabela de Cronograma

### Arquivo: `src/lib/dynamicPdfGenerator.ts`

**Estrutura da nova tabela:**

```text
Colunas:
+-------+-------------+------------+------------------+--------+
| Data  | Horário     | CH Semanal | Atividade        | Local  |
+-------+-------------+------------+------------------+--------+
| 35mm  | 30mm        | 25mm       | 55mm             | 35mm   |
+-------+-------------+------------+------------------+--------+
```

**Dados dinâmicos da tabela:**

| Campo | Origem dos Dados | Exemplo |
|-------|------------------|---------|
| Data | `{{start_date}} a {{end_date}}` | 02/04/2026 a 30/06/2026 |
| Horário | Fixo (padrão do sistema) | 8:00 às 12:00 / 14:00 às 16:00 |
| CH Semanal | `organ_types.weekly_hours` ou padrão 30 | 30 ou 20 |
| Atividade | Fixo (lista padrão) | Assistir aos vídeos, Fóruns, Avaliação |
| Local | `Plataforma {{institution_name}}` | Plataforma Infomar Cursos |

**Alterações no código:**

```typescript
// Interface PreviewData - adicionar weekly_hours
interface PreviewData {
  // ... campos existentes
  weekly_hours: number; // NOVO - vem do organ_type selecionado
}

// Função renderCronogramaTable - reformatar
const renderCronogramaTable = (pdf, data, settings, yPosition, marginLeft, block) => {
  // Colunas ajustadas para melhor visualização
  const colWidths = [35, 30, 25, 55, 35]; // Total: 180mm
  
  // Dados dinâmicos
  const cronogramaData = {
    data: `${data.start_date} a\n${data.end_date}`,
    horario: '8:00 às\n12:00\n\n14:00\nàs 16:00',
    cargaHoraria: data.weekly_hours || 30,
    atividade: 'Assistir aos vídeos\n\nParticipação em fóruns de discussão\n\nAvaliação',
    local: `Plataforma ${settings.institution_name?.split(' ')[0] || 'Infomar'} Cursos`
  };
  
  // Renderizar com altura de linha maior para multiline
  // ...
};
```

---

## 4. Propagação do `weekly_hours` para Geração de Documentos

### Arquivos afetados:

1. **`src/lib/dynamicPdfGenerator.ts`** - Receber e usar `weekly_hours` no cronograma
2. **`src/lib/pdfGenerator.ts`** - Passar `weekly_hours` nos dados de preview
3. **`src/pages/student/DocumentsPage.tsx`** - Buscar `weekly_hours` do `organ_type` associado

### Fluxo de dados:

```text
organ_types.weekly_hours
        |
        v
pre_enrollments.organ_type_id --> JOIN organ_types
        |
        v
fetchPreEnrollmentData() --> { weekly_hours: 20 ou 30 }
        |
        v
generateStudyPlan(data) --> renderCronogramaTable(data.weekly_hours)
```

---

## Detalhes Técnicos da Implementação

### Alterações por arquivo:

**1. SQL Migration**
- Criar `supabase/sql/add_weekly_hours_to_organ_types.sql`
- Adicionar coluna `weekly_hours INTEGER DEFAULT 30`

**2. `src/pages/admin/OrganTypesPage.tsx`**
- Adicionar `weekly_hours` na interface `OrganType`
- Adicionar campo no formulário
- Adicionar coluna na tabela de listagem

**3. `src/lib/dynamicPdfGenerator.ts`**
- Adicionar `weekly_hours` na interface `PreviewData`
- Refatorar `renderCronogramaTable` para:
  - Usar layout multiline nas células
  - Mostrar horário em duas linhas (manhã e tarde)
  - Usar `data.weekly_hours` para carga horária semanal
  - Formatar atividades em lista

**4. `src/pages/student/DocumentsPage.tsx`**
- Ajustar `fetchPreEnrollmentData` para incluir `weekly_hours` do organ_type

---

## Resultado Visual Esperado

### Tabela de Cronograma no PDF:

```text
+-------------------+-------------+------------+------------------------+------------------+
| Data              | Horário     | Carga      | Atividade/Conteúdo     | Local            |
|                   |             | Horária    | a ser Desenvolvido     |                  |
|                   |             | Semanal    |                        |                  |
|                   |             | (horas)    |                        |                  |
+-------------------+-------------+------------+------------------------+------------------+
| 02/04/2026 a      | 8:00 às     | 30         | Assistir aos vídeos    | Plataforma       |
| 30/06/2026        | 12:00       |            |                        | Infomar Cursos   |
|                   |             |            | Participação em        |                  |
|                   | 14:00       |            | fóruns de discussão    |                  |
|                   | às 16:00    |            |                        |                  |
|                   |             |            | Avaliação              |                  |
+-------------------+-------------+------------+------------------------+------------------+
```

---

## Ordem de Implementação

1. Criar migration SQL para `weekly_hours`
2. Atualizar `OrganTypesPage.tsx` com novo campo
3. Refatorar `renderCronogramaTable` no PDF generator
4. Ajustar busca de dados para incluir `weekly_hours`
5. Testar geração de documentos com diferentes tipos de órgãos
