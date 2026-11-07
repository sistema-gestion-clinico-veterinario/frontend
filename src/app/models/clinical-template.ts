export type ClinicalValueType =
  | 'TEXT_SHORT'
  | 'TEXT_LONG'
  | 'INTEGER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'SELECT_ONE'
  | 'SELECT_MULTIPLE'
  | 'SCALE'
  | 'DISPLAY';

export interface ClinicalTemplateField {
  id: number;
  conceptId: number;
  conceptCode: string;
  label: string;
  helpText?: string;
  valueType: ClinicalValueType;
  unit?: string;
  required: boolean;
  visible: boolean;
  reportable: boolean;
  order: number;
  species: string[];
  validationConfig?: string;
  visibilityRules?: string;
}

export interface ClinicalTemplateSection {
  id: number;
  title: string;
  order: number;
  fields: ClinicalTemplateField[];
}

export interface ClinicalTemplateResponse {
  id: number;
  templateKey: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string;
  sections: ClinicalTemplateSection[];
}

export interface ClinicalFieldAnswer {
  fieldId: number;
  conceptCode: string;
  label: string;
  value?: string;
}

export interface ClinicalFieldAnswerRequest {
  fieldId: number;
  value?: string;
}

export interface ClinicalTemplateSummary {
  id: number;
  templateKey: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string;
}

export interface ClinicalConcept {
  id: number;
  code: string;
  name: string;
  description?: string;
  valueType: ClinicalValueType;
  unit?: string;
  origin: 'SYSTEM' | 'COMPANY';
  reportable: boolean;
  active: boolean;
  validationConfig?: string;
}

export interface ClinicalTemplateDraftRequest {
  name: string;
  sections: Array<{
    title: string;
    order: number;
    fields: Array<{
      conceptId: number;
      label: string;
      helpText?: string;
      required: boolean;
      visible: boolean;
      order: number;
      species: string[];
      visibilityRules: string;
    }>;
  }>;
}

export interface ClinicalConceptRequest {
  code?: string;
  name: string;
  description?: string;
  valueType: ClinicalValueType;
  unit?: string;
  reportable: boolean;
  validationConfig: string;
}
