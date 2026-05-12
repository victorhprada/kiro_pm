/**
 * Standalone INVEST validation module for User Stories.
 *
 * Validates User Stories against the INVEST criteria:
 * - Independent: can be developed independently
 * - Negotiable: details are negotiable (not overly prescriptive)
 * - Valuable: delivers value to the user
 * - Estimable: can be estimated (bounded scope)
 * - Small: fits within a sprint
 * - Testable: has concrete, testable acceptance criteria
 *
 * Returns warnings for criteria not met.
 *
 * Requirements: 4.3
 */

import { UserStoryData } from './models';
import { INVESTValidation } from './types';

/**
 * Independent: no explicit dependency keywords in title or description.
 * Checks for common dependency indicators in both Portuguese and English.
 */
export function checkIndependent(story: UserStoryData): boolean {
  const dependencyKeywords = [
    'depende de', 'depends on', 'após', 'after',
    'requer', 'requires', 'precisa que', 'needs',
    'bloqueado por', 'blocked by', 'antes de', 'before',
  ];
  const text = `${story.title} ${story.description}`.toLowerCase();
  return !dependencyKeywords.some(keyword => text.includes(keyword));
}

/**
 * Negotiable: description is not overly prescriptive.
 * Heuristic: plain text description (HTML stripped) ≤ 500 characters.
 */
export function checkNegotiable(story: UserStoryData): boolean {
  const plainText = story.description.replace(/<[^>]*>/g, '');
  return plainText.length <= 500;
}

/**
 * Valuable: has clear benefit statement.
 * Heuristic: title or description contains benefit/value keywords.
 */
export function checkValuable(story: UserStoryData): boolean {
  const valueKeywords = [
    'para que', 'so that', 'para', 'benefit',
    'valor', 'value', 'ganho', 'gain',
  ];
  const text = `${story.title} ${story.description}`.toLowerCase();
  return valueKeywords.some(keyword => text.includes(keyword));
}

/**
 * Estimable: scope is bounded.
 * Heuristic: plain text description (HTML stripped) ≤ 1000 characters.
 */
export function checkEstimable(story: UserStoryData): boolean {
  const plainText = story.description.replace(/<[^>]*>/g, '');
  return plainText.length <= 1000;
}

/**
 * Small: fits within a sprint.
 * Heuristic: acceptance criteria has ≤ 6 `<li>` items.
 */
export function checkSmall(story: UserStoryData): boolean {
  const liCount = (story.acceptanceCriteria.match(/<li>/gi) || []).length;
  return liCount <= 6;
}

/**
 * Testable: has concrete acceptance criteria.
 * Heuristic: non-empty acceptance criteria without placeholder text.
 */
export function checkTestable(story: UserStoryData): boolean {
  const plainCriteria = story.acceptanceCriteria.replace(/<[^>]*>/g, '').trim();
  return plainCriteria.length > 0 && !plainCriteria.includes('a serem definidos');
}

/**
 * Validate a User Story against all INVEST criteria.
 * Returns the validation result with individual criterion outcomes and warnings.
 */
export function validateINVEST(story: UserStoryData): INVESTValidation {
  const warnings: string[] = [];

  const independent = checkIndependent(story);
  if (!independent) {
    warnings.push('Story may have dependencies on other stories (contains dependency keywords).');
  }

  const negotiable = checkNegotiable(story);
  if (!negotiable) {
    warnings.push('Story description may be overly prescriptive (too detailed/long).');
  }

  const valuable = checkValuable(story);
  if (!valuable) {
    warnings.push('Story may not clearly express value/benefit to the user.');
  }

  const estimable = checkEstimable(story);
  if (!estimable) {
    warnings.push('Story scope may be too broad to estimate accurately.');
  }

  const small = checkSmall(story);
  if (!small) {
    warnings.push('Story may be too large (more than 6 acceptance criteria).');
  }

  const testable = checkTestable(story);
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
