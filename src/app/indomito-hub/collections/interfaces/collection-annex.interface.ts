export type AnnexStatus =
  'PREPARING_DRAFT' | 'DRAFT' | 'VALIDATING' | 'APPLYING' | 'REJECTED' | 'APPLIED';

export interface RosterMember {
  accountId: string;
  participantId: string;
  previousParticipation?: string;
  nextParticipation?: string;
  name: string;
  document: string;
  active: boolean;
  free: boolean;
  version: number;
}

export interface RosterPage {
  items: RosterMember[];
  nextCursor?: string;
  closed: boolean;
  closedAt?: string;
  closeReason?: string;
}

export interface RosterMigrationState {
  tripId: string;
  status: 'PREPARING' | 'APPLIED';
  prepared: number;
  expected: number;
}

export interface RosterClosureState {
  tripId: string;
  closed: true;
}

export interface AnnexState {
  id: string;
  tripId: string;
  status: AnnexStatus;
  prepared: number;
  expected: number;
  approvalReason?: string;
}

export interface AnnexInstallment {
  id: string;
  dueDate: string;
  amount: number;
}

export interface AnnexDraftRequest {
  id: string;
  reason: string;
  withdrawals: { accountId: string; expectedVersion: number }[];
  admissions: {
    accountId: string;
    participantId: string;
    name: string;
    dni: string;
    free: boolean;
    depositAgreed: number;
    installments: AnnexInstallment[];
  }[];
  replacements: { outgoingAccountId: string; incomingAccountId: string }[];
}

export interface AnnexProposal {
  relatedAccountId?: string;
  accountId: string;
  participantId: string;
  kind: 'PARTICIPANT_ADMITTED' | 'PARTICIPANT_WITHDRAWN';
  expectedVersion: number;
  currentVersion: number;
  stale: boolean;
  debtAdded: number;
  debtRemoved: number;
  free: boolean;
}

export interface AnnexProposalPage {
  items: AnnexProposal[];
  nextCursor?: string;
}

export interface AnnexImpact {
  proposals: number;
  admissions: number;
  withdrawals: number;
  replacements: number;
  freeAdmissions: number;
  freeWithdrawals: number;
  staleAccounts: number;
  debtAdded: number;
  debtRemoved: number;
  receivableDelta: number;
}
