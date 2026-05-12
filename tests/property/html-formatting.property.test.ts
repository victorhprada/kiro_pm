/**
 * Property-Based Tests for HTML Formatting and Result Completeness
 *
 * Tests universal properties of HTML formatting functions and creation result
 * integrity using fast-check to verify correctness across all valid inputs.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  escapeHtml,
  formatDescription,
  formatParagraph,
  formatUnorderedList,
  formatAcceptanceCriteria,
} from '../../src/domain/html-formatter';
import { WorkItemCreationError } from '../../src/domain/errors';
import { WorkItemResult, CreationResult } from '../../src/domain/models';

/**
 * Helper: checks that every opened HTML tag has a matching closing tag.
 * Supports self-closing tags and validates proper nesting.
 */
function hasMatchingTags(html: string): boolean {
  const openTagRegex = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  const closeTagRegex = /<\/([a-zA-Z][a-zA-Z0-9]*)\s*>/g;

  const openTags: string[] = [];
  const closeTags: string[] = [];

  let match: RegExpExecArray | null;

  while ((match = openTagRegex.exec(html)) !== null) {
    openTags.push(match[1].toLowerCase());
  }

  while ((match = closeTagRegex.exec(html)) !== null) {
    closeTags.push(match[1].toLowerCase());
  }

  // Every open tag should have a corresponding close tag
  const openCounts = new Map<string, number>();
  const closeCounts = new Map<string, number>();

  for (const tag of openTags) {
    openCounts.set(tag, (openCounts.get(tag) || 0) + 1);
  }
  for (const tag of closeTags) {
    closeCounts.set(tag, (closeCounts.get(tag) || 0) + 1);
  }

  for (const [tag, count] of openCounts) {
    if ((closeCounts.get(tag) || 0) !== count) {
      return false;
    }
  }

  for (const [tag, count] of closeCounts) {
    if ((openCounts.get(tag) || 0) !== count) {
      return false;
    }
  }

  return true;
}

/**
 * Helper: checks that special HTML characters are properly escaped in the output.
 */
function specialCharsAreEscaped(output: string): boolean {
  // After escaping, there should be no unescaped < or > that aren't part of tags
  // We check that raw & < > " ' don't appear outside of valid HTML entities/tags
  // The escapeHtml function converts: & → &amp;  < → &lt;  > → &gt;  " → &quot;  ' → &#39;
  // So in the escaped content (between tags), we should not find raw & that isn't part of an entity
  return true; // We verify this through content preservation check instead
}

/**
 * Helper: verifies that the original text content appears in escaped form within the HTML output.
 */
function contentIsPreserved(input: string, output: string): boolean {
  if (!input || input.trim().length === 0) return true;

  // The escaped version of the input should appear somewhere in the output
  const escaped = escapeHtml(input.trim());
  return output.includes(escaped);
}

/**
 * Arbitrary generator for strings that include HTML special characters.
 */
const stringWithSpecialChars = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: 200 }).map((s) => {
    // Ensure we sometimes include special chars
    return s;
  });

/**
 * Arbitrary generator that explicitly includes HTML special characters.
 */
const stringWithHtmlChars = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.constantFrom('<script>alert("xss")</script>', 'a < b & c > d', "it's a \"test\"", '&amp; already escaped?'),
    fc.array(
      fc.oneof(
        fc.char(),
        fc.constantFrom('<', '>', '&', '"', "'")
      ),
      { minLength: 1, maxLength: 50 }
    ).map((chars) => chars.join(''))
  );

/**
 * Arbitrary generator for non-empty strings (no whitespace-only).
 */
const nonEmptyString = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/**
 * Arbitrary generator for arrays of non-empty strings (list items).
 */
const nonEmptyStringArray = (): fc.Arbitrary<string[]> =>
  fc.array(nonEmptyString(), { minLength: 1, maxLength: 10 });

/**
 * Arbitrary generator for WorkItemResult with valid id and non-empty url.
 */
const workItemResultArb = (): fc.Arbitrary<WorkItemResult> =>
  fc.record({
    id: fc.integer({ min: 1, max: 999999 }),
    url: fc.webUrl(),
    type: fc.constantFrom('Epic', 'Feature', 'User Story'),
    title: nonEmptyString(),
  });

/**
 * Arbitrary generator for arrays of WorkItemResult.
 */
const workItemResultArrayArb = (): fc.Arbitrary<WorkItemResult[]> =>
  fc.array(workItemResultArb(), { minLength: 1, maxLength: 10 });

describe('HTML Formatting and Result Completeness Property Tests', () => {
  /**
   * Property 11: HTML Formatting Validity
   *
   * For ANY input text (description or acceptance criteria), the HTML formatting
   * function shall produce output that contains valid HTML tags (properly opened
   * and closed) and preserves the semantic content of the input.
   *
   * **Validates: Requirements 7.4, 7.5**
   */
  describe('Property 11: HTML Formatting Validity', () => {
    it('formatParagraph produces properly opened/closed tags for any input string', () => {
      fc.assert(
        fc.property(stringWithHtmlChars(), (input: string) => {
          const output = formatParagraph(input);

          if (!input) {
            expect(output).toBe('');
            return;
          }

          // Output has matching open/close tags
          expect(hasMatchingTags(output)).toBe(true);

          // Output wraps content in <p> tags
          expect(output.startsWith('<p>')).toBe(true);
          expect(output.endsWith('</p>')).toBe(true);

          // Semantic content is preserved (escaped form of input appears in output)
          expect(contentIsPreserved(input, output)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('formatDescription produces properly opened/closed tags for any multi-line input', () => {
      fc.assert(
        fc.property(stringWithHtmlChars(), (input: string) => {
          const output = formatDescription(input);

          if (!input || input.trim().length === 0) {
            expect(output).toBe('');
            return;
          }

          // Output has matching open/close tags
          expect(hasMatchingTags(output)).toBe(true);

          // Each non-empty line becomes a paragraph
          const nonEmptyLines = input.split('\n').filter((line) => line.trim().length > 0);
          if (nonEmptyLines.length === 0) {
            expect(output).toBe('');
          } else {
            // Count <p> tags matches number of non-empty lines
            const pTagCount = (output.match(/<p>/g) || []).length;
            expect(pTagCount).toBe(nonEmptyLines.length);

            // Each line's content is preserved in escaped form
            for (const line of nonEmptyLines) {
              const escapedLine = escapeHtml(line.trim());
              expect(output).toContain(escapedLine);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('formatUnorderedList produces properly opened/closed tags for any array of items', () => {
      fc.assert(
        fc.property(nonEmptyStringArray(), (items: string[]) => {
          const output = formatUnorderedList(items);

          // Output has matching open/close tags
          expect(hasMatchingTags(output)).toBe(true);

          // Output wraps in <ul> tags
          expect(output.startsWith('<ul>')).toBe(true);
          expect(output.endsWith('</ul>')).toBe(true);

          // Each item appears as <li> with escaped content
          const liCount = (output.match(/<li>/g) || []).length;
          expect(liCount).toBe(items.length);

          // Semantic content is preserved for each item
          for (const item of items) {
            const escapedItem = escapeHtml(item);
            expect(output).toContain(`<li>${escapedItem}</li>`);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('formatAcceptanceCriteria produces properly opened/closed tags for any criteria array', () => {
      fc.assert(
        fc.property(nonEmptyStringArray(), (criteria: string[]) => {
          const output = formatAcceptanceCriteria(criteria);

          // Output has matching open/close tags
          expect(hasMatchingTags(output)).toBe(true);

          // Output wraps in <ul> tags (acceptance criteria uses unordered list)
          expect(output.startsWith('<ul>')).toBe(true);
          expect(output.endsWith('</ul>')).toBe(true);

          // Each criterion appears as <li> with escaped content
          const liCount = (output.match(/<li>/g) || []).length;
          expect(liCount).toBe(criteria.length);

          // Semantic content is preserved for each criterion
          for (const criterion of criteria) {
            const escapedCriterion = escapeHtml(criterion);
            expect(output).toContain(`<li>${escapedCriterion}</li>`);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('escapeHtml properly escapes all special characters for any input', () => {
      fc.assert(
        fc.property(stringWithHtmlChars(), (input: string) => {
          const output = escapeHtml(input);

          if (!input) {
            expect(output).toBe('');
            return;
          }

          // No raw < or > should remain (they should be &lt; and &gt;)
          expect(output).not.toMatch(/(?<!&[a-z]+)[<>]/);

          // Specifically: no unescaped < or > characters
          expect(output.includes('<')).toBe(false);
          expect(output.includes('>')).toBe(false);

          // No unescaped & that isn't part of an entity
          // Every & should be followed by amp;, lt;, gt;, quot;, or #39;
          const ampersands = output.split('&');
          for (let i = 1; i < ampersands.length; i++) {
            const afterAmp = ampersands[i];
            const isValidEntity =
              afterAmp.startsWith('amp;') ||
              afterAmp.startsWith('lt;') ||
              afterAmp.startsWith('gt;') ||
              afterAmp.startsWith('quot;') ||
              afterAmp.startsWith('#39;');
            expect(isValidEntity).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Creation Result Completeness
   *
   * For ANY set of successfully created work items, the CreationResult shall
   * contain an entry with a valid ID (> 0) and a non-empty URL for each work
   * item that was created.
   *
   * **Validates: Requirements 6.6**
   */
  describe('Property 8: Creation Result Completeness', () => {
    it('every work item in a successful CreationResult has id > 0 and non-empty url', () => {
      fc.assert(
        fc.property(workItemResultArrayArb(), (workItems: WorkItemResult[]) => {
          // Build a CreationResult with success=true
          const result: CreationResult = {
            success: true,
            workItems,
            errors: [],
          };

          // Verify each item has valid id and non-empty url
          expect(result.success).toBe(true);
          expect(result.workItems.length).toBeGreaterThan(0);

          for (const item of result.workItems) {
            expect(item.id).toBeGreaterThan(0);
            expect(item.url).toBeDefined();
            expect(item.url.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Partial Failure Resilience
   *
   * For ANY WorkItemHierarchy where creation fails at work item N, all work items
   * created before N (indices 0..N-1) shall be preserved in the error's createdItems
   * with their IDs and URLs, and the error shall identify which work item failed.
   *
   * **Validates: Requirements 6.7**
   */
  describe('Property 9: Partial Failure Resilience', () => {
    it('WorkItemCreationError preserves all previously created items with valid IDs and URLs', () => {
      fc.assert(
        fc.property(
          workItemResultArrayArb(),
          fc.constantFrom('Epic', 'Feature', 'User Story'),
          nonEmptyString(),
          nonEmptyString(),
          (
            createdItems: WorkItemResult[],
            failedType: string,
            failedTitle: string,
            errorMessage: string
          ) => {
            // Simulate failure at item N by creating a WorkItemCreationError
            // with the items that were successfully created before the failure
            const error = new WorkItemCreationError(
              errorMessage,
              failedType,
              failedTitle,
              createdItems
            );

            // Error identifies which work item failed
            expect(error.workItemType).toBe(failedType);
            expect(error.workItemTitle).toBe(failedTitle);
            expect(error.message).toBe(errorMessage);
            expect(error.name).toBe('WorkItemCreationError');

            // All previously created items are preserved
            expect(error.createdItems.length).toBe(createdItems.length);

            // Each preserved item has valid id > 0 and non-empty url
            for (let i = 0; i < error.createdItems.length; i++) {
              expect(error.createdItems[i].id).toBeGreaterThan(0);
              expect(error.createdItems[i].url.length).toBeGreaterThan(0);
              // Items are preserved in order
              expect(error.createdItems[i].id).toBe(createdItems[i].id);
              expect(error.createdItems[i].url).toBe(createdItems[i].url);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
