/**
 * Feature Analysis module implementing prioritization and structuring logic
 * from the analyze-feature-requests framework (.kiro/skills/analyze-feature-requests/).
 *
 * Provides heuristic-based analysis of collected refinement info to determine:
 * - Theme (derived from context/objective keywords)
 * - Strategic alignment (from strategicAlignment field or inferred)
 * - Impact (based on targetAudience breadth and customerBenefit strength)
 * - Effort (based on keyFeatures count and integrations presence)
 * - Risk (based on risks/dependencies/constraints fields)
 * - Priority (calculated from impact/effort/risk combination)
 *
 * Used by HierarchyTemplateEngine when building Epic/Feature descriptions.
 *
 * Requirements: 3.2, 3.3, 4.1, 4.2
 */

import { CollectedInfo } from './types';
import { escapeHtml } from './html-formatter';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ImpactLevel = 'high' | 'medium' | 'low';
export type EffortLevel = 'high' | 'medium' | 'low';
export type RiskLevel = 'high' | 'medium' | 'low';

export interface FeatureAnalysis {
  theme: string;
  strategicAlignment: string;
  impact: ImpactLevel;
  effort: EffortLevel;
  risk: RiskLevel;
  priority: number; // 1 (highest) to 5 (lowest)
}

// ─── Theme Keywords ─────────────────────────────────────────────────────────

const THEME_KEYWORDS: Record<string, string[]> = {
  'Automação': ['automatizar', 'automação', 'automatizado', 'automate', 'automation'],
  'Integração': ['integração', 'integrar', 'conectar', 'api', 'integration', 'integrate'],
  'Experiência do Usuário': ['ux', 'usabilidade', 'interface', 'experiência', 'user experience', 'ui'],
  'Performance': ['performance', 'velocidade', 'otimização', 'rápido', 'speed', 'optimization'],
  'Segurança': ['segurança', 'autenticação', 'autorização', 'security', 'auth', 'compliance'],
  'Dados e Analytics': ['dados', 'relatório', 'analytics', 'métricas', 'dashboard', 'data', 'report'],
  'Infraestrutura': ['infraestrutura', 'deploy', 'ci/cd', 'pipeline', 'cloud', 'infrastructure'],
  'Produto': ['feature', 'funcionalidade', 'produto', 'product', 'capability'],
};

// ─── Analysis Functions ─────────────────────────────────────────────────────

/**
 * Analyzes collected refinement info to determine theme, strategic alignment,
 * impact, effort, risk, and priority using heuristics.
 */
export function analyzeFeature(collectedInfo: CollectedInfo): FeatureAnalysis {
  const theme = deriveTheme(collectedInfo);
  const strategicAlignment = deriveStrategicAlignment(collectedInfo);
  const impact = assessImpact(collectedInfo);
  const effort = assessEffort(collectedInfo);
  const risk = assessRisk(collectedInfo);
  const priority = calculatePriority(impact, effort, risk);

  return {
    theme,
    strategicAlignment,
    impact,
    effort,
    risk,
    priority,
  };
}

/**
 * Formats the feature analysis as HTML for inclusion in an Epic description.
 * Includes all analysis fields in a structured section.
 */
export function formatAnalysisForEpic(analysis: FeatureAnalysis): string {
  const priorityLabel = getPriorityLabel(analysis.priority);

  return (
    `<h3>${escapeHtml('Análise Estratégica')}</h3>` +
    `<table>` +
    `<tr><td><strong>${escapeHtml('Tema')}</strong></td><td>${escapeHtml(analysis.theme)}</td></tr>` +
    `<tr><td><strong>${escapeHtml('Alinhamento Estratégico')}</strong></td><td>${escapeHtml(analysis.strategicAlignment)}</td></tr>` +
    `<tr><td><strong>${escapeHtml('Impacto')}</strong></td><td>${escapeHtml(analysis.impact)}</td></tr>` +
    `<tr><td><strong>${escapeHtml('Esforço')}</strong></td><td>${escapeHtml(analysis.effort)}</td></tr>` +
    `<tr><td><strong>${escapeHtml('Risco')}</strong></td><td>${escapeHtml(analysis.risk)}</td></tr>` +
    `<tr><td><strong>${escapeHtml('Prioridade')}</strong></td><td>${escapeHtml(`${analysis.priority} - ${priorityLabel}`)}</td></tr>` +
    `</table>`
  );
}

/**
 * Formats the feature analysis as HTML for inclusion in a Feature description.
 * Focuses on impact, effort, and risk relevant to the feature scope.
 */
export function formatAnalysisForFeature(analysis: FeatureAnalysis): string {
  const priorityLabel = getPriorityLabel(analysis.priority);

  return (
    `<h3>${escapeHtml('Análise de Feature')}</h3>` +
    `<ul>` +
    `<li><strong>${escapeHtml('Tema')}</strong>: ${escapeHtml(analysis.theme)}</li>` +
    `<li><strong>${escapeHtml('Impacto')}</strong>: ${escapeHtml(analysis.impact)}</li>` +
    `<li><strong>${escapeHtml('Esforço')}</strong>: ${escapeHtml(analysis.effort)}</li>` +
    `<li><strong>${escapeHtml('Risco')}</strong>: ${escapeHtml(analysis.risk)}</li>` +
    `<li><strong>${escapeHtml('Prioridade')}</strong>: ${escapeHtml(`${analysis.priority} - ${priorityLabel}`)}</li>` +
    `</ul>`
  );
}

// ─── Internal Heuristics ────────────────────────────────────────────────────

/**
 * Derives theme from context and objective keywords.
 */
function deriveTheme(info: CollectedInfo): string {
  const searchText = `${info.context} ${info.objective} ${info.keyFeatures}`.toLowerCase();

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        return theme;
      }
    }
  }

  return 'Produto';
}

/**
 * Derives strategic alignment from the strategicAlignment field or infers from objective.
 */
function deriveStrategicAlignment(info: CollectedInfo): string {
  if (info.strategicAlignment && info.strategicAlignment.trim().length > 0) {
    return info.strategicAlignment.trim();
  }

  // Infer from objective and customer benefit
  if (info.objective && info.customerBenefit) {
    return `${info.objective} — ${info.customerBenefit}`;
  }

  return info.objective || 'Não especificado';
}

/**
 * Assesses impact based on targetAudience breadth and customerBenefit strength.
 *
 * Heuristics:
 * - High: broad audience (multiple segments or "todos") AND strong benefit (long description)
 * - Low: narrow audience (single user/role) AND weak benefit (short description)
 * - Medium: everything else
 */
function assessImpact(info: CollectedInfo): ImpactLevel {
  const audienceBreadth = assessAudienceBreadth(info.targetAudience);
  const benefitStrength = assessBenefitStrength(info.customerBenefit);

  if (audienceBreadth === 'broad' && benefitStrength === 'strong') {
    return 'high';
  }
  if (audienceBreadth === 'narrow' && benefitStrength === 'weak') {
    return 'low';
  }
  return 'medium';
}

/**
 * Assesses effort based on keyFeatures count and integrations presence.
 *
 * Heuristics:
 * - High: many features (>5 items or long text) OR integrations present
 * - Low: few features (1-2 items, short text) AND no integrations
 * - Medium: everything else
 */
function assessEffort(info: CollectedInfo): EffortLevel {
  const featureCount = countItems(info.keyFeatures);
  const hasIntegrations = !!(info.integrations && info.integrations.trim().length > 0);

  if (featureCount > 5 || (featureCount > 3 && hasIntegrations)) {
    return 'high';
  }
  if (featureCount <= 2 && !hasIntegrations) {
    return 'low';
  }
  return 'medium';
}

/**
 * Assesses risk based on risks, dependencies, and constraints fields.
 *
 * Heuristics:
 * - High: risks AND dependencies AND constraints all present
 * - Low: none of the risk fields are present
 * - Medium: some risk fields present
 */
function assessRisk(info: CollectedInfo): RiskLevel {
  const hasRisks = !!(info.risks && info.risks.trim().length > 0);
  const hasDependencies = !!(info.dependencies && info.dependencies.trim().length > 0);
  const hasConstraints = !!(info.constraints && info.constraints.trim().length > 0);

  const riskFactors = [hasRisks, hasDependencies, hasConstraints].filter(Boolean).length;

  if (riskFactors >= 3) {
    return 'high';
  }
  if (riskFactors === 0) {
    return 'low';
  }
  return 'medium';
}

/**
 * Calculates priority (1-5) from impact, effort, and risk combination.
 *
 * Priority matrix:
 * - Priority 1 (Critical): High impact, low effort, low risk
 * - Priority 2 (High): High impact, medium effort/risk
 * - Priority 3 (Medium): Medium impact or balanced factors
 * - Priority 4 (Low): Low impact, high effort
 * - Priority 5 (Minimal): Low impact, high effort, high risk
 */
function calculatePriority(impact: ImpactLevel, effort: EffortLevel, risk: RiskLevel): number {
  const impactScore = levelToScore(impact);    // high=3, medium=2, low=1
  const effortScore = levelToScore(effort);    // high=3, medium=2, low=1
  const riskScore = levelToScore(risk);        // high=3, medium=2, low=1

  // Priority formula: higher impact increases priority, higher effort/risk decreases it
  // Score range: impact(1-3) - effort_penalty(0-2) - risk_penalty(0-1) = -2 to 3
  const rawScore = impactScore - (effortScore - 1) - Math.floor(riskScore / 2);

  // Map raw score to priority 1-5
  if (rawScore >= 3) return 1;
  if (rawScore >= 2) return 2;
  if (rawScore >= 1) return 3;
  if (rawScore >= 0) return 4;
  return 5;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function levelToScore(level: ImpactLevel | EffortLevel | RiskLevel): number {
  switch (level) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
  }
}

function assessAudienceBreadth(targetAudience: string): 'broad' | 'narrow' | 'medium' {
  const text = targetAudience.toLowerCase();
  const broadIndicators = ['todos', 'all', 'empresa', 'organização', 'company', 'organization', 'múltiplos', 'multiple', 'equipes', 'teams'];
  const narrowIndicators = ['único', 'single', 'específico', 'specific', 'apenas', 'only', 'somente'];

  for (const indicator of broadIndicators) {
    if (text.includes(indicator)) return 'broad';
  }
  for (const indicator of narrowIndicators) {
    if (text.includes(indicator)) return 'narrow';
  }

  // Check for comma-separated segments (multiple audiences)
  if (targetAudience.includes(',') || targetAudience.includes(' e ') || targetAudience.includes(' and ')) {
    return 'broad';
  }

  return 'medium';
}

function assessBenefitStrength(customerBenefit: string): 'strong' | 'weak' | 'moderate' {
  if (!customerBenefit) return 'weak';

  const text = customerBenefit.trim();

  // Strong: detailed benefit description (>80 chars or multiple sentences)
  if (text.length > 80 || text.includes('.') || text.includes(';')) {
    return 'strong';
  }

  // Weak: very short benefit (<30 chars)
  if (text.length < 30) {
    return 'weak';
  }

  return 'moderate';
}

function countItems(text: string): number {
  if (!text || text.trim().length === 0) return 0;

  // Count items separated by common delimiters
  const lines = text.split(/[\n;,]/).filter((line) => line.trim().length > 0);

  // If no delimiters found, estimate by text length
  if (lines.length <= 1) {
    // Rough heuristic: ~50 chars per feature item
    return Math.max(1, Math.ceil(text.trim().length / 50));
  }

  return lines.length;
}

function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 1: return 'Crítica';
    case 2: return 'Alta';
    case 3: return 'Média';
    case 4: return 'Baixa';
    case 5: return 'Mínima';
    default: return 'Não definida';
  }
}
