/**
 * Unit tests for GitHub PR Extractor (domain/github-pr-extractor)
 */

import { describe, it, expect } from 'vitest';
import {
  extractWiipoPullRequests,
  extractWiipoPullRequestsFromMany,
} from '../../../src/domain/github-pr-extractor';

describe('extractWiipoPullRequests', () => {
  it('returns empty array for null/undefined/empty inputs', () => {
    expect(extractWiipoPullRequests(null)).toEqual([]);
    expect(extractWiipoPullRequests(undefined)).toEqual([]);
    expect(extractWiipoPullRequests('')).toEqual([]);
  });

  it('extracts a single canonical wiipobr PR URL', () => {
    const text = 'Subindo: https://github.com/wiipobr/wiipo-mobile-backend/pull/1441';
    const prs = extractWiipoPullRequests(text);

    expect(prs).toHaveLength(1);
    expect(prs[0]).toEqual({
      url: 'https://github.com/wiipobr/wiipo-mobile-backend/pull/1441',
      repo: 'wiipo-mobile-backend',
      number: 1441,
    });
  });

  it('extracts multiple PRs from different wiipobr repos', () => {
    const text = `
      PR backend: https://github.com/wiipobr/wiipo-mobile-backend/pull/1441
      PR app: https://github.com/wiipobr/wiipoflex-app/pull/87
    `;
    const prs = extractWiipoPullRequests(text);

    expect(prs).toHaveLength(2);
    expect(prs.map((p) => p.repo)).toEqual([
      'wiipo-mobile-backend',
      'wiipoflex-app',
    ]);
    expect(prs.map((p) => p.number)).toEqual([1441, 87]);
  });

  it('strips fragment (#issuecomment) and query string from extracted URL', () => {
    const text =
      'Comentário: https://github.com/wiipobr/wiipo-mobile-backend/pull/1441#issuecomment-99999 ' +
      'e https://github.com/wiipobr/wiipo-mobile-backend/pull/1442?diff=split';

    const prs = extractWiipoPullRequests(text);

    expect(prs).toHaveLength(2);
    expect(prs[0].url).toBe(
      'https://github.com/wiipobr/wiipo-mobile-backend/pull/1441'
    );
    expect(prs[1].url).toBe(
      'https://github.com/wiipobr/wiipo-mobile-backend/pull/1442'
    );
  });

  it('extracts PR URL from inside an HTML anchor tag', () => {
    const html =
      '<p>PR pronto: <a href="https://github.com/wiipobr/wiipo-platform/pull/57">' +
      'wiipobr/wiipo-platform#57</a></p>';

    const prs = extractWiipoPullRequests(html);
    expect(prs).toHaveLength(1);
    expect(prs[0].url).toBe(
      'https://github.com/wiipobr/wiipo-platform/pull/57'
    );
  });

  it('deduplicates the same PR appearing multiple times', () => {
    const text = `
      Primeira menção: https://github.com/wiipobr/wiipo-mobile-backend/pull/1441
      Segunda menção: https://github.com/wiipobr/wiipo-mobile-backend/pull/1441#issuecomment-1
      Terceira:       https://github.com/wiipobr/wiipo-mobile-backend/pull/1441
    `;
    const prs = extractWiipoPullRequests(text);
    expect(prs).toHaveLength(1);
  });

  it('ignores PRs from organizations other than wiipobr', () => {
    const text = `
      https://github.com/microsoft/vscode/pull/1234
      https://github.com/wiipobr/wiipo-platform/pull/77
      https://github.com/octocat/hello-world/pull/1
    `;
    const prs = extractWiipoPullRequests(text);
    expect(prs).toHaveLength(1);
    expect(prs[0].repo).toBe('wiipo-platform');
  });

  it('ignores GitHub URLs that are not pull request URLs', () => {
    const text = `
      Repo: https://github.com/wiipobr/wiipo-platform
      Issue: https://github.com/wiipobr/wiipo-platform/issues/42
      PR:    https://github.com/wiipobr/wiipo-platform/pull/100
    `;
    const prs = extractWiipoPullRequests(text);
    expect(prs).toHaveLength(1);
    expect(prs[0].number).toBe(100);
  });

  it('preserves order of first occurrence', () => {
    const text =
      'https://github.com/wiipobr/repo-c/pull/3 ' +
      'https://github.com/wiipobr/repo-a/pull/1 ' +
      'https://github.com/wiipobr/repo-b/pull/2';

    const prs = extractWiipoPullRequests(text);
    expect(prs.map((p) => p.repo)).toEqual(['repo-c', 'repo-a', 'repo-b']);
  });

  it('handles repo names with dots, dashes and underscores', () => {
    const text =
      'https://github.com/wiipobr/wiipo.flex-mobile_v2/pull/9';
    const prs = extractWiipoPullRequests(text);
    expect(prs).toHaveLength(1);
    expect(prs[0].repo).toBe('wiipo.flex-mobile_v2');
  });
});

describe('extractWiipoPullRequestsFromMany', () => {
  it('returns empty array when given empty list', () => {
    expect(extractWiipoPullRequestsFromMany([])).toEqual([]);
  });

  it('aggregates PRs across multiple texts and deduplicates them', () => {
    const texts = [
      'Primeiro comentário com https://github.com/wiipobr/repo-a/pull/1',
      'Outro comentário com https://github.com/wiipobr/repo-b/pull/2',
      'Repetido: https://github.com/wiipobr/repo-a/pull/1',
    ];

    const prs = extractWiipoPullRequestsFromMany(texts);
    expect(prs).toHaveLength(2);
    expect(prs.map((p) => p.repo)).toEqual(['repo-a', 'repo-b']);
  });

  it('skips null/undefined entries gracefully', () => {
    const texts = [
      null,
      undefined,
      'https://github.com/wiipobr/repo-x/pull/9',
    ];
    const prs = extractWiipoPullRequestsFromMany(texts);
    expect(prs).toHaveLength(1);
    expect(prs[0].repo).toBe('repo-x');
  });
});
