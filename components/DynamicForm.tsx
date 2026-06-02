'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, X, AlertCircle, HelpCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { OrgTypeSlug, SubmissionStatus } from '@/lib/types';
import { ORG_TYPE_MAP } from '@/lib/types';
import { FORM_REGISTRY, type SectionConfig, type FieldConfig } from '@/lib/verificationForms';
import { calculateScore } from '@/lib/scoring';

interface DynamicFormProps {
  orgType: OrgTypeSlug;
  companyName: string;
  contactEmail: string;
  onSuccess: () => void;
  onBack: () => void;
}

interface FormErrors {
  [key: string]: string;
}

export default function DynamicForm({ orgType, companyName, contactEmail, onSuccess, onBack }: DynamicFormProps) {
  const formDef = FORM_REGISTRY[orgType];
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});

  if (!formDef) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
        <h3 className="text-lg font-semibold text-slate-900">Form Not Found</h3>
        <p className="text-slate-500 mt-2">No verification form configured for this organization type.</p>
        <button onClick={onBack} className="btn-primary mt-6">Go Back</button>
      </div>
    );
  }

  const setValue = (fieldKey: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldKey]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };

  const handleFileUpload = async (fieldKey: string, file: File) => {
    setUploadingFiles((prev) => ({ ...prev, [fieldKey]: true }));
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `${orgType}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('verification_docs')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('verification_docs')
        .getPublicUrl(filePath);

      setUploadedFiles((prev) => ({ ...prev, [fieldKey]: publicUrl }));
      setValue(fieldKey, publicUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setErrors((prev) => ({ ...prev, [fieldKey]: message }));
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [fieldKey]: false }));
    }
  };

  const removeFile = (fieldKey: string) => {
    setUploadedFiles((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
    setValue(fieldKey, null);
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    for (const section of formDef.sections) {
      for (const field of section.fields) {
        const value = formData[field.field_key] as string | undefined;

        // Check if field should be visible (conditional)
        if (field.conditional_on) {
          const parentValue = formData[field.conditional_on.field_key] as string | undefined;
          const expectedValue = field.conditional_on.value;
          const notInValues = field.conditional_on.not_in;
          let shouldShow = false;

          if (expectedValue !== undefined) {
            shouldShow = parentValue === expectedValue;
          } else if (notInValues !== undefined) {
            shouldShow = parentValue ? !notInValues.includes(parentValue) : false;
          }

          if (!shouldShow) continue;
        }

        if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
          newErrors[field.field_key] = `${field.label} is required`;
        }

        if (value && field.validation_rules) {
          const vr = field.validation_rules;
          if (vr.min_length && typeof value === 'string' && value.length < vr.min_length) {
            newErrors[field.field_key] = `${field.label} must be at least ${vr.min_length} characters`;
          }
          if (vr.pattern && typeof value === 'string') {
            try {
              const regex = new RegExp(vr.pattern);
              if (!regex.test(value)) {
                newErrors[field.field_key] = `${field.label} has an invalid format`;
              }
            } catch {
              // Invalid regex, skip
            }
          }
          if (field.field_type === 'file' && field.required && !value) {
            newErrors[field.field_key] = `${field.label} is required`;
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError('');
    if (!validate()) return;

    // Validate applicant id_number
    const idNumber = (formData.id_number as string) || '';
    if (!idNumber.trim()) {
      setErrors((prev) => ({ ...prev, id_number: 'National ID / Student ID is required' }));
      return;
    }

    // Collect all document URLs
    const documentUrls = Object.values(uploadedFiles).filter(Boolean);

    setLoading(true);
    try {
      const scored = calculateScore(orgType, formData);

      const { error } = await supabase.from('verification_submissions').insert({
        org_type_slug: orgType,
        company_name: companyName,
        company_contact_email: contactEmail,
        applicant_name: formData.applicant_name as string || '',
        applicant_email: formData.applicant_email as string || '',
        applicant_phone: (formData.applicant_phone as string) || null,
        form_data: formData,
        document_urls: documentUrls,
        total_score: scored.totalScore,
        section_scores: scored.sectionScores,
        priority_level: scored.priorityLevel,
        status: 'pending',
      });

      if (error) throw error;
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      setSubmitError(message);
    } finally {
      setLoading(false);
    }
  };

  const isFieldVisible = (field: FieldConfig): boolean => {
    if (!field.conditional_on) return true;
    const parentValue = formData[field.conditional_on.field_key] as string | undefined;
    const expectedValue = field.conditional_on.value;
    const notInValues = field.conditional_on.not_in;

    if (expectedValue !== undefined) return parentValue === expectedValue;
    if (notInValues !== undefined) return parentValue ? !notInValues.includes(parentValue) : false;
    return true;
  };

  const renderField = (field: FieldConfig) => {
    if (!isFieldVisible(field)) return null;

    const value = (formData[field.field_key] as string) || '';
    const error = errors[field.field_key];
    const baseInputClass = `input-field ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`;

    return (
      <div key={field.field_key}>
        <label className="label">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
          {field.help_text && (
            <span className="ml-1.5 group relative inline-flex">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-800 text-white text-xs rounded-lg px-3 py-2 w-56 text-center z-10 shadow-lg">
                {field.help_text}
              </span>
            </span>
          )}
        </label>

        {field.field_type === 'text' || field.field_type === 'email' || field.field_type === 'phone' ? (
          <input
            type={field.field_type === 'email' ? 'email' : 'text'}
            className={baseInputClass}
            placeholder={field.placeholder || ''}
            value={value}
            onChange={(e) => setValue(field.field_key, e.target.value)}
          />
        ) : field.field_type === 'textarea' ? (
          <textarea
            className={`${baseInputClass} resize-none`}
            rows={3}
            placeholder={field.placeholder || ''}
            value={value}
            onChange={(e) => setValue(field.field_key, e.target.value)}
          />
        ) : field.field_type === 'number' ? (
          <input
            type="number"
            className={baseInputClass}
            placeholder={field.placeholder || ''}
            value={value}
            onChange={(e) => setValue(field.field_key, e.target.value ? Number(e.target.value) : '')}
          />
        ) : field.field_type === 'date' ? (
          <input
            type="date"
            className={baseInputClass}
            value={value}
            onChange={(e) => setValue(field.field_key, e.target.value)}
          />
        ) : field.field_type === 'select' ? (
          <select
            className={baseInputClass}
            value={value}
            onChange={(e) => setValue(field.field_key, e.target.value)}
          >
            <option value="">{field.placeholder || 'Select...'}</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : field.field_type === 'radio' ? (
          <div className="flex flex-wrap gap-3">
            {field.options?.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                  value === opt.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name={field.field_key}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={(e) => setValue(field.field_key, e.target.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        ) : field.field_type === 'file' ? (
          <div>
            {uploadedFiles[field.field_key] ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-sm text-emerald-700 truncate flex-1">File uploaded successfully</span>
                <button
                  onClick={() => removeFile(field.field_key)}
                  className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-6 transition-all hover:border-blue-400 hover:bg-blue-50/30 ${uploadingFiles[field.field_key] ? 'opacity-50 pointer-events-none' : 'border-slate-300'}`}>
                <input
                  type="file"
                  accept={field.document_accepted_formats?.map((f) => `.${f}`).join(',')}
                  className="sr-only"
                  disabled={!!uploadingFiles[field.field_key]}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(field.field_key, file);
                  }}
                />
                {uploadingFiles[field.field_key] ? (
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                ) : (
                  <Upload className="h-8 w-8 text-slate-300 mb-2" />
                )}
                <p className="text-sm font-medium text-slate-600">
                  {uploadingFiles[field.field_key] ? 'Uploading...' : 'Click to upload'}
                </p>
                {field.document_accepted_formats && (
                  <p className="text-xs text-slate-400 mt-1">
                    Accepted: {field.document_accepted_formats.join(', ').toUpperCase()}
                  </p>
                )}
              </label>
            )}
          </div>
        ) : null}

        {error && (
          <p className="mt-1.5 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  };

  const renderSection = (section: SectionConfig) => (
    <div key={section.section_key} className="card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{section.section_label}</h3>
          {section.section_description && (
            <p className="text-sm text-slate-500 mt-0.5">{section.section_description}</p>
          )}
        </div>
        <span className="text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-3 py-1">
          Max: {section.max_score} pts
        </span>
      </div>
      <div className="space-y-5">
        {section.fields.map(renderField)}
      </div>
    </div>
  );

  const { icon } = ORG_TYPE_MAP[orgType];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-slate-900">
              {icon} {ORG_TYPE_MAP[orgType].name} Verification
            </h2>
          </div>
          <p className="text-slate-500">
            <span className="font-medium text-slate-700">{companyName}</span> &middot; Fill in the applicant&apos;s verification details
          </p>
        </div>
        <button onClick={onBack} className="btn-secondary text-sm">
          Back
        </button>
      </div>

      {submitError && (
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {submitError}
        </div>
      )}

      {/* Applicant Info Section */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Applicant Information</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Full Name *</label>
            <input
              className={`input-field ${errors.applicant_name ? 'border-red-400' : ''}`}
              placeholder="e.g. Abebe Bekele"
              value={(formData.applicant_name as string) || ''}
              onChange={(e) => setValue('applicant_name', e.target.value)}
            />
            {errors.applicant_name && <p className="mt-1 text-xs text-red-500">{errors.applicant_name}</p>}
          </div>
          <div>
            <label className="label">Email Address *</label>
            <input
              type="email"
              className={`input-field ${errors.applicant_email ? 'border-red-400' : ''}`}
              placeholder="applicant@email.com"
              value={(formData.applicant_email as string) || ''}
              onChange={(e) => setValue('applicant_email', e.target.value)}
            />
            {errors.applicant_email && <p className="mt-1 text-xs text-red-500">{errors.applicant_email}</p>}
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input
              className="input-field"
              placeholder="+251 9XX XXX XXX"
              value={(formData.applicant_phone as string) || ''}
              onChange={(e) => setValue('applicant_phone', e.target.value)}
            />
          </div>
          <div>
            <label className="label">National ID / Student ID *</label>
            <input
              className={`input-field ${errors.id_number ? 'border-red-400' : ''}`}
              placeholder="ID number"
              value={(formData.id_number as string) || ''}
              onChange={(e) => setValue('id_number', e.target.value)}
            />
            {errors.id_number && <p className="mt-1 text-xs text-red-500">{errors.id_number}</p>}
          </div>
        </div>
      </div>

      {/* Dynamic Sections */}
      <div className="space-y-6">
        {formDef.sections.map(renderSection)}
      </div>

      {/* Submit */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary px-8 py-3 text-base"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
          {loading ? 'Submitting...' : 'Submit Verification'}
        </button>
      </div>
    </div>
  );
}
