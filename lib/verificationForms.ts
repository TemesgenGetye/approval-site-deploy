import type { OrgTypeSlug, FormSection, FormField, ScoringRule, FieldOption, ValidationRules, ConditionalOn } from './types';

const DOC_FORMATS = ['pdf', 'jpg', 'png', 'jpeg'];

export interface SectionConfig {
  section_key: string;
  section_label: string;
  section_description: string;
  max_score: number;
  fields: FieldConfig[];
}

export interface FieldConfig {
  field_key: string;
  field_type: 'text' | 'select' | 'radio' | 'file' | 'textarea' | 'number' | 'date' | 'email' | 'phone';
  label: string;
  placeholder?: string;
  help_text?: string;
  required?: boolean;
  options?: FieldOption[];
  validation_rules?: ValidationRules;
  scoring_rules?: ScoringRule[];
  conditional_on?: ConditionalOn;
  document_accepted_formats?: string[];
}

export interface OrgFormDefinition {
  orgType: OrgTypeSlug;
  sections: SectionConfig[];
}

function opt(label: string, value: string): FieldOption {
  return { label, value };
}

// ================================================================
// 1. UNIVERSITY — Needy Student Verification
// ================================================================
const universityForm: OrgFormDefinition = {
  orgType: 'university',
  sections: [
    {
      section_key: 'parent_guardian',
      section_label: 'Parent / Guardian Status',
      section_description: 'Information about the student\'s parents or legal guardians',
      max_score: 25,
      fields: [
        {
          field_key: 'parent_status',
          field_type: 'select',
          label: 'Parent Status',
          required: true,
          options: [
            opt('Both alive', 'both_alive'),
            opt('Father deceased', 'father_deceased'),
            opt('Mother deceased', 'mother_deceased'),
            opt('Both deceased', 'both_deceased'),
            opt('Single guardian', 'single_guardian'),
          ],
          scoring_rules: [
            { condition: 'both_deceased', score: 25 },
            { condition: 'father_deceased', score: 15 },
            { condition: 'mother_deceased', score: 15 },
            { condition: 'single_guardian', score: 10 },
            { condition: 'both_alive', score: 0 },
          ],
        },
        {
          field_key: 'guardian_name',
          field_type: 'text',
          label: 'Guardian Name',
          required: true,
          placeholder: 'Full name of guardian',
          conditional_on: { field_key: 'parent_status', not_in: ['both_alive'] },
        },
        {
          field_key: 'guardian_relationship',
          field_type: 'text',
          label: 'Guardian Relationship',
          required: true,
          placeholder: 'e.g. Uncle, Aunt, Grandparent',
          conditional_on: { field_key: 'parent_status', not_in: ['both_alive'] },
        },
        {
          field_key: 'guardian_contact',
          field_type: 'phone',
          label: 'Guardian Contact Number',
          required: true,
          placeholder: '+251 9XX XXX XXX',
          help_text: 'Must be a valid Ethiopian phone number',
          validation_rules: { pattern: '^\\+?251[0-9]{9}$', min_length: 10 },
          conditional_on: { field_key: 'parent_status', not_in: ['both_alive'] },
        },
      ],
    },
    {
      section_key: 'disability',
      section_label: 'Disability Status',
      section_description: 'Information about any disabilities',
      max_score: 25,
      fields: [
        {
          field_key: 'has_disability',
          field_type: 'radio',
          label: 'Has Disability?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
          scoring_rules: [
            { condition: 'yes', score: 25 },
            { condition: 'no', score: 0 },
          ],
        },
        {
          field_key: 'disability_type',
          field_type: 'text',
          label: 'Disability Type',
          required: true,
          placeholder: 'e.g. Physical, Visual, Hearing',
          conditional_on: { field_key: 'has_disability', value: 'yes' },
        },
        {
          field_key: 'disability_document',
          field_type: 'file',
          label: 'Disability Supporting Document',
          required: true,
          help_text: 'Upload medical certificate or disability ID',
          conditional_on: { field_key: 'has_disability', value: 'yes' },
          document_accepted_formats: DOC_FORMATS,
        },
      ],
    },
    {
      section_key: 'bank_statement',
      section_label: 'Bank Statement',
      section_description: 'Bank account financial activity',
      max_score: 20,
      fields: [
        {
          field_key: 'bank_name',
          field_type: 'text',
          label: 'Bank Name',
          required: true,
          placeholder: 'e.g. Commercial Bank of Ethiopia',
        },
        {
          field_key: 'bank_statement_file',
          field_type: 'file',
          label: 'Bank Statement Upload',
          required: true,
          help_text: 'Statement must cover the last 6 months',
          document_accepted_formats: DOC_FORMATS,
        },
        {
          field_key: 'statement_period',
          field_type: 'text',
          label: 'Statement Period',
          required: true,
          placeholder: 'e.g. Jan 2026 – Jun 2026',
          help_text: 'Must cover at least the last 6 months',
        },
        {
          field_key: 'financial_activity',
          field_type: 'select',
          label: 'Financial Activity Level',
          required: true,
          options: [
            opt('Very low activity (limited transactions)', 'very_low'),
            opt('Moderate activity (regular transactions)', 'moderate'),
            opt('High activity (frequent transactions)', 'high'),
          ],
          scoring_rules: [
            { condition: 'very_low', score: 20 },
            { condition: 'moderate', score: 10 },
            { condition: 'high', score: 0 },
          ],
        },
      ],
    },
    {
      section_key: 'health',
      section_label: 'Health Condition',
      section_description: 'Information about the applicant\'s health status',
      max_score: 30,
      fields: [
        {
          field_key: 'has_health_condition',
          field_type: 'radio',
          label: 'Has Health Condition?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
          scoring_rules: [
            { condition: 'yes', score: null },
            { condition: 'no', score: 0 },
          ],
        },
        {
          field_key: 'health_condition_type',
          field_type: 'select',
          label: 'Health Condition Severity',
          required: true,
          options: [
            opt('Critical condition', 'critical'),
            opt('Chronic condition', 'chronic'),
            opt('Minor condition', 'minor'),
          ],
          scoring_rules: [
            { condition: 'critical', score: 30 },
            { condition: 'chronic', score: 20 },
            { condition: 'minor', score: 10 },
          ],
          conditional_on: { field_key: 'has_health_condition', value: 'yes' },
        },
        {
          field_key: 'health_description',
          field_type: 'textarea',
          label: 'Health Condition Description',
          required: true,
          placeholder: 'Describe the health condition in detail',
          conditional_on: { field_key: 'has_health_condition', value: 'yes' },
        },
        {
          field_key: 'hospital_name',
          field_type: 'text',
          label: 'Hospital / Clinic Name',
          required: true,
          placeholder: 'Name of treating hospital or clinic',
          conditional_on: { field_key: 'has_health_condition', value: 'yes' },
        },
        {
          field_key: 'medical_proof',
          field_type: 'file',
          label: 'Medical Proof Document',
          required: true,
          help_text: 'Upload medical report, prescription, or doctor\'s letter',
          conditional_on: { field_key: 'has_health_condition', value: 'yes' },
          document_accepted_formats: DOC_FORMATS,
        },
      ],
    },
  ],
};

// ================================================================
// 2. GOVERNMENT — Citizen Support Verification
// ================================================================
const governmentForm: OrgFormDefinition = {
  orgType: 'government',
  sections: [
    {
      section_key: 'household',
      section_label: 'Household & Family Status',
      section_description: 'Information about the household composition',
      max_score: 20,
      fields: [
        {
          field_key: 'household_size',
          field_type: 'select',
          label: 'Household Size',
          required: true,
          options: [
            opt('1-2 members', '1-2'),
            opt('3-4 members', '3-4'),
            opt('5-6 members', '5-6'),
            opt('7+ members', '7_plus'),
          ],
          scoring_rules: [
            { condition: '7_plus', score: 20 },
            { condition: '5-6', score: 15 },
            { condition: '3-4', score: 10 },
            { condition: '1-2', score: 5 },
          ],
        },
        {
          field_key: 'dependents_count',
          field_type: 'select',
          label: 'Number of Dependents',
          required: true,
          options: [
            opt('None', '0'),
            opt('1-2 dependents', '1-2'),
            opt('3-4 dependents', '3-4'),
            opt('5+ dependents', '5_plus'),
          ],
          scoring_rules: [
            { condition: '5_plus', score: 20 },
            { condition: '3-4', score: 15 },
            { condition: '1-2', score: 10 },
            { condition: '0', score: 0 },
          ],
        },
        {
          field_key: 'head_of_household',
          field_type: 'select',
          label: 'Head of Household Status',
          required: true,
          options: [
            opt('Both parents present', 'both'),
            opt('Single parent', 'single'),
            opt('Orphan (no parents)', 'orphan'),
            opt('Elderly-led household', 'elderly'),
          ],
          scoring_rules: [
            { condition: 'orphan', score: 20 },
            { condition: 'elderly', score: 15 },
            { condition: 'single', score: 10 },
            { condition: 'both', score: 0 },
          ],
        },
      ],
    },
    {
      section_key: 'income',
      section_label: 'Income & Employment Status',
      section_description: 'Household income and employment information',
      max_score: 25,
      fields: [
        {
          field_key: 'monthly_income',
          field_type: 'select',
          label: 'Monthly Household Income (ETB)',
          required: true,
          options: [
            opt('Below 1,000 ETB', 'below_1000'),
            opt('1,000 – 3,000 ETB', '1000_3000'),
            opt('3,000 – 7,000 ETB', '3000_7000'),
            opt('7,000 – 15,000 ETB', '7000_15000'),
            opt('Above 15,000 ETB', 'above_15000'),
          ],
          scoring_rules: [
            { condition: 'below_1000', score: 25 },
            { condition: '1000_3000', score: 20 },
            { condition: '3000_7000', score: 10 },
            { condition: '7000_15000', score: 5 },
            { condition: 'above_15000', score: 0 },
          ],
        },
        {
          field_key: 'employment_status',
          field_type: 'select',
          label: 'Employment Status',
          required: true,
          options: [
            opt('Unemployed', 'unemployed'),
            opt('Daily laborer', 'daily_labor'),
            opt('Part-time employed', 'part_time'),
            opt('Full-time employed', 'full_time'),
            opt('Retired', 'retired'),
          ],
        },
        {
          field_key: 'income_proof',
          field_type: 'file',
          label: 'Income Proof Document',
          help_text: 'Upload proof of income or unemployment certificate',
          document_accepted_formats: DOC_FORMATS,
        },
      ],
    },
    {
      section_key: 'disability',
      section_label: 'Disability Status',
      section_description: 'Disability information',
      max_score: 25,
      fields: [
        {
          field_key: 'has_disability',
          field_type: 'radio',
          label: 'Has Disability?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
          scoring_rules: [
            { condition: 'yes', score: 25 },
            { condition: 'no', score: 0 },
          ],
        },
        {
          field_key: 'disability_type',
          field_type: 'text',
          label: 'Disability Type',
          required: true,
          placeholder: 'e.g. Physical, Visual, Hearing',
          conditional_on: { field_key: 'has_disability', value: 'yes' },
        },
        {
          field_key: 'disability_document',
          field_type: 'file',
          label: 'Disability Certificate',
          required: true,
          conditional_on: { field_key: 'has_disability', value: 'yes' },
          document_accepted_formats: DOC_FORMATS,
        },
      ],
    },
    {
      section_key: 'health',
      section_label: 'Health Condition',
      section_description: 'Health status of household members',
      max_score: 30,
      fields: [
        {
          field_key: 'has_health_condition',
          field_type: 'radio',
          label: 'Has Chronic Health Condition?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
          scoring_rules: [
            { condition: 'yes', score: null },
            { condition: 'no', score: 0 },
          ],
        },
        {
          field_key: 'health_severity',
          field_type: 'select',
          label: 'Health Condition Severity',
          required: true,
          options: [
            opt('Critical / Life-threatening', 'critical'),
            opt('Chronic (long-term)', 'chronic'),
            opt('Minor (short-term)', 'minor'),
          ],
          scoring_rules: [
            { condition: 'critical', score: 30 },
            { condition: 'chronic', score: 20 },
            { condition: 'minor', score: 10 },
          ],
          conditional_on: { field_key: 'has_health_condition', value: 'yes' },
        },
        {
          field_key: 'medical_document',
          field_type: 'file',
          label: 'Medical Document',
          required: true,
          conditional_on: { field_key: 'has_health_condition', value: 'yes' },
          document_accepted_formats: DOC_FORMATS,
        },
      ],
    },
    {
      section_key: 'residency',
      section_label: 'Residency Status',
      section_description: 'Proof of residency',
      max_score: 10,
      fields: [
        {
          field_key: 'residency_type',
          field_type: 'select',
          label: 'Residency Type',
          required: true,
          options: [
            opt('Displaced / Refugee', 'displaced'),
            opt('Rural low-income area', 'rural_low'),
            opt('Urban low-income area', 'urban_low'),
            opt('Permanent resident', 'permanent'),
          ],
          scoring_rules: [
            { condition: 'displaced', score: 10 },
            { condition: 'rural_low', score: 7 },
            { condition: 'urban_low', score: 5 },
            { condition: 'permanent', score: 0 },
          ],
        },
        {
          field_key: 'residency_region',
          field_type: 'text',
          label: 'Region / Zone',
          required: true,
          placeholder: 'e.g. Oromia, Amhara, SNNPR',
        },
        {
          field_key: 'residency_woreda',
          field_type: 'text',
          label: 'Woreda / District',
          required: true,
          placeholder: 'Woreda name',
        },
        {
          field_key: 'residency_document',
          field_type: 'file',
          label: 'Residency Proof (Optional)',
          document_accepted_formats: DOC_FORMATS,
        },
      ],
    },
  ],
};

// ================================================================
// 3. HOSPITAL — Medical Support Verification
// ================================================================
const hospitalForm: OrgFormDefinition = {
  orgType: 'hospital',
  sections: [
    {
      section_key: 'patient_condition',
      section_label: 'Patient Condition',
      section_description: 'Details about the patient\'s medical condition',
      max_score: 30,
      fields: [
        {
          field_key: 'condition_severity',
          field_type: 'select',
          label: 'Condition Severity',
          required: true,
          options: [
            opt('Critical / Emergency', 'critical'),
            opt('Chronic (long-term treatment needed)', 'chronic'),
            opt('Moderate (regular treatment)', 'moderate'),
            opt('Minor (one-time treatment)', 'minor'),
          ],
          scoring_rules: [
            { condition: 'critical', score: 30 },
            { condition: 'chronic', score: 25 },
            { condition: 'moderate', score: 15 },
            { condition: 'minor', score: 5 },
          ],
        },
        {
          field_key: 'diagnosis',
          field_type: 'textarea',
          label: 'Diagnosis / Medical Condition',
          required: true,
          placeholder: 'Describe the diagnosed condition',
        },
        {
          field_key: 'treatment_required',
          field_type: 'textarea',
          label: 'Required Treatment',
          required: true,
          placeholder: 'Describe the treatment or procedure needed',
        },
        {
          field_key: 'estimated_cost',
          field_type: 'number',
          label: 'Estimated Treatment Cost (ETB)',
          required: true,
          placeholder: 'e.g. 50000',
        },
        {
          field_key: 'medical_reports',
          field_type: 'file',
          label: 'Medical Reports',
          required: true,
          help_text: 'Upload doctor\'s letter, test results, and medical reports',
          document_accepted_formats: DOC_FORMATS,
        },
      ],
    },
    {
      section_key: 'financial',
      section_label: 'Financial Status',
      section_description: 'Patient/family financial situation',
      max_score: 30,
      fields: [
        {
          field_key: 'monthly_income',
          field_type: 'select',
          label: 'Monthly Household Income (ETB)',
          required: true,
          options: [
            opt('Below 1,000 ETB', 'below_1000'),
            opt('1,000 – 3,000 ETB', '1000_3000'),
            opt('3,000 – 7,000 ETB', '3000_7000'),
            opt('7,000 – 15,000 ETB', '7000_15000'),
            opt('Above 15,000 ETB', 'above_15000'),
          ],
          scoring_rules: [
            { condition: 'below_1000', score: 30 },
            { condition: '1000_3000', score: 25 },
            { condition: '3000_7000', score: 15 },
            { condition: '7000_15000', score: 10 },
            { condition: 'above_15000', score: 0 },
          ],
        },
        {
          field_key: 'insurance_status',
          field_type: 'select',
          label: 'Health Insurance Status',
          required: true,
          options: [
            opt('No insurance', 'none'),
            opt('Partial (covers <50%)', 'partial'),
            opt('Good (covers 50-80%)', 'good'),
            opt('Comprehensive (covers >80%)', 'comprehensive'),
          ],
        },
        {
          field_key: 'ability_to_pay',
          field_type: 'select',
          label: 'Ability to Pay for Treatment',
          required: true,
          options: [
            opt('Cannot pay at all', 'cannot'),
            opt('Can pay partially (<25%)', 'partial_25'),
            opt('Can pay half (50%)', 'half'),
            opt('Can pay most (>75%)', 'most'),
          ],
          scoring_rules: [
            { condition: 'cannot', score: 30 },
            { condition: 'partial_25', score: 20 },
            { condition: 'half', score: 10 },
            { condition: 'most', score: 0 },
          ],
        },
      ],
    },
    {
      section_key: 'special_factors',
      section_label: 'Special Factors',
      section_description: 'Additional vulnerability factors',
      max_score: 25,
      fields: [
        {
          field_key: 'is_disabled',
          field_type: 'radio',
          label: 'Patient Has Disability?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
          scoring_rules: [
            { condition: 'yes', score: 15 },
            { condition: 'no', score: 0 },
          ],
        },
        {
          field_key: 'is_minor_or_elderly',
          field_type: 'radio',
          label: 'Is Patient a Minor (under 18) or Elderly (over 65)?',
          required: true,
          options: [opt('Yes – Minor', 'minor'), opt('Yes – Elderly', 'elderly'), opt('No', 'no')],
          scoring_rules: [
            { condition: 'minor', score: 10 },
            { condition: 'elderly', score: 10 },
            { condition: 'no', score: 0 },
          ],
        },
      ],
    },
    {
      section_key: 'documents',
      section_label: 'Supporting Documents',
      section_description: 'Additional supporting documentation',
      max_score: 15,
      fields: [
        {
          field_key: 'referral_letter',
          field_type: 'file',
          label: 'Referral Letter (if applicable)',
          document_accepted_formats: DOC_FORMATS,
        },
        {
          field_key: 'additional_docs',
          field_type: 'file',
          label: 'Additional Supporting Documents',
          document_accepted_formats: DOC_FORMATS,
        },
      ],
    },
  ],
};

// ================================================================
// 4. SCHOOL — Scholarship / Support Verification
// ================================================================
const schoolForm: OrgFormDefinition = {
  orgType: 'school',
  sections: [
    {
      section_key: 'family_background',
      section_label: 'Family Background',
      section_description: 'Information about the student\'s family',
      max_score: 20,
      fields: [
        {
          field_key: 'parent_status',
          field_type: 'select',
          label: 'Parent Status',
          required: true,
          options: [
            opt('Both parents alive', 'both_alive'),
            opt('Single parent', 'single'),
            opt('Orphan (both deceased)', 'orphan'),
            opt('Living with guardian', 'guardian'),
          ],
          scoring_rules: [
            { condition: 'orphan', score: 20 },
            { condition: 'single', score: 15 },
            { condition: 'guardian', score: 10 },
            { condition: 'both_alive', score: 0 },
          ],
        },
        {
          field_key: 'siblings_in_school',
          field_type: 'select',
          label: 'Number of Siblings in School',
          required: true,
          options: [
            opt('None', '0'),
            opt('1 sibling', '1'),
            opt('2 siblings', '2'),
            opt('3 or more siblings', '3_plus'),
          ],
          scoring_rules: [
            { condition: '3_plus', score: 15 },
            { condition: '2', score: 10 },
            { condition: '1', score: 5 },
            { condition: '0', score: 0 },
          ],
        },
      ],
    },
    {
      section_key: 'academic',
      section_label: 'Academic Status',
      section_description: 'Student academic information',
      max_score: 10,
      fields: [
        {
          field_key: 'grade_level',
          field_type: 'text',
          label: 'Grade / Class Level',
          required: true,
          placeholder: 'e.g. Grade 8, Year 2, Form 4',
        },
        {
          field_key: 'academic_performance',
          field_type: 'select',
          label: 'Academic Performance',
          required: true,
          options: [
            opt('Excellent (top 10%)', 'excellent'),
            opt('Good (above average)', 'good'),
            opt('Average', 'average'),
            opt('Below average', 'below_average'),
          ],
          scoring_rules: [
            { condition: 'excellent', score: 10 },
            { condition: 'good', score: 7 },
            { condition: 'average', score: 5 },
            { condition: 'below_average', score: 0 },
          ],
        },
        {
          field_key: 'report_card',
          field_type: 'file',
          label: 'Recent Report Card',
          required: true,
          help_text: 'Upload the most recent academic report',
          document_accepted_formats: DOC_FORMATS,
        },
      ],
    },
    {
      section_key: 'financial_need',
      section_label: 'Financial Need',
      section_description: 'Household financial situation',
      max_score: 40,
      fields: [
        {
          field_key: 'guardian_income',
          field_type: 'select',
          label: 'Guardian Monthly Income (ETB)',
          required: true,
          options: [
            opt('Below 1,000 ETB', 'below_1000'),
            opt('1,000 – 3,000 ETB', '1000_3000'),
            opt('3,000 – 7,000 ETB', '3000_7000'),
            opt('7,000 – 15,000 ETB', '7000_15000'),
            opt('Above 15,000 ETB', 'above_15000'),
          ],
          scoring_rules: [
            { condition: 'below_1000', score: 40 },
            { condition: '1000_3000', score: 30 },
            { condition: '3000_7000', score: 20 },
            { condition: '7000_15000', score: 10 },
            { condition: 'above_15000', score: 0 },
          ],
        },
        {
          field_key: 'guardian_employment',
          field_type: 'select',
          label: 'Guardian Employment Status',
          required: true,
          options: [
            opt('Unemployed', 'unemployed'),
            opt('Daily laborer', 'daily_labor'),
            opt('Self-employed (small business)', 'self_employed'),
            opt('Formally employed', 'formally_employed'),
          ],
          scoring_rules: [
            { condition: 'unemployed', score: 25 },
            { condition: 'daily_labor', score: 20 },
            { condition: 'self_employed', score: 10 },
            { condition: 'formally_employed', score: 0 },
          ],
        },
        {
          field_key: 'has_scholarship',
          field_type: 'radio',
          label: 'Currently Receiving Any Scholarship?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
        },
        {
          field_key: 'scholarship_details',
          field_type: 'textarea',
          label: 'Scholarship Details',
          placeholder: 'If yes, provide details',
          conditional_on: { field_key: 'has_scholarship', value: 'yes' },
        },
      ],
    },
    {
      section_key: 'health_disability',
      section_label: 'Health & Disability',
      section_description: 'Health and disability information',
      max_score: 30,
      fields: [
        {
          field_key: 'has_disability',
          field_type: 'radio',
          label: 'Student Has Disability?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
          scoring_rules: [
            { condition: 'yes', score: 20 },
            { condition: 'no', score: 0 },
          ],
        },
        {
          field_key: 'disability_document',
          field_type: 'file',
          label: 'Disability Supporting Document',
          required: true,
          conditional_on: { field_key: 'has_disability', value: 'yes' },
          document_accepted_formats: DOC_FORMATS,
        },
        {
          field_key: 'has_chronic_illness',
          field_type: 'radio',
          label: 'Student Has Chronic Illness?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
          scoring_rules: [
            { condition: 'yes', score: 10 },
            { condition: 'no', score: 0 },
          ],
        },
        {
          field_key: 'medical_certificate',
          field_type: 'file',
          label: 'Medical Certificate',
          required: true,
          conditional_on: { field_key: 'has_chronic_illness', value: 'yes' },
          document_accepted_formats: DOC_FORMATS,
        },
      ],
    },
  ],
};

// ================================================================
// 5. NGO — Community Support Verification
// ================================================================
const ngoForm: OrgFormDefinition = {
  orgType: 'ngo',
  sections: [
    {
      section_key: 'family_composition',
      section_label: 'Family Composition',
      section_description: 'Household family structure',
      max_score: 20,
      fields: [
        {
          field_key: 'family_type',
          field_type: 'select',
          label: 'Family Type',
          required: true,
          options: [
            opt('Two-parent family', 'two_parent'),
            opt('Single-parent family', 'single_parent'),
            opt('Child-headed household', 'child_headed'),
            opt('Elderly-headed household', 'elderly_headed'),
            opt('Orphanage / group home', 'group_home'),
          ],
          scoring_rules: [
            { condition: 'child_headed', score: 20 },
            { condition: 'group_home', score: 18 },
            { condition: 'elderly_headed', score: 15 },
            { condition: 'single_parent', score: 10 },
            { condition: 'two_parent', score: 0 },
          ],
        },
        {
          field_key: 'household_size',
          field_type: 'select',
          label: 'Household Size',
          required: true,
          options: [
            opt('1-2 members', '1-2'),
            opt('3-4 members', '3-4'),
            opt('5-6 members', '5-6'),
            opt('7+ members', '7_plus'),
          ],
          scoring_rules: [
            { condition: '7_plus', score: 20 },
            { condition: '5-6', score: 15 },
            { condition: '3-4', score: 10 },
            { condition: '1-2', score: 5 },
          ],
        },
        {
          field_key: 'dependents',
          field_type: 'select',
          label: 'Number of Dependents',
          required: true,
          options: [
            opt('None', '0'),
            opt('1-2 dependents', '1-2'),
            opt('3-4 dependents', '3-4'),
            opt('5+ dependents', '5_plus'),
          ],
          scoring_rules: [
            { condition: '5_plus', score: 20 },
            { condition: '3-4', score: 15 },
            { condition: '1-2', score: 10 },
            { condition: '0', score: 0 },
          ],
        },
      ],
    },
    {
      section_key: 'economic',
      section_label: 'Economic Status',
      section_description: 'Economic and livelihood assessment',
      max_score: 30,
      fields: [
        {
          field_key: 'monthly_income',
          field_type: 'select',
          label: 'Monthly Household Income (ETB)',
          required: true,
          options: [
            opt('Below 500 ETB', 'below_500'),
            opt('500 – 2,000 ETB', '500_2000'),
            opt('2,000 – 5,000 ETB', '2000_5000'),
            opt('5,000 – 10,000 ETB', '5000_10000'),
            opt('Above 10,000 ETB', 'above_10000'),
          ],
          scoring_rules: [
            { condition: 'below_500', score: 30 },
            { condition: '500_2000', score: 25 },
            { condition: '2000_5000', score: 15 },
            { condition: '5000_10000', score: 10 },
            { condition: 'above_10000', score: 0 },
          ],
        },
        {
          field_key: 'livelihood_source',
          field_type: 'select',
          label: 'Primary Livelihood Source',
          required: true,
          options: [
            opt('No income / charity dependent', 'none'),
            opt('Daily labor', 'daily_labor'),
            opt('Small-scale farming', 'farming'),
            opt('Small business / trade', 'small_business'),
            opt('Formal employment', 'formal'),
          ],
          scoring_rules: [
            { condition: 'none', score: 25 },
            { condition: 'daily_labor', score: 20 },
            { condition: 'farming', score: 15 },
            { condition: 'small_business', score: 10 },
            { condition: 'formal', score: 0 },
          ],
        },
        {
          field_key: 'food_security',
          field_type: 'select',
          label: 'Food Security Status',
          required: true,
          options: [
            opt('Severe food insecurity', 'severe'),
            opt('Moderate food insecurity', 'moderate'),
            opt('Food secure', 'secure'),
          ],
          scoring_rules: [
            { condition: 'severe', score: 20 },
            { condition: 'moderate', score: 10 },
            { condition: 'secure', score: 0 },
          ],
        },
      ],
    },
    {
      section_key: 'housing',
      section_label: 'Housing Condition',
      section_description: 'Current housing and living conditions',
      max_score: 25,
      fields: [
        {
          field_key: 'housing_type',
          field_type: 'select',
          label: 'Housing Type',
          required: true,
          options: [
            opt('Homeless / no shelter', 'homeless'),
            opt('Temporary shelter / camp', 'temporary'),
            opt('Rented (single room)', 'rented_room'),
            opt('Rented (house/apartment)', 'rented_house'),
            opt('Own home', 'own'),
          ],
          scoring_rules: [
            { condition: 'homeless', score: 25 },
            { condition: 'temporary', score: 20 },
            { condition: 'rented_room', score: 15 },
            { condition: 'rented_house', score: 10 },
            { condition: 'own', score: 0 },
          ],
        },
        {
          field_key: 'access_to_water',
          field_type: 'radio',
          label: 'Access to Clean Water?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
        },
        {
          field_key: 'access_to_electricity',
          field_type: 'radio',
          label: 'Access to Electricity?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
        },
      ],
    },
    {
      section_key: 'health',
      section_label: 'Health & Disability',
      section_description: 'Health and disability status',
      max_score: 25,
      fields: [
        {
          field_key: 'has_disability',
          field_type: 'radio',
          label: 'Any Household Member Has Disability?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
          scoring_rules: [
            { condition: 'yes', score: 15 },
            { condition: 'no', score: 0 },
          ],
        },
        {
          field_key: 'has_chronic_illness',
          field_type: 'radio',
          label: 'Any Household Member Has Chronic Illness?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
          scoring_rules: [
            { condition: 'yes', score: 10 },
            { condition: 'no', score: 0 },
          ],
        },
        {
          field_key: 'supporting_docs',
          field_type: 'file',
          label: 'Supporting Documents',
          help_text: 'Upload any relevant supporting documents',
          document_accepted_formats: DOC_FORMATS,
        },
      ],
    },
  ],
};

// ================================================================
// 6. COMPANY — Employee/Community Assistance Verification
// ================================================================
const companyForm: OrgFormDefinition = {
  orgType: 'company',
  sections: [
    {
      section_key: 'employment',
      section_label: 'Employment Status',
      section_description: 'Current employment situation',
      max_score: 15,
      fields: [
        {
          field_key: 'employment_type',
          field_type: 'select',
          label: 'Employment Type',
          required: true,
          options: [
            opt('Unemployed / seeking work', 'unemployed'),
            opt('Daily / contract worker', 'contract'),
            opt('Part-time employee', 'part_time'),
            opt('Full-time employee', 'full_time'),
            opt('Self-employed', 'self_employed'),
          ],
          scoring_rules: [
            { condition: 'unemployed', score: 15 },
            { condition: 'contract', score: 12 },
            { condition: 'part_time', score: 8 },
            { condition: 'self_employed', score: 5 },
            { condition: 'full_time', score: 0 },
          ],
        },
        {
          field_key: 'employer_name',
          field_type: 'text',
          label: 'Employer / Company Name',
          placeholder: 'Current or last employer',
        },
        {
          field_key: 'job_position',
          field_type: 'text',
          label: 'Job Position / Role',
          placeholder: 'e.g. Security guard, cleaner, operator',
        },
        {
          field_key: 'months_unemployed',
          field_type: 'select',
          label: 'If Unemployed, Duration',
          options: [
            opt('Less than 3 months', 'less_3'),
            opt('3-6 months', '3_6'),
            opt('6-12 months', '6_12'),
            opt('Over 1 year', 'over_1yr'),
          ],
          scoring_rules: [
            { condition: 'over_1yr', score: 15 },
            { condition: '6_12', score: 12 },
            { condition: '3_6', score: 8 },
            { condition: 'less_3', score: 5 },
          ],
        },
      ],
    },
    {
      section_key: 'financial',
      section_label: 'Financial Need',
      section_description: 'Current financial circumstances',
      max_score: 35,
      fields: [
        {
          field_key: 'monthly_income',
          field_type: 'select',
          label: 'Monthly Income (ETB)',
          required: true,
          options: [
            opt('Below 1,000 ETB', 'below_1000'),
            opt('1,000 – 3,000 ETB', '1000_3000'),
            opt('3,000 – 7,000 ETB', '3000_7000'),
            opt('7,000 – 15,000 ETB', '7000_15000'),
            opt('Above 15,000 ETB', 'above_15000'),
          ],
          scoring_rules: [
            { condition: 'below_1000', score: 35 },
            { condition: '1000_3000', score: 25 },
            { condition: '3000_7000', score: 15 },
            { condition: '7000_15000', score: 10 },
            { condition: 'above_15000', score: 0 },
          ],
        },
        {
          field_key: 'financial_distress',
          field_type: 'select',
          label: 'Current Financial Distress Level',
          required: true,
          options: [
            opt('Severe (cannot meet basic needs)', 'severe'),
            opt('Moderate (struggling with bills)', 'moderate'),
            opt('Mild (some financial strain)', 'mild'),
            opt('Stable (no distress)', 'stable'),
          ],
          scoring_rules: [
            { condition: 'severe', score: 30 },
            { condition: 'moderate', score: 20 },
            { condition: 'mild', score: 10 },
            { condition: 'stable', score: 0 },
          ],
        },
        {
          field_key: 'assistance_purpose',
          field_type: 'textarea',
          label: 'Purpose of Assistance',
          required: true,
          placeholder: 'What specific help is needed and why?',
        },
      ],
    },
    {
      section_key: 'dependents',
      section_label: 'Family Dependents',
      section_description: 'Information about dependents',
      max_score: 25,
      fields: [
        {
          field_key: 'dependents_count',
          field_type: 'select',
          label: 'Number of Dependents',
          required: true,
          options: [
            opt('None', '0'),
            opt('1-2 dependents', '1-2'),
            opt('3-4 dependents', '3-4'),
            opt('5+ dependents', '5_plus'),
          ],
          scoring_rules: [
            { condition: '5_plus', score: 25 },
            { condition: '3-4', score: 20 },
            { condition: '1-2', score: 10 },
            { condition: '0', score: 0 },
          ],
        },
        {
          field_key: 'has_special_needs_dependent',
          field_type: 'radio',
          label: 'Any Dependent with Special Needs / Disability?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
          scoring_rules: [
            { condition: 'yes', score: 15 },
            { condition: 'no', score: 0 },
          ],
        },
        {
          field_key: 'has_elderly_dependent',
          field_type: 'radio',
          label: 'Caring for Elderly Family Member?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
          scoring_rules: [
            { condition: 'yes', score: 10 },
            { condition: 'no', score: 0 },
          ],
        },
      ],
    },
    {
      section_key: 'health',
      section_label: 'Health Condition',
      section_description: 'Health status',
      max_score: 25,
      fields: [
        {
          field_key: 'has_health_condition',
          field_type: 'radio',
          label: 'Has Health Condition?',
          required: true,
          options: [opt('Yes', 'yes'), opt('No', 'no')],
          scoring_rules: [
            { condition: 'yes', score: null },
            { condition: 'no', score: 0 },
          ],
        },
        {
          field_key: 'health_severity',
          field_type: 'select',
          label: 'Health Condition Severity',
          required: true,
          options: [
            opt('Critical / Life-threatening', 'critical'),
            opt('Chronic (long-term)', 'chronic'),
            opt('Minor (short-term)', 'minor'),
          ],
          scoring_rules: [
            { condition: 'critical', score: 25 },
            { condition: 'chronic', score: 15 },
            { condition: 'minor', score: 5 },
          ],
          conditional_on: { field_key: 'has_health_condition', value: 'yes' },
        },
        {
          field_key: 'medical_document',
          field_type: 'file',
          label: 'Medical Document',
          required: true,
          conditional_on: { field_key: 'has_health_condition', value: 'yes' },
          document_accepted_formats: DOC_FORMATS,
        },
        {
          field_key: 'additional_document',
          field_type: 'file',
          label: 'Additional Supporting Document',
          document_accepted_formats: DOC_FORMATS,
        },
      ],
    },
  ],
};

// ================================================================
// Registry of all organization form definitions
// ================================================================
export const FORM_REGISTRY: Record<OrgTypeSlug, OrgFormDefinition> = {
  university: universityForm,
  government: governmentForm,
  hospital: hospitalForm,
  school: schoolForm,
  ngo: ngoForm,
  company: companyForm,
};

export function getFormForOrgType(orgType: OrgTypeSlug): OrgFormDefinition | undefined {
  return FORM_REGISTRY[orgType];
}

export function getAllOrgTypes(): OrgTypeSlug[] {
  return Object.keys(FORM_REGISTRY) as OrgTypeSlug[];
}

export function getMaxTotalScore(orgType: OrgTypeSlug): number {
  const form = FORM_REGISTRY[orgType];
  if (!form) return 100;
  return form.sections.reduce((sum, s) => sum + s.max_score, 0);
}
