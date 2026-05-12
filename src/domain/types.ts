/**
 * Core domain types for the PM Skill module, refinement sessions,
 * question flows, and Azure DevOps API payloads.
 *
 * These types support the rule-based PM Skill that conducts refinement
 * sessions using the PRD 8-Section structure, 3 C's + INVEST frameworks.
 */

// ─── PRD Section Type ───────────────────────────────────────────────────────

/**
 * Seções baseadas no template PRD de 8 seções (create-prd skill).
 */
export type PRDSection =
  | 'background'           // Contexto: sobre o que é esta iniciativa? Por que agora?
  | 'objective'            // Objetivo, métricas de sucesso (OKR SMART)
  | 'market_segments'      // Para quem estamos construindo? Restrições?
  | 'value_propositions'   // Jobs/necessidades dos clientes, ganhos, dores evitadas
  | 'solution'             // Funcionalidades-chave, premissas, integrações
  | 'release'              // Escopo v1 vs futuro, dependências, riscos
  | 'user_scenarios'       // Cenários de uso (formato job-stories)
  | 'acceptance_criteria'; // Critérios de aceitação (formato 3 C's)

// ─── Refinement Session ─────────────────────────────────────────────────────

export interface RefinementSession {
  id: string;
  userNeed: string;
  currentSectionIndex: number;      // Índice da seção PRD atual
  currentQuestionIndex: number;
  answers: Map<string, string>;
  status: 'in_progress' | 'completed';
  collectedInfo: CollectedInfo;
}

// ─── Question Types ─────────────────────────────────────────────────────────

export interface Question {
  id: string;
  text: string;
  section: PRDSection;              // Seção PRD à qual pertence
  required: boolean;
  followUp?: string; // Pergunta de follow-up se resposta for insuficiente
}

export interface QuestionFlow {
  section: PRDSection;
  sectionTitle: string;           // Nome da seção PRD
  purpose: string;                // O que esta seção coleta
  mapsTo: 'epic' | 'feature' | 'user_stories' | 'metadata'; // Para qual work item contribui
  questions: QuestionTemplate[];
  minAnswersRequired: number;
}

export interface QuestionTemplate {
  id: string;
  text: string;
  required: boolean;
  followUpCondition?: (answer: string) => boolean; // Se true, faz follow-up
  followUpText?: string;
}

// ─── Collected Info ─────────────────────────────────────────────────────────

export interface CollectedInfo {
  // Background (PRD Section 3) → Epic
  context: string;                  // Sobre o que é esta iniciativa
  whyNow?: string;                  // Por que agora
  recentlyPossible?: string;        // Algo que se tornou possível recentemente

  // Objective (PRD Section 4) → Epic
  objective: string;                // Objetivo principal
  customerBenefit: string;          // Benefício para empresa/clientes
  successMetrics?: string;          // Métricas de sucesso (OKR SMART)
  strategicAlignment?: string;      // Alinhamento com visão/estratégia

  // Market Segments (PRD Section 5) → Epic
  targetAudience: string;           // Para quem estamos construindo
  constraints?: string;             // Restrições conhecidas

  // Value Propositions (PRD Section 6) → Feature
  customerJobs: string;             // Jobs/necessidades endereçadas
  customerGains: string;            // Ganhos e dores evitadas
  competitiveAdvantage?: string;    // Diferencial vs alternativas

  // Solution (PRD Section 7) → Feature
  keyFeatures: string;              // Funcionalidades-chave
  scopeLimits: string;              // Limites do escopo
  assumptions?: string;             // Premissas não provadas
  integrations?: string;            // Integrações necessárias

  // Release (PRD Section 8) → Metadata
  v1Scope?: string;                 // Escopo da primeira versão
  dependencies?: string;            // Dependências
  risks?: string;                   // Riscos conhecidos

  // User Scenarios (Job Stories format) → User Stories
  userScenarios: string;            // "When [situation], I want [motivation], so I can [outcome]"
  alternativeScenarios?: string;    // Cenários alternativos
  estimatedStories?: number;        // Estimativa de quantidade

  // Acceptance Criteria (3 C's Confirmation) → User Stories
  acceptanceCriteria: string;       // Critérios testáveis
  businessRules?: string;           // Regras de negócio
  definitionOfDone?: string;        // Critérios de pronto
}

// ─── INVEST Validation ──────────────────────────────────────────────────────

export interface INVESTValidation {
  independent: boolean;   // Pode ser desenvolvida independentemente?
  negotiable: boolean;    // Detalhes são negociáveis?
  valuable: boolean;      // Entrega valor ao usuário?
  estimable: boolean;     // Pode ser estimada?
  small: boolean;         // Cabe em um sprint?
  testable: boolean;      // Tem critérios de aceitação testáveis?
  passed: boolean;        // Todos os critérios passaram?
  warnings: string[];     // Avisos sobre critérios não atendidos
}

// ─── Azure DevOps API Payload ───────────────────────────────────────────────

/**
 * JSON Patch operation used in Azure DevOps Work Item creation payloads.
 *
 * POST https://dev.azure.com/{org}/{project}/_apis/wit/workitems/${type}?api-version=7.1
 * Content-Type: application/json-patch+json
 */
export interface JsonPatchOperation {
  op: 'add' | 'replace' | 'remove';
  path: string;
  value: unknown;
}
