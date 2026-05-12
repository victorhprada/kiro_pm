/**
 * HierarchyTemplateEngine — Generates work item hierarchy using
 * 3 C's (Card, Conversation, Confirmation) + INVEST validation.
 *
 * Builds Epic from Background + Objective + Market Segments sections.
 * Builds Feature from Value Propositions + Solution sections.
 * Builds User Stories from User Scenarios + Acceptance Criteria sections.
 *
 * Requirements: 4.1, 4.2, 4.3, 5.3, 5.4
 */

import {
  EpicData,
  FeatureData,
  UserStoryData,
  WorkItemHierarchy,
} from './models';
import { CollectedInfo, INVESTValidation } from './types';

export interface HierarchyTemplateEngine {
  buildEpic(collectedInfo: CollectedInfo): EpicData;
  buildFeature(collectedInfo: CollectedInfo): FeatureData;
  buildUserStories(collectedInfo: CollectedInfo): UserStoryData[];
  validateINVEST(story: UserStoryData): INVESTValidation;
  applyFeedback(hierarchy: WorkItemHierarchy, feedback: string): WorkItemHierarchy;
}

/**
 * Default implementation of HierarchyTemplateEngine.
 *
 * Uses PRD sections to generate structured work items:
 * - Epic: Background + Objective + Market Segments
 * - Feature: Value Propositions + Solution
 * - User Stories: User Scenarios + Acceptance Criteria (3 C's format)
 */
export class DefaultHierarchyTemplateEngine implements HierarchyTemplateEngine {
  /**
   * Build an Epic from Background + Objective + Market Segments.
   * Title derived from objective/context.
   * Description is HTML formatted with all relevant sections.
   */
  buildEpic(collectedInfo: CollectedInfo): EpicData {
    const title = this.buildEpicTitle(collectedInfo);
    const description = this.buildEpicDescription(collectedInfo);

    return {
      title,
      description,
      areaPath: '',
    };
  }

  /**
   * Build a Feature from Value Propositions + Solution.
   * Title derived from keyFeatures (first line).
   * Description is HTML formatted with value props and solution details.
   */
  buildFeature(collectedInfo: CollectedInfo): FeatureData {
    const title = this.buildFeatureTitle(collectedInfo);
    const description = this.buildFeatureDescription(collectedInfo);

    return {
      title,
      description,
      areaPath: '',
    };
  }

  /**
   * Build User Stories using 3 C's format:
   * - Card: concise title (summary of the scenario)
   * - Conversation: "Como [role], eu quero [action], para que [benefit]"
   * - Confirmation: HTML list from acceptanceCriteria field
   */
  buildUserStories(collectedInfo: CollectedInfo): UserStoryData[] {
    const scenarios = this.parseScenarios(collectedInfo.userScenarios);
    const criteriaItems = this.parseCriteria(collectedInfo.acceptanceCriteria);

    if (scenarios.length === 0) {
      // Fallback: create at least one story from the raw input
      return [this.buildSingleStory(collectedInfo.userScenarios, criteriaItems, collectedInfo)];
    }

    return scenarios.map((scenario, index) => {
      // Distribute criteria across stories, or use all for each
      const storyCriteria = scenarios.length === 1
        ? criteriaItems
        : this.distributeCriteria(criteriaItems, index, scenarios.length);

      return this.buildSingleStory(scenario, storyCriteria, collectedInfo);
    });
  }

  /**
   * Validate a User Story against INVEST criteria using heuristics.
   */
  validateINVEST(story: UserStoryData): INVESTValidation {
    const warnings: string[] = [];

    // Independent: no explicit dependency keywords
    const independent = this.checkIndependent(story);
    if (!independent) {
      warnings.push('Story may have dependencies on other stories (contains dependency keywords).');
    }

    // Negotiable: description is not overly prescriptive (not too long)
    const negotiable = this.checkNegotiable(story);
    if (!negotiable) {
      warnings.push('Story description may be overly prescriptive (too detailed/long).');
    }

    // Valuable: has clear benefit statement
    const valuable = this.checkValuable(story);
    if (!valuable) {
      warnings.push('Story may not clearly express value/benefit to the user.');
    }

    // Estimable: scope is bounded (description length reasonable)
    const estimable = this.checkEstimable(story);
    if (!estimable) {
      warnings.push('Story scope may be too broad to estimate accurately.');
    }

    // Small: acceptance criteria ≤ 6 items
    const small = this.checkSmall(story);
    if (!small) {
      warnings.push('Story may be too large (more than 6 acceptance criteria).');
    }

    // Testable: has concrete acceptance criteria (non-empty)
    const testable = this.checkTestable(story);
    if (!testable) {
      warnings.push('Story lacks concrete, testable acceptance criteria.');
    }

    const passed = independent && negotiable && valuable && estimable && small && testable;

    return {
      independent,
      negotiable,
      valuable,
      estimable,
      small,
      testable,
      passed,
      warnings,
    };
  }

  /**
   * Apply user feedback to adjust the hierarchy.
   * Simple implementation that returns the hierarchy unchanged.
   * Can be enhanced later with more sophisticated feedback parsing.
   */
  applyFeedback(hierarchy: WorkItemHierarchy, _feedback: string): WorkItemHierarchy {
    // Simple implementation: return hierarchy as-is
    // Future enhancement: parse feedback to adjust titles, descriptions, or add/remove stories
    return { ...hierarchy };
  }

  // ─── Private: Epic Building ─────────────────────────────────────────────────

  private buildEpicTitle(info: CollectedInfo): string {
    // Use objective as primary source for title, fallback to context
    if (info.objective) {
      // Take first non-empty sentence or first 80 chars
      const parts = info.objective.split(/[.\n]/);
      const firstSentence = parts.find(p => p.trim().length > 0)?.trim() || info.objective.trim();
      if (firstSentence.length > 0) {
        return firstSentence.length > 80
          ? firstSentence.substring(0, 77) + '...'
          : firstSentence;
      }
    }
    // Fallback to context
    if (info.context) {
      const contextParts = info.context.split(/[.\n]/);
      const contextFirst = contextParts.find(p => p.trim().length > 0)?.trim() || info.context.trim();
      if (contextFirst.length > 0) {
        return contextFirst.length > 80
          ? contextFirst.substring(0, 77) + '...'
          : contextFirst;
      }
    }
    // Ultimate fallback: use raw objective or context
    const fallback = (info.objective || info.context || '').trim();
    return fallback.length > 80 ? fallback.substring(0, 77) + '...' : fallback || 'Epic';
  }

  private buildEpicDescription(info: CollectedInfo): string {
    const sections: string[] = [];

    // Context section
    sections.push(`<h3>Contexto</h3>`);
    sections.push(`<p>${this.escapeHtml(info.context)}</p>`);

    // Why Now
    if (info.whyNow) {
      sections.push(`<h3>Por que agora?</h3>`);
      sections.push(`<p>${this.escapeHtml(info.whyNow)}</p>`);
    }

    // Objective
    sections.push(`<h3>Objetivo</h3>`);
    sections.push(`<p>${this.escapeHtml(info.objective)}</p>`);

    // Customer Benefit
    sections.push(`<h3>Benefício</h3>`);
    sections.push(`<p>${this.escapeHtml(info.customerBenefit)}</p>`);

    // Target Audience
    sections.push(`<h3>Público-alvo</h3>`);
    sections.push(`<p>${this.escapeHtml(info.targetAudience)}</p>`);

    // Constraints (optional)
    if (info.constraints) {
      sections.push(`<h3>Restrições</h3>`);
      sections.push(`<p>${this.escapeHtml(info.constraints)}</p>`);
    }

    // Strategic Alignment (optional)
    if (info.strategicAlignment) {
      sections.push(`<h3>Alinhamento Estratégico</h3>`);
      sections.push(`<p>${this.escapeHtml(info.strategicAlignment)}</p>`);
    }

    return sections.join('\n');
  }

  // ─── Private: Feature Building ──────────────────────────────────────────────

  private buildFeatureTitle(info: CollectedInfo): string {
    // Use first non-empty line of keyFeatures as title
    const lines = info.keyFeatures.split(/[\n]/);
    const firstLine = lines.find(l => l.trim().length > 0)?.trim() || info.keyFeatures.trim();
    // Remove leading bullet/dash if present
    const cleaned = firstLine.replace(/^[-•*]\s*/, '');
    if (cleaned.length > 0) {
      return cleaned.length > 80
        ? cleaned.substring(0, 77) + '...'
        : cleaned;
    }
    // Fallback
    return info.keyFeatures.trim() || 'Feature';
  }

  private buildFeatureDescription(info: CollectedInfo): string {
    const sections: string[] = [];

    // Customer Jobs
    sections.push(`<h3>Necessidades dos Clientes</h3>`);
    sections.push(`<p>${this.escapeHtml(info.customerJobs)}</p>`);

    // Customer Gains
    sections.push(`<h3>Ganhos e Dores Evitadas</h3>`);
    sections.push(`<p>${this.escapeHtml(info.customerGains)}</p>`);

    // Key Features
    sections.push(`<h3>Funcionalidades-chave</h3>`);
    const features = info.keyFeatures.split('\n').filter(l => l.trim());
    if (features.length > 1) {
      sections.push('<ul>');
      features.forEach(f => {
        const cleaned = f.trim().replace(/^[-•*]\s*/, '');
        sections.push(`  <li>${this.escapeHtml(cleaned)}</li>`);
      });
      sections.push('</ul>');
    } else {
      sections.push(`<p>${this.escapeHtml(info.keyFeatures)}</p>`);
    }

    // Scope Limits
    sections.push(`<h3>Limites do Escopo</h3>`);
    sections.push(`<p>${this.escapeHtml(info.scopeLimits)}</p>`);

    // Integrations (optional)
    if (info.integrations) {
      sections.push(`<h3>Integrações</h3>`);
      sections.push(`<p>${this.escapeHtml(info.integrations)}</p>`);
    }

    return sections.join('\n');
  }

  // ─── Private: User Story Building ──────────────────────────────────────────

  /**
   * Parse user scenarios into individual scenario strings.
   * Splits by newlines or "When"/"Quando" patterns.
   */
  private parseScenarios(userScenarios: string): string[] {
    if (!userScenarios || !userScenarios.trim()) {
      return [];
    }

    // Try splitting by "When" or "Quando" patterns (job stories format)
    const whenPattern = /(?:^|\n)\s*(?:When|Quando|when|quando)\s+/;
    if (whenPattern.test(userScenarios)) {
      const parts = userScenarios
        .split(/\n\s*(?=(?:When|Quando|when|quando)\s+)/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
      if (parts.length > 1) {
        return parts;
      }
    }

    // Try splitting by newlines (each line is a scenario)
    const lines = userScenarios
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    // If we have numbered items or bullet points, treat each as a scenario
    if (lines.length > 1) {
      return lines.map(l => l.replace(/^\d+[.)]\s*/, '').replace(/^[-•*]\s*/, ''));
    }

    // Single scenario
    return [userScenarios.trim()];
  }

  /**
   * Parse acceptance criteria into individual items.
   */
  private parseCriteria(acceptanceCriteria: string): string[] {
    if (!acceptanceCriteria || !acceptanceCriteria.trim()) {
      return [];
    }

    const lines = acceptanceCriteria
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map(l => l.replace(/^\d+[.)]\s*/, '').replace(/^[-•*]\s*/, ''));

    return lines;
  }

  /**
   * Distribute criteria across stories when there are multiple stories.
   */
  private distributeCriteria(criteria: string[], storyIndex: number, totalStories: number): string[] {
    if (criteria.length === 0) return [];

    // If fewer criteria than stories, give all to each story
    if (criteria.length <= totalStories) {
      return criteria;
    }

    // Distribute evenly
    const perStory = Math.ceil(criteria.length / totalStories);
    const start = storyIndex * perStory;
    const end = Math.min(start + perStory, criteria.length);
    return criteria.slice(start, end);
  }

  /**
   * Build a single User Story using 3 C's format.
   */
  private buildSingleStory(scenario: string, criteria: string[], info: CollectedInfo): UserStoryData {
    // Card: concise title from scenario
    const title = this.buildStoryTitle(scenario);

    // Conversation: "Como [role], eu quero [action], para que [benefit]"
    const description = this.buildStoryDescription(scenario, info);

    // Confirmation: HTML list of acceptance criteria
    const acceptanceCriteria = this.buildStoryCriteria(criteria);

    return {
      title,
      description,
      acceptanceCriteria,
      areaPath: '',
    };
  }

  /**
   * Build story title (Card) — concise summary of the scenario.
   */
  private buildStoryTitle(scenario: string): string {
    // Remove "When/Quando" prefix if present
    let cleaned = scenario
      .replace(/^(?:When|Quando|when|quando)\s+/i, '')
      .trim();

    // Take first non-empty sentence or limit to 80 chars
    const parts = cleaned.split(/[.\n]/);
    const firstSentence = parts.find(p => p.trim().length > 0)?.trim() || cleaned;

    const title = firstSentence.length > 80
      ? firstSentence.substring(0, 77) + '...'
      : firstSentence;

    // Ensure non-empty title
    return title.length > 0 ? title : (cleaned || scenario.trim() || 'User Story');
  }

  /**
   * Build story description (Conversation) in the format:
   * "Como [role], eu quero [action], para que [benefit]"
   */
  private buildStoryDescription(scenario: string, info: CollectedInfo): string {
    const role = info.targetAudience
      ? info.targetAudience.split(/[,.\n]/)[0].trim().toLowerCase()
      : 'usuário';

    // Extract action from scenario
    const action = this.extractAction(scenario);

    // Extract benefit from scenario or use customerBenefit
    const benefit = this.extractBenefit(scenario, info);

    const conversation = `Como ${role}, eu quero ${action}, para que ${benefit}.`;

    return `<p>${this.escapeHtml(conversation)}</p>`;
  }

  /**
   * Extract the action part from a scenario.
   */
  private extractAction(scenario: string): string {
    // Try to extract from "I want to [action]" or "eu quero [action]" pattern
    const wantMatch = scenario.match(/(?:I want to|eu quero|want to|quero)\s+(.+?)(?:,\s*(?:so that|para que)|$)/i);
    if (wantMatch) {
      return wantMatch[1].trim();
    }

    // Try to extract from "When [situation], I want [motivation]" pattern
    const whenMatch = scenario.match(/(?:When|Quando)\s+.+?,\s*(?:I want to|eu quero|want to|quero)\s+(.+?)(?:,|$)/i);
    if (whenMatch) {
      return whenMatch[1].trim();
    }

    // Fallback: use the scenario itself as the action (cleaned up)
    const cleaned = scenario
      .replace(/^(?:When|Quando|when|quando)\s+/i, '')
      .replace(/,\s*(?:so that|para que).+$/i, '')
      .trim();

    return cleaned.length > 100 ? cleaned.substring(0, 97) + '...' : cleaned;
  }

  /**
   * Extract the benefit part from a scenario or use customerBenefit.
   */
  private extractBenefit(scenario: string, info: CollectedInfo): string {
    // Try to extract from "so that [benefit]" or "para que [benefit]" pattern
    const benefitMatch = scenario.match(/(?:so that|para que)\s+(.+)$/i);
    if (benefitMatch) {
      return benefitMatch[1].trim().replace(/\.$/, '');
    }

    // Fallback to customerBenefit from collected info
    if (info.customerBenefit) {
      const firstBenefit = info.customerBenefit.split(/[.\n]/)[0].trim().toLowerCase();
      return firstBenefit;
    }

    return 'o objetivo seja alcançado';
  }

  /**
   * Build acceptance criteria (Confirmation) as HTML list.
   */
  private buildStoryCriteria(criteria: string[]): string {
    if (criteria.length === 0) {
      return '<ul><li>Critérios de aceitação a serem definidos</li></ul>';
    }

    const items = criteria
      .map(c => `  <li>${this.escapeHtml(c)}</li>`)
      .join('\n');

    return `<ul>\n${items}\n</ul>`;
  }

  // ─── Private: INVEST Validation ─────────────────────────────────────────────

  /**
   * Independent: no explicit dependency keywords.
   */
  private checkIndependent(story: UserStoryData): boolean {
    const dependencyKeywords = [
      'depende de', 'depends on', 'após', 'after',
      'requer', 'requires', 'precisa que', 'needs',
      'bloqueado por', 'blocked by', 'antes de', 'before',
    ];
    const text = `${story.title} ${story.description}`.toLowerCase();
    return !dependencyKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Negotiable: description is not overly prescriptive (not too long).
   * Heuristic: description under 500 characters is considered negotiable.
   */
  private checkNegotiable(story: UserStoryData): boolean {
    // Strip HTML tags for length check
    const plainText = story.description.replace(/<[^>]*>/g, '');
    return plainText.length <= 500;
  }

  /**
   * Valuable: has clear benefit statement.
   * Heuristic: contains "para que", "so that", "benefit", or similar.
   */
  private checkValuable(story: UserStoryData): boolean {
    const valueKeywords = [
      'para que', 'so that', 'para', 'benefit',
      'valor', 'value', 'ganho', 'gain',
    ];
    const text = `${story.title} ${story.description}`.toLowerCase();
    return valueKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Estimable: scope is bounded (description length reasonable).
   * Heuristic: description under 1000 characters.
   */
  private checkEstimable(story: UserStoryData): boolean {
    const plainText = story.description.replace(/<[^>]*>/g, '');
    return plainText.length <= 1000;
  }

  /**
   * Small: acceptance criteria ≤ 6 items.
   */
  private checkSmall(story: UserStoryData): boolean {
    const liCount = (story.acceptanceCriteria.match(/<li>/gi) || []).length;
    return liCount <= 6;
  }

  /**
   * Testable: has concrete acceptance criteria (non-empty).
   */
  private checkTestable(story: UserStoryData): boolean {
    const plainCriteria = story.acceptanceCriteria.replace(/<[^>]*>/g, '').trim();
    // Must have actual content beyond placeholder text
    return plainCriteria.length > 0 && !plainCriteria.includes('a serem definidos');
  }

  // ─── Private: Utilities ─────────────────────────────────────────────────────

  /**
   * Escape special HTML characters in user input.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
