/**
 * WorkItemGenerator — Generates work item hierarchies from refinement session data.
 *
 * Uses HierarchyTemplateEngine to build Epic, Feature, and User Stories
 * from session.collectedInfo, then uses HierarchyBuilder to assemble and validate.
 * Delegates HTML formatting to the html-formatter module.
 *
 * Requirements: 4.1, 4.2, 4.3, 7.4, 7.5
 */

import { WorkItemHierarchy } from '../domain/models';
import { RefinementSession } from '../domain/types';
import {
  DefaultHierarchyTemplateEngine,
  HierarchyTemplateEngine,
} from '../domain/hierarchy-template-engine';
import { HierarchyBuilder, IHierarchyBuilder } from '../domain/hierarchy-builder';
import {
  formatDescription as htmlFormatDescription,
  formatAcceptanceCriteria as htmlFormatAcceptanceCriteria,
} from '../domain/html-formatter';

export interface WorkItemGenerator {
  generateHierarchy(session: RefinementSession): WorkItemHierarchy;
  formatDescription(content: string): string;
  formatAcceptanceCriteria(criteria: string[]): string;
}

/**
 * Default implementation of WorkItemGenerator.
 *
 * Orchestrates hierarchy generation by:
 * 1. Using HierarchyTemplateEngine to build Epic, Feature, and User Stories from collected info
 * 2. Using HierarchyBuilder to assemble and validate the hierarchy
 * 3. Delegating HTML formatting to the html-formatter module
 */
export class WorkItemGeneratorImpl implements WorkItemGenerator {
  private readonly templateEngine: HierarchyTemplateEngine;
  private readonly hierarchyBuilder: IHierarchyBuilder;

  constructor(
    templateEngine?: HierarchyTemplateEngine,
    hierarchyBuilder?: IHierarchyBuilder
  ) {
    this.templateEngine = templateEngine ?? new DefaultHierarchyTemplateEngine();
    this.hierarchyBuilder = hierarchyBuilder ?? new HierarchyBuilder();
  }

  /**
   * Generates a complete WorkItemHierarchy from the refinement session data.
   *
   * Uses the template engine to build each component from collectedInfo,
   * then assembles and validates via HierarchyBuilder.
   *
   * Requirements: 4.1, 4.2, 4.3
   */
  generateHierarchy(session: RefinementSession): WorkItemHierarchy {
    const { collectedInfo } = session;

    // Build individual components using the template engine
    const epic = this.templateEngine.buildEpic(collectedInfo);
    const feature = this.templateEngine.buildFeature(collectedInfo);
    const userStories = this.templateEngine.buildUserStories(collectedInfo);

    // Assemble hierarchy using the builder
    const hierarchy = this.hierarchyBuilder.build(epic, feature, userStories);

    // Validate the hierarchy
    const validation = this.hierarchyBuilder.validate(hierarchy);
    if (!validation.valid) {
      // If validation fails, still return the hierarchy but log warnings
      // The caller can decide how to handle validation issues
      console.warn(
        'WorkItemGenerator: hierarchy validation warnings:',
        validation.errors
      );
    }

    return hierarchy;
  }

  /**
   * Formats a description string as HTML paragraphs.
   * Delegates to the html-formatter module.
   *
   * Requirements: 7.4
   */
  formatDescription(content: string): string {
    return htmlFormatDescription(content);
  }

  /**
   * Formats acceptance criteria as an HTML unordered list.
   * Delegates to the html-formatter module.
   *
   * Requirements: 7.5
   */
  formatAcceptanceCriteria(criteria: string[]): string {
    return htmlFormatAcceptanceCriteria(criteria);
  }
}
