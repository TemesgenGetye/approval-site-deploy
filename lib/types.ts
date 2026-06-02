export type OrgTypeSlug = 'government' | 'university' | 'hospital' | 'school' | 'ngo' | 'company';

export type FieldType = 'text' | 'select' | 'radio' | 'file' | 'textarea' | 'number' | 'date' | 'email' | 'phone';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export type PriorityLevel = 'high' | 'medium' | 'low';

export interface OrgType {
  id: string;
  name: string;
  slug: OrgTypeSlug;
  icon: string;
  description: string | null;
}

export interface FormConfig {
  id: string;
  org_type_slug: OrgTypeSlug;
  version: number;
  is_active: boolean;
}

export interface FormSection {
  id: string;
  form_config_id: string;
  section_key: string;
  section_label: string;
  section_description: string | null;
  order_index: number;
  max_score: number;
}

export interface ScoringRule {
  condition: string;
  score: number | null;
}

export interface FieldOption {
  label: string;
  value: string;
}

export interface ConditionalOn {
  field_key: string;
  value?: string;
  not_in?: string[];
}

export interface ValidationRules {
  min_length?: number;
  max_length?: number;
  pattern?: string;
  min?: number;
  max?: number;
  max_file_size?: number;
}

export interface FormField {
  id: string;
  section_id: string;
  field_key: string;
  field_type: FieldType;
  label: string;
  placeholder: string | null;
  help_text: string | null;
  required: boolean;
  options: FieldOption[] | null;
  validation_rules: ValidationRules | null;
  scoring_rules: ScoringRule[] | null;
  conditional_on: ConditionalOn | null;
  document_accepted_formats: string[] | null;
  order_index: number;
}

export interface VerificationSubmission {
  id: string;
  org_type_slug: OrgTypeSlug;
  form_config_id: string;
  company_name: string;
  company_contact_email: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  form_data: Record<string, unknown>;
  document_urls: string[];
  total_score: number;
  section_scores: Record<string, number>;
  priority_level: PriorityLevel | null;
  status: SubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  auto_account_created: boolean;
  auto_account_email: string | null;
  auto_account_password: string | null;
  created_at: string;
  updated_at: string;
}

export interface SectionScore {
  section_key: string;
  section_label: string;
  score: number;
  max_score: number;
  details: { field_key: string; label: string; score: number; reason: string }[];
}

export interface SubmissionWithSections extends VerificationSubmission {
  sections: SectionScore[];
}

export interface NotificationQueue {
  id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
}

export const ORG_TYPES: { slug: OrgTypeSlug; name: string; icon: string; description: string }[] = [
  { slug: 'government', name: 'Government', icon: '🏛️', description: 'Citizen support verification' },
  { slug: 'university', name: 'University / College', icon: '🎓', description: 'Needy student verification' },
  { slug: 'hospital', name: 'Hospital / Clinic', icon: '🏥', description: 'Medical support verification' },
  { slug: 'school', name: 'School', icon: '🏫', description: 'Scholarship/support verification' },
  { slug: 'ngo', name: 'NGO / Non-profit', icon: '🤝', description: 'Community support verification' },
  { slug: 'company', name: 'Company', icon: '🏢', description: 'Employee/community assistance' },
];

export const ORG_TYPE_MAP: Record<OrgTypeSlug, { name: string; icon: string }> = {
  government: { name: 'Government', icon: '🏛️' },
  university: { name: 'University / College', icon: '🎓' },
  hospital: { name: 'Hospital / Clinic', icon: '🏥' },
  school: { name: 'School', icon: '🏫' },
  ngo: { name: 'NGO / Non-profit', icon: '🤝' },
  company: { name: 'Company', icon: '🏢' },
};
