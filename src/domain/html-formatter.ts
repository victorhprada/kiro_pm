/**
 * HTML Formatter for Azure DevOps Work Item content.
 * Formats descriptions and acceptance criteria as valid HTML
 * compatible with Azure DevOps rich text fields.
 *
 * Requirements: 7.4, 7.5
 */

/**
 * Escapes HTML special characters to prevent injection and ensure valid HTML output.
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wraps text in paragraph tags. Escapes HTML in the content.
 */
export function formatParagraph(text: string): string {
  if (!text) return '';
  return `<p>${escapeHtml(text)}</p>`;
}

/**
 * Wraps text in strong (bold) tags. Escapes HTML in the content.
 */
export function formatBold(text: string): string {
  if (!text) return '';
  return `<strong>${escapeHtml(text)}</strong>`;
}

/**
 * Wraps text in em (italic) tags. Escapes HTML in the content.
 */
export function formatItalic(text: string): string {
  if (!text) return '';
  return `<em>${escapeHtml(text)}</em>`;
}

/**
 * Creates an unordered list from an array of items. Escapes HTML in each item.
 */
export function formatUnorderedList(items: string[]): string {
  if (!items || items.length === 0) return '';
  const listItems = items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  return `<ul>${listItems}</ul>`;
}

/**
 * Creates an ordered list from an array of items. Escapes HTML in each item.
 */
export function formatOrderedList(items: string[]): string {
  if (!items || items.length === 0) return '';
  const listItems = items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  return `<ol>${listItems}</ol>`;
}

/**
 * Formats a multi-line description as HTML paragraphs.
 * Each non-empty line or block of text becomes a paragraph.
 */
export function formatDescription(content: string): string {
  if (!content) return '';
  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) return '';
  return lines.map((line) => `<p>${escapeHtml(line.trim())}</p>`).join('');
}

/**
 * Formats acceptance criteria as an HTML unordered list.
 * Each criterion becomes a list item.
 */
export function formatAcceptanceCriteria(criteria: string[]): string {
  if (!criteria || criteria.length === 0) return '';
  return formatUnorderedList(criteria);
}

/**
 * Creates a section with a title (h3) and content (paragraph).
 */
export function formatSection(title: string, content: string): string {
  if (!title && !content) return '';
  const titleHtml = title ? `<h3>${escapeHtml(title)}</h3>` : '';
  const contentHtml = content ? `<p>${escapeHtml(content)}</p>` : '';
  return `${titleHtml}${contentHtml}`;
}
