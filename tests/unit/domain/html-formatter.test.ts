import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  formatParagraph,
  formatBold,
  formatItalic,
  formatUnorderedList,
  formatOrderedList,
  formatDescription,
  formatAcceptanceCriteria,
  formatSection,
} from '../../../src/domain/html-formatter';

describe('html-formatter', () => {
  describe('escapeHtml', () => {
    it('should escape ampersand', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should escape less-than', () => {
      expect(escapeHtml('a < b')).toBe('a &lt; b');
    });

    it('should escape greater-than', () => {
      expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    it('should escape all special characters together', () => {
      expect(escapeHtml('<script>"alert(\'xss\')&"</script>')).toBe(
        '&lt;script&gt;&quot;alert(&#39;xss&#39;)&amp;&quot;&lt;/script&gt;'
      );
    });

    it('should return empty string for empty input', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should return empty string for null/undefined input', () => {
      expect(escapeHtml(null as unknown as string)).toBe('');
      expect(escapeHtml(undefined as unknown as string)).toBe('');
    });

    it('should not modify text without special characters', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('formatParagraph', () => {
    it('should wrap text in p tags', () => {
      expect(formatParagraph('Hello world')).toBe('<p>Hello world</p>');
    });

    it('should escape HTML in content', () => {
      expect(formatParagraph('a < b & c > d')).toBe(
        '<p>a &lt; b &amp; c &gt; d</p>'
      );
    });

    it('should return empty string for empty input', () => {
      expect(formatParagraph('')).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatParagraph(null as unknown as string)).toBe('');
    });
  });

  describe('formatBold', () => {
    it('should wrap text in strong tags', () => {
      expect(formatBold('important')).toBe('<strong>important</strong>');
    });

    it('should escape HTML in content', () => {
      expect(formatBold('<b>text</b>')).toBe(
        '<strong>&lt;b&gt;text&lt;/b&gt;</strong>'
      );
    });

    it('should return empty string for empty input', () => {
      expect(formatBold('')).toBe('');
    });
  });

  describe('formatItalic', () => {
    it('should wrap text in em tags', () => {
      expect(formatItalic('emphasis')).toBe('<em>emphasis</em>');
    });

    it('should escape HTML in content', () => {
      expect(formatItalic('a & b')).toBe('<em>a &amp; b</em>');
    });

    it('should return empty string for empty input', () => {
      expect(formatItalic('')).toBe('');
    });
  });

  describe('formatUnorderedList', () => {
    it('should create ul with li items', () => {
      expect(formatUnorderedList(['item 1', 'item 2'])).toBe(
        '<ul><li>item 1</li><li>item 2</li></ul>'
      );
    });

    it('should escape HTML in items', () => {
      expect(formatUnorderedList(['a < b', 'c & d'])).toBe(
        '<ul><li>a &lt; b</li><li>c &amp; d</li></ul>'
      );
    });

    it('should handle single item', () => {
      expect(formatUnorderedList(['only one'])).toBe(
        '<ul><li>only one</li></ul>'
      );
    });

    it('should return empty string for empty array', () => {
      expect(formatUnorderedList([])).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatUnorderedList(null as unknown as string[])).toBe('');
    });
  });

  describe('formatOrderedList', () => {
    it('should create ol with li items', () => {
      expect(formatOrderedList(['first', 'second', 'third'])).toBe(
        '<ol><li>first</li><li>second</li><li>third</li></ol>'
      );
    });

    it('should escape HTML in items', () => {
      expect(formatOrderedList(['"quoted"', "it's"])).toBe(
        '<ol><li>&quot;quoted&quot;</li><li>it&#39;s</li></ol>'
      );
    });

    it('should return empty string for empty array', () => {
      expect(formatOrderedList([])).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatOrderedList(null as unknown as string[])).toBe('');
    });
  });

  describe('formatDescription', () => {
    it('should format single line as one paragraph', () => {
      expect(formatDescription('Hello world')).toBe('<p>Hello world</p>');
    });

    it('should format multiple lines as multiple paragraphs', () => {
      expect(formatDescription('Line 1\nLine 2\nLine 3')).toBe(
        '<p>Line 1</p><p>Line 2</p><p>Line 3</p>'
      );
    });

    it('should skip empty lines', () => {
      expect(formatDescription('Line 1\n\nLine 2')).toBe(
        '<p>Line 1</p><p>Line 2</p>'
      );
    });

    it('should trim whitespace from lines', () => {
      expect(formatDescription('  hello  \n  world  ')).toBe(
        '<p>hello</p><p>world</p>'
      );
    });

    it('should escape HTML in content', () => {
      expect(formatDescription('a < b\nc & d')).toBe(
        '<p>a &lt; b</p><p>c &amp; d</p>'
      );
    });

    it('should return empty string for empty input', () => {
      expect(formatDescription('')).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatDescription(null as unknown as string)).toBe('');
    });

    it('should return empty string for whitespace-only input', () => {
      expect(formatDescription('   \n   \n   ')).toBe('');
    });
  });

  describe('formatAcceptanceCriteria', () => {
    it('should format criteria as unordered list', () => {
      expect(
        formatAcceptanceCriteria(['Criterion 1', 'Criterion 2'])
      ).toBe('<ul><li>Criterion 1</li><li>Criterion 2</li></ul>');
    });

    it('should escape HTML in criteria', () => {
      expect(formatAcceptanceCriteria(['a > b', 'x & y'])).toBe(
        '<ul><li>a &gt; b</li><li>x &amp; y</li></ul>'
      );
    });

    it('should return empty string for empty array', () => {
      expect(formatAcceptanceCriteria([])).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatAcceptanceCriteria(null as unknown as string[])).toBe('');
    });
  });

  describe('formatSection', () => {
    it('should create h3 title and p content', () => {
      expect(formatSection('Title', 'Content')).toBe(
        '<h3>Title</h3><p>Content</p>'
      );
    });

    it('should escape HTML in title and content', () => {
      expect(formatSection('<Title>', 'a & b')).toBe(
        '<h3>&lt;Title&gt;</h3><p>a &amp; b</p>'
      );
    });

    it('should handle empty title', () => {
      expect(formatSection('', 'Content')).toBe('<p>Content</p>');
    });

    it('should handle empty content', () => {
      expect(formatSection('Title', '')).toBe('<h3>Title</h3>');
    });

    it('should return empty string when both are empty', () => {
      expect(formatSection('', '')).toBe('');
    });
  });
});
