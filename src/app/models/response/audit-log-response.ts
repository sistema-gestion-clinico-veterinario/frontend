export interface AuditLog {
  id: number;
  timestamp: string;
  userEmail: string;
  userRole: string;
  companyId: number;
  companyName: string;
  action: string;
  module: string;
  details: string;
  ipAddress: string;
  dispositivo?: string | null;
}
