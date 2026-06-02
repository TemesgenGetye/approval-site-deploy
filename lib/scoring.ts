import type { OrgTypeSlug, PriorityLevel, SectionScore } from './types';
import { FORM_REGISTRY } from './verificationForms';

export interface ScoredResult {
  totalScore: number;
  priorityLevel: PriorityLevel;
  sectionScores: Record<string, number>;
  sectionDetails: SectionScore[];
}

function findConditionScore(
  scoringRules: { condition: string; score: number | null }[],
  value: string | null | undefined,
): number | null {
  if (!value) return 0;
  const rule = scoringRules.find((r) => r.condition === value);
  if (!rule) return 0;
  return rule.score;
}

export function calculateScore(
  orgType: OrgTypeSlug,
  formData: Record<string, unknown>,
): ScoredResult {
  const form = FORM_REGISTRY[orgType];
  if (!form) {
    return { totalScore: 0, priorityLevel: 'low', sectionScores: {}, sectionDetails: [] };
  }

  const sectionScores: Record<string, number> = {};
  const sectionDetails: SectionScore[] = [];

  for (const section of form.sections) {
    let sectionScoreValue = 0;
    const details: { field_key: string; label: string; score: number; reason: string }[] = [];

    for (const field of section.fields) {
      const value = formData[field.field_key] as string | null | undefined;

      if (field.scoring_rules && field.scoring_rules.length > 0) {
        // Check if this field has a parent condition (e.g., has_disability = yes)
        if (field.conditional_on) {
          const parentValue = formData[field.conditional_on.field_key] as string | null | undefined;
          const expectedValue = field.conditional_on.value;
          const notInValues = field.conditional_on.not_in;
          let conditionMet = false;

          if (expectedValue !== undefined) {
            conditionMet = parentValue === expectedValue;
          } else if (notInValues !== undefined) {
            conditionMet = parentValue ? !notInValues.includes(parentValue) : false;
          }

          if (!conditionMet) continue;
        }

        // Check if this field's value has a scoring rule of null (meaning use sub-field scores)
        const ruleWithNull = field.scoring_rules.find((r) => r.score === null);
        if (ruleWithNull && value === field.scoring_rules.find((r) => r.score === null)?.condition) {
          // This field has null score, meaning the score comes from a child field
          continue;
        }

        const fieldScore = findConditionScore(field.scoring_rules, value);
        if (fieldScore !== null && fieldScore !== undefined) {
          sectionScoreValue += fieldScore;
          details.push({
            field_key: field.field_key,
            label: field.label,
            score: fieldScore,
            reason: `${field.label}: ${value || 'N/A'} → +${fieldScore}`,
          });
        }
      }
    }

    // Cap section score at max_score
    const finalSectionScore = Math.min(sectionScoreValue, section.max_score);
    sectionScores[section.section_key] = finalSectionScore;

    if (details.length > 0) {
      sectionDetails.push({
        section_key: section.section_key,
        section_label: section.section_label,
        score: finalSectionScore,
        max_score: section.max_score,
        details,
      });
    }
  }

  // Calculate total (cap at 100)
  const totalScore = Math.min(
    Object.values(sectionScores).reduce((sum, s) => sum + s, 0),
    100,
  );

  const priorityLevel = getPriorityLevel(totalScore);

  return { totalScore, priorityLevel, sectionScores, sectionDetails };
}

export function getPriorityLevel(score: number): PriorityLevel {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

export function getPriorityColor(level: PriorityLevel): string {
  switch (level) {
    case 'high':
      return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'medium':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'low':
      return 'text-slate-600 bg-slate-50 border-slate-200';
  }
}

export function getPriorityBadgeColor(level: PriorityLevel): string {
  switch (level) {
    case 'high':
      return 'bg-emerald-100 text-emerald-700';
    case 'medium':
      return 'bg-amber-100 text-amber-700';
    case 'low':
      return 'bg-slate-100 text-slate-600';
  }
}
