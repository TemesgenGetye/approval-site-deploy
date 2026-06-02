"use client";

import { supabase } from "@/lib/supabase";
import type { ConditionalOn, FieldOption, FieldType, FormConfig, FormField, FormSection, OrgTypeSlug, ScoringRule, ValidationRules } from "@/lib/types";
import { ORG_TYPES } from "@/lib/types";
import AdminNav from "@/components/AdminNav";
import OrgTypeIcon from "@/components/OrgTypeIcon";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Edit,
  Loader2,
  LogOut,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface ConfigWithRelations extends FormConfig {
  created_at: string;
  sections: SectionWithFields[];
}

interface SectionWithFields extends FormSection {
  fields: FormField[];
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

const FIELD_TYPES: FieldType[] = ["text", "select", "radio", "file", "textarea", "number", "date", "email", "phone"];

let toastId = 0;

const defaultField = (sectionId: string, orderIndex: number): Partial<FormField> => ({
  section_id: sectionId,
  field_key: "",
  field_type: "text",
  label: "",
  placeholder: "",
  help_text: "",
  required: false,
  options: null,
  validation_rules: null,
  scoring_rules: null,
  conditional_on: null,
  document_accepted_formats: null,
  order_index: orderIndex,
});

const defaultSection = (formConfigId: string, orderIndex: number): Partial<FormSection> => ({
  form_config_id: formConfigId,
  section_key: "",
  section_label: "",
  section_description: "",
  order_index: orderIndex,
  max_score: 0,
});

const cloneField = (f: FormField): Partial<FormField> => ({
  ...f,
  options: f.options ? JSON.parse(JSON.stringify(f.options)) : null,
  validation_rules: f.validation_rules ? JSON.parse(JSON.stringify(f.validation_rules)) : null,
  scoring_rules: f.scoring_rules ? JSON.parse(JSON.stringify(f.scoring_rules)) : null,
  conditional_on: f.conditional_on ? JSON.parse(JSON.stringify(f.conditional_on)) : null,
  document_accepted_formats: f.document_accepted_formats ? [...f.document_accepted_formats] : null,
});

const cloneSection = (s: SectionWithFields): Partial<FormSection> => ({
  ...s,
});

const cloneConfig = (c: ConfigWithRelations): Partial<FormConfig> => ({
  org_type_slug: c.org_type_slug,
  version: c.version,
  is_active: c.is_active,
  id: c.id,
});

type ModalMode = "closed" | "field" | "section" | "config";

export default function AdminFormsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<ConfigWithRelations[]>([]);
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>("closed");
  const [editingConfig, setEditingConfig] = useState<Partial<FormConfig> | null>(null);
  const [editingSection, setEditingSection] = useState<Partial<FormSection> | null>(null);
  const [editingField, setEditingField] = useState<Partial<FormField> | null>(null);
  const [parentConfigId, setParentConfigId] = useState<string>("");
  const [parentSectionId, setParentSectionId] = useState<string>("");

  const addToast = (type: "success" | "error", message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  };

  const checkAuth = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/admin/login"); return; }
    fetchConfigs();
  }, [router]);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const loadConfigs = async (showLoader: boolean) => {
    if (showLoader) setLoading(true);
    const { data: configsData } = await supabase
      .from("verification_form_configs")
      .select("*")
      .order("org_type_slug")
      .order("version", { ascending: false });

    const configIds = (configsData || []).map((c) => c.id);
    if (!configIds.length) {
      setConfigs([]);
      if (showLoader) setLoading(false);
      return;
    }

    const { data: allSections } = await supabase
      .from("verification_form_sections")
      .select("*")
      .in("form_config_id", configIds)
      .order("order_index");

    const sectionIds = (allSections || []).map((s) => s.id);
    const { data: allFields } = sectionIds.length
      ? await supabase.from("verification_form_fields").select("*").in("section_id", sectionIds).order("order_index")
      : { data: [] };

    const fieldsBySection: Record<string, FormField[]> = {};
    (allFields || []).forEach((f: any) => {
      if (!fieldsBySection[f.section_id]) fieldsBySection[f.section_id] = [];
      fieldsBySection[f.section_id].push(f);
    });

    const sectionsByConfig: Record<string, SectionWithFields[]> = {};
    (allSections || []).forEach((s: any) => {
      if (!sectionsByConfig[s.form_config_id]) sectionsByConfig[s.form_config_id] = [];
      sectionsByConfig[s.form_config_id].push({ ...s, fields: fieldsBySection[s.id] || [] });
    });

    const fullConfigs: ConfigWithRelations[] = (configsData || []).map((config) => ({
      ...config,
      sections: sectionsByConfig[config.id] || [],
    }));

    setConfigs(fullConfigs);
    if (showLoader) setLoading(false);
  };

  const fetchConfigs = () => loadConfigs(true);
  const refreshConfigs = () => loadConfigs(false);

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push("/admin/login"); };

  // ── Config CRUD ──
  const openNewConfig = () => { setEditingConfig({ is_active: true, version: 1 } as any); setModalMode("config"); };
  const openEditConfig = (cfg: ConfigWithRelations) => { setEditingConfig(cloneConfig(cfg)); setModalMode("config"); };

  const saveConfig = async () => {
    if (!editingConfig) return;
    setSaving(true);
    try {
      if (editingConfig.id) {
        await supabase.from("verification_form_configs").update({
          org_type_slug: editingConfig.org_type_slug,
          version: editingConfig.version,
          is_active: editingConfig.is_active,
        }).eq("id", editingConfig.id);
      } else {
        await supabase.from("verification_form_configs").insert({
          org_type_slug: editingConfig.org_type_slug,
          version: editingConfig.version || 1,
          is_active: editingConfig.is_active ?? true,
        });
      }
      setModalMode("closed");
      addToast("success", editingConfig.id ? "Form config updated" : "Form config created");
      await refreshConfigs();
    } catch (err: any) { addToast("error", err.message); }
    finally { setSaving(false); }
  };

  const deleteConfig = async (id: string) => {
    if (!confirm("Delete this entire form config and all its sections/fields?")) return;
    setSaving(true);
    try {
      const { data: sections } = await supabase.from("verification_form_sections").select("id").eq("form_config_id", id);
      if (sections) {
        for (const s of sections) {
          await supabase.from("verification_form_fields").delete().eq("section_id", s.id);
        }
        await supabase.from("verification_form_sections").delete().eq("form_config_id", id);
      }
      await supabase.from("verification_form_configs").delete().eq("id", id);
      addToast("success", "Form config deleted");
      await refreshConfigs();
    } catch (err: any) { addToast("error", err.message); }
    finally { setSaving(false); }
  };

  // ── Section CRUD ──
  const openNewSection = (configId: string) => {
    const cfg = configs.find((c) => c.id === configId);
    const nextOrder = cfg ? cfg.sections.length : 0;
    setParentConfigId(configId);
    setEditingSection(defaultSection(configId, nextOrder));
    setModalMode("section");
  };

  const openEditSection = (s: SectionWithFields) => {
    setParentConfigId(s.form_config_id);
    setEditingSection(cloneSection(s));
    setModalMode("section");
  };

  const saveSection = async () => {
    if (!editingSection || !parentConfigId) return;
    setSaving(true);
    try {
      if (editingSection.id) {
        await supabase.from("verification_form_sections").update({
          section_key: editingSection.section_key,
          section_label: editingSection.section_label,
          section_description: editingSection.section_description,
          order_index: editingSection.order_index,
          max_score: editingSection.max_score,
        }).eq("id", editingSection.id);
      } else {
        await supabase.from("verification_form_sections").insert({
          form_config_id: parentConfigId,
          section_key: editingSection.section_key,
          section_label: editingSection.section_label,
          section_description: editingSection.section_description,
          order_index: editingSection.order_index ?? 0,
          max_score: editingSection.max_score ?? 0,
        });
      }
      setModalMode("closed");
      addToast("success", editingSection.id ? "Section updated" : "Section created");
      await refreshConfigs();
    } catch (err: any) { addToast("error", err.message); }
    finally { setSaving(false); }
  };

  const deleteSection = async (id: string) => {
    if (!confirm("Delete this section and all its fields?")) return;
    setSaving(true);
    try {
      await supabase.from("verification_form_fields").delete().eq("section_id", id);
      await supabase.from("verification_form_sections").delete().eq("id", id);
      addToast("success", "Section deleted");
      await refreshConfigs();
    } catch (err: any) { addToast("error", err.message); }
    finally { setSaving(false); }
  };

  const moveSection = async (sectionId: string, direction: "up" | "down") => {
    const cfg = configs.find((c) => c.sections.some((s) => s.id === sectionId));
    if (!cfg) return;
    const idx = cfg.sections.findIndex((s) => s.id === sectionId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= cfg.sections.length) return;
    const s1 = cfg.sections[idx];
    const s2 = cfg.sections[swapIdx];
    await supabase.from("verification_form_sections").update({ order_index: s2.order_index }).eq("id", s1.id);
    await supabase.from("verification_form_sections").update({ order_index: s1.order_index }).eq("id", s2.id);
    await refreshConfigs();
  };

  // ── Field CRUD ──
  const openNewField = (sectionId: string) => {
    const cfg = configs.find((c) => c.sections.some((s) => s.id === sectionId));
    const sec = cfg?.sections.find((s) => s.id === sectionId);
    const nextOrder = sec ? sec.fields.length : 0;
    setParentSectionId(sectionId);
    setEditingField(defaultField(sectionId, nextOrder));
    setModalMode("field");
  };

  const openEditField = (f: FormField) => {
    setParentSectionId(f.section_id);
    setEditingField(cloneField(f));
    setModalMode("field");
  };

  const saveField = async () => {
    if (!editingField || !parentSectionId) return;
    setSaving(true);
    try {
      const payload: any = {
        field_key: editingField.field_key,
        field_type: editingField.field_type,
        label: editingField.label,
        placeholder: editingField.placeholder || null,
        help_text: editingField.help_text || null,
        required: editingField.required ?? false,
        options: editingField.options || null,
        validation_rules: editingField.validation_rules || null,
        scoring_rules: editingField.scoring_rules || null,
        conditional_on: editingField.conditional_on || null,
        document_accepted_formats: editingField.document_accepted_formats || null,
        order_index: editingField.order_index ?? 0,
      };
      if (editingField.id) {
        await supabase.from("verification_form_fields").update(payload).eq("id", editingField.id);
      } else {
        await supabase.from("verification_form_fields").insert({ ...payload, section_id: parentSectionId });
      }
      setModalMode("closed");
      addToast("success", editingField.id ? "Field updated" : "Field created");
      await refreshConfigs();
    } catch (err: any) { addToast("error", err.message); }
    finally { setSaving(false); }
  };

  const deleteField = async (id: string) => {
    if (!confirm("Delete this field?")) return;
    setSaving(true);
    try {
      await supabase.from("verification_form_fields").delete().eq("id", id);
      addToast("success", "Field deleted");
      await refreshConfigs();
    } catch (err: any) { addToast("error", err.message); }
    finally { setSaving(false); }
  };

  const moveField = async (fieldId: string, direction: "up" | "down") => {
    let foundSection: SectionWithFields | undefined;
    for (const cfg of configs) {
      const sec = cfg.sections.find((s) => s.fields.some((f) => f.id === fieldId));
      if (sec) { foundSection = sec; break; }
    }
    if (!foundSection) return;
    const idx = foundSection.fields.findIndex((f) => f.id === fieldId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= foundSection.fields.length) return;
    const f1 = foundSection.fields[idx];
    const f2 = foundSection.fields[swapIdx];
    await supabase.from("verification_form_fields").update({ order_index: f2.order_index }).eq("id", f1.id);
    await supabase.from("verification_form_fields").update({ order_index: f1.order_index }).eq("id", f2.id);
    await refreshConfigs();
  };

  const duplicateField = async (f: FormField) => {
    setSaving(true);
    try {
      const { id, ...rest } = f;
      const sec = configs.flatMap((c) => c.sections).find((s) => s.fields.some((x) => x.id === f.id));
      const nextOrder = sec ? sec.fields.length : 0;
      await supabase.from("verification_form_fields").insert({
        ...rest,
        field_key: rest.field_key + "_copy",
        label: rest.label + " (copy)",
        order_index: nextOrder,
      });
      addToast("success", "Field duplicated");
      await refreshConfigs();
    } catch (err: any) { addToast("error", err.message); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in slide-in-from-right ${
              t.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {t.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            {t.message}
            <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="ml-2 opacity-60 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <AdminNav />
      <div className="border-b border-slate-200 bg-white px-6">
        <div className="mx-auto max-w-7xl flex items-center justify-end py-2">
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Verification Form Builder</h1>
            <p className="text-slate-500 mt-1">Create and edit verification forms for all organization types</p>
          </div>
          <button onClick={openNewConfig} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
            <Plus className="h-4 w-4" />
            New Form Config
          </button>
        </div>

        {saving && (
          <div className="mb-6 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving changes...
          </div>
        )}

        <div className="space-y-6">
          {configs.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-12 text-center">
              <p className="text-slate-500 mb-2">No form configs found</p>
              <button onClick={openNewConfig} className="text-blue-600 hover:text-blue-800 font-medium text-sm">Create the first one</button>
            </div>
          )}
          {configs.map((config) => {
            const orgInfo = ORG_TYPES.find((o) => o.slug === config.org_type_slug);
            const isExpanded = expandedConfig === config.id;
            const totalFields = config.sections.reduce((sum, s) => sum + s.fields.length, 0);
            const totalMaxScore = config.sections.reduce((sum, s) => sum + s.max_score, 0);

            return (
              <div key={config.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Config Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <div
                    className="flex items-center gap-4 flex-1 cursor-pointer"
                    onClick={() => setExpandedConfig(isExpanded ? null : config.id)}
                  >
                    <OrgTypeIcon slug={config.org_type_slug} className="bg-blue-50 text-blue-600 h-12 w-12" />
                    <div>
                      <p className="font-semibold text-slate-900">{orgInfo?.name || config.org_type_slug}</p>
                      <p className="text-sm text-slate-500">
                        {config.sections.length} sections &middot; {totalFields} fields &middot; Max score: {totalMaxScore}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      v{config.version}
                    </span>
                    {config.is_active ? (
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); openEditConfig(config); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit config">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openNewSection(config.id); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Add section">
                      <Plus className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteConfig(config.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete config">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                  </div>
                </div>

                {/* Sections */}
                {isExpanded && (
                  <div className="divide-y divide-slate-100">
                    {config.sections.length === 0 && (
                      <div className="px-6 py-8 text-center text-sm text-slate-400">
                        No sections yet. <button onClick={() => openNewSection(config.id)} className="text-blue-600 hover:text-blue-800 font-medium">Add a section</button>
                      </div>
                    )}
                    {config.sections.map((section) => {
                      const isSectionExpanded = expandedSection === section.id;
                      return (
                        <div key={section.id}>
                          {/* Section Header */}
                          <div className="flex items-center justify-between px-6 py-3 bg-slate-50/50">
                            <div
                              className="flex items-center gap-3 flex-1 cursor-pointer"
                              onClick={() => setExpandedSection(isSectionExpanded ? null : section.id)}
                            >
                              <ClipboardCheck className="h-4 w-4 text-slate-400" />
                              <span className="text-sm font-medium text-slate-800">{section.section_label}</span>
                              <span className="text-xs text-slate-400">({section.fields.length} fields, max {section.max_score} pts)</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => moveSection(section.id, "up")} className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title="Move up"><ChevronUp className="h-3.5 w-3.5" /></button>
                              <button onClick={() => moveSection(section.id, "down")} className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title="Move down"><ChevronDown className="h-3.5 w-3.5" /></button>
                              <button onClick={() => openEditSection(section)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded" title="Edit section"><Edit className="h-3.5 w-3.5" /></button>
                              <button onClick={() => openNewField(section.id)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded" title="Add field"><Plus className="h-3.5 w-3.5" /></button>
                              <button onClick={() => deleteSection(section.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded" title="Delete section"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>

                          {/* Fields */}
                          {isSectionExpanded && (
                            <div className="bg-white px-6 py-4">
                              {section.fields.length === 0 && (
                                <div className="text-center text-sm text-slate-400 py-4">
                                  No fields yet. <button onClick={() => openNewField(section.id)} className="text-blue-600 hover:text-blue-800 font-medium">Add a field</button>
                                </div>
                              )}
                              {section.fields.length > 0 && (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                                      <th className="pb-2 w-8"></th>
                                      <th className="pb-2 pr-3 font-semibold">Field</th>
                                      <th className="pb-2 pr-3 font-semibold">Key</th>
                                      <th className="pb-2 pr-3 font-semibold">Type</th>
                                      <th className="pb-2 pr-3 font-semibold">Req</th>
                                      <th className="pb-2 pr-3 font-semibold">Options</th>
                                      <th className="pb-2 pr-3 font-semibold">Scoring</th>
                                      <th className="pb-2 pr-3 font-semibold">Conditional</th>
                                      <th className="pb-2 font-semibold">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {section.fields.map((field) => (
                                      <tr key={field.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-2.5 pr-2">
                                          <div className="flex flex-col gap-0.5">
                                            <button onClick={() => moveField(field.id, "up")} className="p-0.5 text-slate-300 hover:text-slate-500"><ChevronUp className="h-3 w-3" /></button>
                                            <button onClick={() => moveField(field.id, "down")} className="p-0.5 text-slate-300 hover:text-slate-500"><ChevronDown className="h-3 w-3" /></button>
                                          </div>
                                        </td>
                                        <td className="py-2.5 pr-3 font-medium text-slate-800 max-w-[180px] truncate" title={field.label}>{field.label}</td>
                                        <td className="py-2.5 pr-3 text-xs text-slate-400 font-mono">{field.field_key}</td>
                                        <td className="py-2.5 pr-3">
                                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{field.field_type}</span>
                                        </td>
                                        <td className="py-2.5 pr-3">{field.required ? <span className="text-emerald-600 font-medium">Y</span> : <span className="text-slate-400">—</span>}</td>
                                        <td className="py-2.5 pr-3 text-xs text-slate-500">
                                          {field.options && Array.isArray(field.options) && field.options.length > 0 ? `${field.options.length} opts` : "—"}
                                        </td>
                                        <td className="py-2.5 pr-3">
                                          {field.scoring_rules && Array.isArray(field.scoring_rules) && field.scoring_rules.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {(field.scoring_rules as ScoringRule[]).map((rule, idx) => (
                                                <span key={idx} className="rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] text-amber-700">
                                                  {rule.condition}:{rule.score === null ? "sub" : `+${rule.score}`}
                                                </span>
                                              ))}
                                            </div>
                                          ) : <span className="text-slate-400">—</span>}
                                        </td>
                                        <td className="py-2.5 pr-3">
                                          {field.conditional_on ? (
                                            <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-1.5 py-0.5">
                                              {(field.conditional_on as ConditionalOn).field_key}
                                            </span>
                                          ) : <span className="text-slate-400">—</span>}
                                        </td>
                                        <td className="py-2.5">
                                          <div className="flex items-center gap-1">
                                            <button onClick={() => openEditField(field)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded" title="Edit"><Edit className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => duplicateField(field)} className="p-1.5 text-slate-400 hover:text-purple-600 rounded" title="Duplicate"><Save className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => deleteField(field.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CONFIG MODAL ── */}
      {modalMode === "config" && editingConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalMode("closed")}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{editingConfig.id ? "Edit Form Config" : "New Form Config"}</h2>
              <button onClick={() => setModalMode("closed")} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Organization Type</label>
                <select
                  value={editingConfig.org_type_slug || ""}
                  onChange={(e) => setEditingConfig({ ...editingConfig, org_type_slug: e.target.value as OrgTypeSlug })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select...</option>
                  {ORG_TYPES.map((o) => (
                    <option key={o.slug} value={o.slug}>{o.icon} {o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
                <input type="number" value={editingConfig.version || 1} onChange={(e) => setEditingConfig({ ...editingConfig, version: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isActive" checked={editingConfig.is_active ?? true} onChange={(e) => setEditingConfig({ ...editingConfig, is_active: e.target.checked })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Active</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setModalMode("closed")} className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={saveConfig} disabled={saving || !editingConfig.org_type_slug} className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingConfig.id ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION MODAL ── */}
      {modalMode === "section" && editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalMode("closed")}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{editingSection.id ? "Edit Section" : "New Section"}</h2>
              <button onClick={() => setModalMode("closed")} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Section Key</label>
                <input type="text" value={editingSection.section_key || ""} onChange={(e) => setEditingSection({ ...editingSection, section_key: e.target.value })} placeholder="e.g. personal_info" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Section Label</label>
                <input type="text" value={editingSection.section_label || ""} onChange={(e) => setEditingSection({ ...editingSection, section_label: e.target.value })} placeholder="e.g. Personal Information" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={editingSection.section_description || ""} onChange={(e) => setEditingSection({ ...editingSection, section_description: e.target.value })} rows={2} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Score</label>
                  <input type="number" value={editingSection.max_score ?? 0} onChange={(e) => setEditingSection({ ...editingSection, max_score: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Order Index</label>
                  <input type="number" value={editingSection.order_index ?? 0} onChange={(e) => setEditingSection({ ...editingSection, order_index: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setModalMode("closed")} className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={saveSection} disabled={saving || !editingSection.section_key || !editingSection.section_label} className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingSection.id ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FIELD MODAL ── */}
      {modalMode === "field" && editingField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalMode("closed")}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{editingField.id ? "Edit Field" : "New Field"}</h2>
              <button onClick={() => setModalMode("closed")} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Field Key *</label>
                  <input
                    type="text"
                    value={editingField.field_key || ""}
                    onChange={(e) => setEditingField({ ...editingField, field_key: e.target.value })}
                    placeholder="e.g. full_name"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Field Type *</label>
                  <select
                    value={editingField.field_type || "text"}
                    onChange={(e) => setEditingField({ ...editingField, field_type: e.target.value as FieldType })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {FIELD_TYPES.map((ft) => (<option key={ft} value={ft}>{ft}</option>))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Label *</label>
                <input
                  type="text"
                  value={editingField.label || ""}
                  onChange={(e) => setEditingField({ ...editingField, label: e.target.value })}
                  placeholder="e.g. Full Name"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={editingField.placeholder || ""}
                    onChange={(e) => setEditingField({ ...editingField, placeholder: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Help Text</label>
                  <input
                    type="text"
                    value={editingField.help_text || ""}
                    onChange={(e) => setEditingField({ ...editingField, help_text: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="fieldRequired" checked={editingField.required ?? false} onChange={(e) => setEditingField({ ...editingField, required: e.target.checked })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <label htmlFor="fieldRequired" className="text-sm font-medium text-slate-700">Required</label>
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Order</label>
                  <input type="number" value={editingField.order_index ?? 0} onChange={(e) => setEditingField({ ...editingField, order_index: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>

              {/* Options (for select/radio) */}
              {(editingField.field_type === "select" || editingField.field_type === "radio") && (
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Options</h3>
                  <div className="space-y-2">
                    {(editingField.options as FieldOption[] || []).map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => {
                            const opts = [...(editingField.options as FieldOption[] || [])];
                            opts[idx] = { ...opts[idx], label: e.target.value };
                            setEditingField({ ...editingField, options: opts });
                          }}
                          placeholder="Label"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                        <input
                          type="text"
                          value={opt.value}
                          onChange={(e) => {
                            const opts = [...(editingField.options as FieldOption[] || [])];
                            opts[idx] = { ...opts[idx], value: e.target.value };
                            setEditingField({ ...editingField, options: opts });
                          }}
                          placeholder="Value"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                        <button onClick={() => {
                          const opts = (editingField.options as FieldOption[] || []).filter((_, i) => i !== idx);
                          setEditingField({ ...editingField, options: opts.length > 0 ? opts : null });
                        }} className="p-2 text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <button onClick={() => {
                      const opts = [...(editingField.options as FieldOption[] || []), { label: "", value: "" }];
                      setEditingField({ ...editingField, options: opts });
                    }} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
                      <Plus className="h-3.5 w-3.5" /> Add Option
                    </button>
                  </div>
                </div>
              )}

              {/* File formats (for file type) */}
              {editingField.field_type === "file" && (
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Accepted File Formats</h3>
                  <div className="flex flex-wrap gap-2">
                    {["pdf", "jpg", "png", "doc", "docx"].map((fmt) => {
                      const accepted = (editingField.document_accepted_formats as string[] || []);
                      const isSelected = accepted.includes(fmt);
                      return (
                        <button key={fmt} onClick={() => {
                          const acc = [...accepted];
                          if (isSelected) setEditingField({ ...editingField, document_accepted_formats: acc.filter((f) => f !== fmt).length > 0 ? acc.filter((f) => f !== fmt) : null });
                          else setEditingField({ ...editingField, document_accepted_formats: [...acc, fmt] });
                        }} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${isSelected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"}`}>
                          .{fmt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Validation Rules */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Validation Rules</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Min Length</label>
                    <input type="number" value={(editingField.validation_rules as ValidationRules)?.min_length ?? ""} onChange={(e) => setEditingField({ ...editingField, validation_rules: { ...(editingField.validation_rules as ValidationRules || {}), min_length: e.target.value ? parseInt(e.target.value) : undefined } })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Max Length</label>
                    <input type="number" value={(editingField.validation_rules as ValidationRules)?.max_length ?? ""} onChange={(e) => setEditingField({ ...editingField, validation_rules: { ...(editingField.validation_rules as ValidationRules || {}), max_length: e.target.value ? parseInt(e.target.value) : undefined } })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Min Value</label>
                    <input type="number" value={(editingField.validation_rules as ValidationRules)?.min ?? ""} onChange={(e) => setEditingField({ ...editingField, validation_rules: { ...(editingField.validation_rules as ValidationRules || {}), min: e.target.value ? parseInt(e.target.value) : undefined } })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Max Value</label>
                    <input type="number" value={(editingField.validation_rules as ValidationRules)?.max ?? ""} onChange={(e) => setEditingField({ ...editingField, validation_rules: { ...(editingField.validation_rules as ValidationRules || {}), max: e.target.value ? parseInt(e.target.value) : undefined } })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Regex Pattern</label>
                  <input type="text" value={(editingField.validation_rules as ValidationRules)?.pattern ?? ""} onChange={(e) => setEditingField({ ...editingField, validation_rules: { ...(editingField.validation_rules as ValidationRules || {}), pattern: e.target.value || undefined } })} placeholder="e.g. ^[A-Za-z]+$" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
                </div>
              </div>

              {/* Scoring Rules */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Scoring Rules</h3>
                <div className="space-y-2">
                  {(editingField.scoring_rules as ScoringRule[] || []).map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={rule.condition}
                        onChange={(e) => {
                          const rules = [...(editingField.scoring_rules as ScoringRule[] || [])];
                          rules[idx] = { ...rules[idx], condition: e.target.value };
                          setEditingField({ ...editingField, scoring_rules: rules });
                        }}
                        placeholder="Condition (e.g. yes)"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <div className="relative">
                        <input
                          type="number"
                          value={rule.score ?? ""}
                          onChange={(e) => {
                            const rules = [...(editingField.scoring_rules as ScoringRule[] || [])];
                            rules[idx] = { ...rules[idx], score: e.target.value ? parseInt(e.target.value) : null };
                            setEditingField({ ...editingField, scoring_rules: rules });
                          }}
                          placeholder="Score"
                          className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                        <span className="absolute -bottom-4 left-0 text-[10px] text-slate-400 whitespace-nowrap">empty = sub-score</span>
                      </div>
                      <button onClick={() => {
                        const rules = (editingField.scoring_rules as ScoringRule[] || []).filter((_, i) => i !== idx);
                        setEditingField({ ...editingField, scoring_rules: rules.length > 0 ? rules : null });
                      }} className="p-2 text-slate-400 hover:text-red-600 shrink-0"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => {
                    const rules = [...(editingField.scoring_rules as ScoringRule[] || []), { condition: "", score: null }];
                    setEditingField({ ...editingField, scoring_rules: rules });
                  }} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
                    <Plus className="h-3.5 w-3.5" /> Add Scoring Rule
                  </button>
                </div>
              </div>

              {/* Conditional Logic */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Conditional Display</h3>
                <p className="text-xs text-slate-500 mb-3">Show this field only when another field has a specific value.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Depends on Field Key</label>
                    <input
                      type="text"
                      value={(editingField.conditional_on as ConditionalOn)?.field_key ?? ""}
                      onChange={(e) => {
                        const cond = editingField.conditional_on as ConditionalOn || {};
                        const newCond: ConditionalOn = { ...cond, field_key: e.target.value };
                        setEditingField({ ...editingField, conditional_on: newCond });
                      }}
                      placeholder="e.g. has_organization"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Required Value</label>
                    <input
                      type="text"
                      value={(editingField.conditional_on as ConditionalOn)?.value ?? ""}
                      onChange={(e) => {
                        const cond = editingField.conditional_on as ConditionalOn || {};
                        const newCond: ConditionalOn = { ...cond, value: e.target.value || undefined };
                        setEditingField({ ...editingField, conditional_on: newCond });
                      }}
                      placeholder="e.g. yes"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                {(editingField.conditional_on as ConditionalOn)?.field_key && !(editingField.conditional_on as ConditionalOn)?.value && (
                  <p className="text-xs text-amber-600 mt-2">No value set = field hidden when parent field has any value</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setModalMode("closed")} className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button
                onClick={saveField}
                disabled={saving || !editingField.field_key || !editingField.label}
                className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingField.id ? "Update Field" : "Create Field"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
