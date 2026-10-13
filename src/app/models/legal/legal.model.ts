import { LegalDocumentType } from '../../types/legal/legal-document.type';
import { LegalRecordType } from '../../types/legal/legal-record.type';

export interface LegalDocumentDTO {
  id: number;
  tipo: LegalDocumentType;
  version: string;
  contenido: string;
  vigenteDesde: string;
}

export interface LegalAcceptanceDTO {
  tipo: LegalDocumentType;
  version: string;
  contenidoHash: string | null;
  textoRecuperable: boolean;
  fechaAceptacion: string;
  tipoConstancia?: LegalRecordType;
}

export interface LegalStatusDTO {
  needsAcceptance: boolean;
  overdue: boolean;
  pendingDocuments: LegalDocumentDTO[];
}
