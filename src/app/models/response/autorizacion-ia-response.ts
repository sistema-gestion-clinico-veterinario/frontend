import { CanalConsentimiento } from '../../types/privacy/canal-consentimiento.type';

export interface AutorizacionIa {
  autorizada: boolean;
  apoderadoId: number;
  titular: string;
  fecha: string | null;
  canal: CanalConsentimiento | null;
}
