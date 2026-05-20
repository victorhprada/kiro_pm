/**
 * GitHub Pull Request URL Extractor
 *
 * Extrai URLs de PRs do GitHub (organização wiipobr) a partir de textos
 * arbitrários — tipicamente comentários de cards do Azure DevOps.
 *
 * Aceita variações comuns:
 * - URL "limpa": https://github.com/wiipobr/<repo>/pull/<n>
 * - URL com fragmento: .../pull/123#issuecomment-456
 * - URL com query string: .../pull/123?...
 * - URL como texto puro ou dentro de <a href="...">
 *
 * Não faz fetch nem normaliza para um formato canônico além de
 * remover query/fragment, mantendo apenas a URL base do PR.
 */

const GITHUB_PR_PATTERN =
  /https:\/\/github\.com\/wiipobr\/([A-Za-z0-9._-]+)\/pull\/(\d+)/g;

export interface GithubPullRequest {
  url: string;
  repo: string;
  number: number;
}

/**
 * Extrai todos os PRs únicos da organização wiipobr presentes em `text`.
 * Resultado é deduplicado por (repo, number) e ordenado pela primeira ocorrência.
 *
 * @param text - texto de origem (HTML ou plain text)
 * @returns lista de PRs únicos encontrados
 */
export function extractWiipoPullRequests(
  text: string | null | undefined
): GithubPullRequest[] {
  if (!text) {
    return [];
  }

  const seen = new Set<string>();
  const results: GithubPullRequest[] = [];

  // Reset regex state — \g flags são stateful em RegExp objects
  const pattern = new RegExp(GITHUB_PR_PATTERN.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const repo = match[1];
    const number = Number.parseInt(match[2], 10);
    const key = `${repo}#${number}`;

    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    results.push({
      url: `https://github.com/wiipobr/${repo}/pull/${number}`,
      repo,
      number,
    });
  }

  return results;
}

/**
 * Versão "multi-fonte" — recebe vários trechos (ex.: lista de comentários)
 * e devolve o conjunto único de PRs presentes em qualquer um deles,
 * preservando a ordem de primeira ocorrência.
 */
export function extractWiipoPullRequestsFromMany(
  texts: ReadonlyArray<string | null | undefined>
): GithubPullRequest[] {
  const seen = new Set<string>();
  const results: GithubPullRequest[] = [];

  for (const text of texts) {
    for (const pr of extractWiipoPullRequests(text)) {
      const key = `${pr.repo}#${pr.number}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push(pr);
    }
  }

  return results;
}
