import { ProposalDocument } from "./proposal-doc";
export type UserRole =
  | "admin"
  | "manager"
  | "executive"
  | "sales"
  | "designer"
  | "lead"
  | "employee";

export type ServiceTag =
  | "digital-marketing"
  | "ui-ux"
  | "web-development"
  | "seo"
  | "social-media"
  | "branding"
  | "technology-services"
  | "oracle-epm"
  | "other";

export type LeadStage = "lead" | "meeting" | "proposal" | "won" | "lost";

export type ProjectStatus =
  | "not-started"
  | "in-progress"
  | "review"
  | "completed"
  | "on-hold";

export type TaskPriority = "low" | "medium" | "high";

export type ProposalStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "proposal"
  | "won"
  | "lost";

export interface CRMUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  requiresPasswordChange?: boolean;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  service: ServiceTag;
  stage: LeadStage;
  assignedTo: string;
  followUpDate?: string;
  notes?: string;
  source?: string;
  nextAction?: string;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  services: ServiceTag[];
  status: "active" | "inactive";
  active?: boolean;
  address?: string;
  website?: string;
  notes?: string;
  currency?: string;
  contractDuration?: string;
  contractStart?: string;
  contractEnd?: string;
  budget?: number | string;
  due?: number | string;
  paid?: number | string;
  remaining?: number | string;
  balance?: number | string;
  createdAt: string;
  fromLeadId?: string;
}

export interface PaymentLog {
  id: string;
  amount: number;
  date: string;
  method: string;
  notes?: string;
  loggedBy: string;
}

export interface Project {
  id: string;
  clientId: string;
  clientName: string;
  title: string;

  service: ServiceTag;
  status: ProjectStatus;
  deadline?: string;
  assignedTo: string[];
  description?: string;
  budget?: number;
  balance?: number;
  due?: number;
  paid?: number;
  remaining?: number;
  currency?: string;
  masterBlueprint?: string;
  leadInstructions?: string;
  tasks?: ProjectTask[];
  customFields?: { id: string; label: string; value: string }[];
  milestones?: {
    id: string;
    title: string;
    dueDate?: string;
    date?: string;
    completed: boolean;
  }[];
  payments?: PaymentLog[];
  techStack?: string[];
  figmaUrl?: string;
  repoUrl?: string;
  stagingUrl?: string;
  productionUrl?: string;
  coreFocus?: string;
  createdAt: string;
  updatedAt: string;


  sharedFiles?: {
    name: string;
    url: string;
    category: string;
    addedBy: string;
    at: string;
  };
}
[];

export interface ProjectTask {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "done";
  assignedTo?: string;
}

export interface ProposalItem {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface ProposalPackage {
  name: string;
  bestFor: string;
  activeCampaigns: string;
  adCreatives: string;
  optimisation: string;
  abTesting: string;
  recommendedSpend: number | string;
  managementFee: number | string;
  reviewCall: string;
  reporting: string;
  estimatedLeads: string;
  estimatedCostPerLead: string;
  recommended?: boolean;
  offered?: boolean; // legacy
  status?: 'option' | 'final' | 'hidden';
  totalMonthly?: number | string;
  customValues?: Record<string, string>;
}

export interface ProposalTimelinePhase {
  phase: string;
  activity: string;
  duration: string;
}

export interface ProposalTerm {
  term: string;
  description: string;
}

export interface ProposalCustomSection {
  id: string;
  title: string;
  content: string;
  points?: string[];
}

export interface Proposal {
  id: string;
  leadId?: string;
  clientId?: string;
  fromLeadId?: string;
  clientName: string;
  clientEmail: string;
  company?: string;
  phone?: string;
  service: ServiceTag;

  // New Editable Document Structure (Optional, for gradual migration)
  documentContent?: ProposalDocument;

  // Rich Document Fields
  isRichDocument?: boolean;
  introduction?: string;
  understanding?: string[];
  objectives?: string[];
  approachTitle?: string;
  approachDescription?: string;
  approachFeatures?: string[];
  packages?: ProposalPackage[];
  addons?: {
    name: string;
    deliverables: string;
    cost: number | string;
    period: string;
  }[];
  timeline?: ProposalTimelinePhase[];
  exclusions?: string[];
  terms?: ProposalTerm[];
  customSections?: ProposalCustomSection[];

  // Dynamic Pricing & Tax Fields
  taxPercentage?: number;
  selectedPackageName?: string;
  selectedPackagePrice?: number;
  agreedRate?: number;

  // Editor-specific Fields
  aboutTitle?: string;
  understandingTitle?: string;
  objectivesTitle?: string;
  packagesTitle?: string;
  packagesDescription?: string;
  addonsTitle?: string;
  addonsDescription?: string;
  timelineTitle?: string;
  exclusionsTitle?: string;
  termsTitle?: string;
  acceptanceTitle?: string;
  acceptanceText?: string;
  providerSignatory?: string;
  clientSignatory?: string;
  footerClosingText?: string;
  companyHeaderTitle?: string;
  companyHeaderSubtitle?: string;
  documentTypeLabel?: string;
  subject?: string;
  preparedByLabel?: string;
  validityLabel?: string;
  engagementModelLabel?: string;
  tagline?: string;

  // Custom table row labels
  packageRowLabels?: {
    bestFor?: string;
    activeCampaigns?: string;
    adCreatives?: string;
    optimisation?: string;
    abTesting?: string;
    recommendedSpend?: string;
    managementFee?: string;
    reviewCall?: string;
    reporting?: string;
    estimatedLeads?: string;
    estimatedCostPerLead?: string;
    totalMonthly?: string;
  };

  disabledPackageRows?: string[];

  customRows?: { id: string; label: string }[];

  // Commercial Summary Fields
  commercialSummaryTitle?: string;
  commercialSummaryDescription?: string;
  commercialSummaryRows?: { item: string; amount: string }[];

  // Standard/Legacy Fields
  items: ProposalItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency?: string;
  status: ProposalStatus;
  notes?: string;
  validUntil?: string;
  createdBy: string;
  sentAt?: string;
  viewedAt?: string;
  clientSignatureName?: string;
  clientSignatureTitle?: string;
  clientSignatureImage?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type SystemTaskType =
  | "follow-up"
  | "meeting"
  | "internal-task"
  | "admin-action"
  | "project-task";

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo: string | string[];
  assignedToName?: string | string[];
  assignedBy: string;
  clientId?: string;
  clientName?: string;
  relatedTo?: string;
  relatedType?: "lead" | "client" | "project" | "proposal";
  taskType?: SystemTaskType;
  dueDate?: string;
  priority: TaskPriority;
  status: string;
  done: boolean;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  service: ServiceTag;
  status: "paid" | "unpaid" | "overdue";
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  notes?: string;
  items: { description: string; qty: number; rate: number; amount: number }[];
  currency?: string;
  taxPercentage?: number;
  projectId?: string;
  createdBy: string;
  createdAt: string;
}
