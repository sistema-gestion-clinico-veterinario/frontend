import { AccessReviewDecision } from '../../types/access-review-decision.type';

export interface AccessReviewItem {
  assignmentId: number;
  usuarioId: number;
  nombre: string;
  email: string | null;
  roleId: number;
  roleName: string;
  reasons: string[];
  lastActivity: string | null;
  assignedAt: string | null;
}

export interface AccessReviewSummary {
  id: number;
  performedAt: string;
  performedByEmail: string | null;
  reviewedCount: number;
  keptCount: number;
  revokedCount: number;
  notes: string | null;
}

export interface AccessReviewOverview {
  intervalDays: number;
  overdue: boolean;
  nextDueAt: string | null;
  lastReview: AccessReviewSummary | null;
  items: AccessReviewItem[];
}

export interface AccessReviewEntry {
  nombre: string;
  email: string | null;
  roleName: string;
  reasons: string;
  decision: AccessReviewDecision;
  comment: string | null;
}

export interface AccessReviewDetail {
  review: AccessReviewSummary;
  entries: AccessReviewEntry[];
}

export interface AccessReviewDecisionRequest {
  assignmentId: number;
  decision: AccessReviewDecision;
  comment?: string;
}
