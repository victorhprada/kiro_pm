import { describe, it, expect } from 'vitest';
import {
  checkIndependent,
  checkNegotiable,
  checkValuable,
  checkEstimable,
  checkSmall,
  checkTestable,
  validateINVEST,
} from '../../../src/domain/invest-validation';
import { UserStoryData } from '../../../src/domain/models';

function makeStory(overrides: Partial<UserStoryData> = {}): UserStoryData {
  return {
    title: 'Configurar conexão com Azure DevOps',
    description: '<p>Como usuário, eu quero configurar minha conexão, para que eu possa criar work items.</p>',
    acceptanceCriteria: '<ul><li>Valida conexão</li><li>Mensagem de erro se PAT inválido</li></ul>',
    areaPath: '',
    ...overrides,
  };
}

describe('checkIndependent', () => {
  it('returns true when no dependency keywords are present', () => {
    const story = makeStory();
    expect(checkIndependent(story)).toBe(true);
  });

  it('returns false when description contains "depende de"', () => {
    const story = makeStory({ description: '<p>Esta story depende de outra story ser concluída.</p>' });
    expect(checkIndependent(story)).toBe(false);
  });

  it('returns false when description contains "depends on"', () => {
    const story = makeStory({ description: '<p>This story depends on the auth module.</p>' });
    expect(checkIndependent(story)).toBe(false);
  });

  it('returns false when title contains "após"', () => {
    const story = makeStory({ title: 'Implementar após a autenticação' });
    expect(checkIndependent(story)).toBe(false);
  });

  it('returns false when description contains "blocked by"', () => {
    const story = makeStory({ description: '<p>Blocked by infrastructure setup.</p>' });
    expect(checkIndependent(story)).toBe(false);
  });
});

describe('checkNegotiable', () => {
  it('returns true when description plain text is ≤ 500 chars', () => {
    const story = makeStory({ description: '<p>Short description.</p>' });
    expect(checkNegotiable(story)).toBe(true);
  });

  it('returns false when description plain text exceeds 500 chars', () => {
    const longText = 'a'.repeat(501);
    const story = makeStory({ description: `<p>${longText}</p>` });
    expect(checkNegotiable(story)).toBe(false);
  });

  it('strips HTML tags before measuring length', () => {
    // HTML tags should not count toward the 500 char limit
    const text = 'a'.repeat(490);
    const story = makeStory({ description: `<div><p><strong>${text}</strong></p></div>` });
    expect(checkNegotiable(story)).toBe(true);
  });
});

describe('checkValuable', () => {
  it('returns true when description contains "para que"', () => {
    const story = makeStory({ description: '<p>Como usuário, eu quero X, para que Y.</p>' });
    expect(checkValuable(story)).toBe(true);
  });

  it('returns true when description contains "so that"', () => {
    const story = makeStory({ description: '<p>As a user, I want X, so that Y.</p>' });
    expect(checkValuable(story)).toBe(true);
  });

  it('returns true when description contains "value"', () => {
    const story = makeStory({ description: '<p>This delivers value to the team.</p>' });
    expect(checkValuable(story)).toBe(true);
  });

  it('returns false when no value keywords are present', () => {
    const story = makeStory({
      title: 'Refactor code',
      description: '<p>Clean up the module structure.</p>',
    });
    expect(checkValuable(story)).toBe(false);
  });
});

describe('checkEstimable', () => {
  it('returns true when description plain text is ≤ 1000 chars', () => {
    const story = makeStory({ description: '<p>Reasonable scope description.</p>' });
    expect(checkEstimable(story)).toBe(true);
  });

  it('returns false when description plain text exceeds 1000 chars', () => {
    const longText = 'b'.repeat(1001);
    const story = makeStory({ description: `<p>${longText}</p>` });
    expect(checkEstimable(story)).toBe(false);
  });
});

describe('checkSmall', () => {
  it('returns true when acceptance criteria has ≤ 6 li items', () => {
    const story = makeStory({
      acceptanceCriteria: '<ul><li>A</li><li>B</li><li>C</li></ul>',
    });
    expect(checkSmall(story)).toBe(true);
  });

  it('returns true when acceptance criteria has exactly 6 li items', () => {
    const items = Array.from({ length: 6 }, (_, i) => `<li>Item ${i + 1}</li>`).join('');
    const story = makeStory({ acceptanceCriteria: `<ul>${items}</ul>` });
    expect(checkSmall(story)).toBe(true);
  });

  it('returns false when acceptance criteria has more than 6 li items', () => {
    const items = Array.from({ length: 7 }, (_, i) => `<li>Item ${i + 1}</li>`).join('');
    const story = makeStory({ acceptanceCriteria: `<ul>${items}</ul>` });
    expect(checkSmall(story)).toBe(false);
  });
});

describe('checkTestable', () => {
  it('returns true when acceptance criteria has concrete content', () => {
    const story = makeStory({
      acceptanceCriteria: '<ul><li>System validates connection</li></ul>',
    });
    expect(checkTestable(story)).toBe(true);
  });

  it('returns false when acceptance criteria is empty', () => {
    const story = makeStory({ acceptanceCriteria: '' });
    expect(checkTestable(story)).toBe(false);
  });

  it('returns false when acceptance criteria contains only HTML tags', () => {
    const story = makeStory({ acceptanceCriteria: '<ul></ul>' });
    expect(checkTestable(story)).toBe(false);
  });

  it('returns false when acceptance criteria contains placeholder text', () => {
    const story = makeStory({
      acceptanceCriteria: '<ul><li>Critérios de aceitação a serem definidos</li></ul>',
    });
    expect(checkTestable(story)).toBe(false);
  });
});

describe('validateINVEST', () => {
  it('returns all criteria passed for a well-formed story', () => {
    const story = makeStory();
    const result = validateINVEST(story);

    expect(result.independent).toBe(true);
    expect(result.negotiable).toBe(true);
    expect(result.valuable).toBe(true);
    expect(result.estimable).toBe(true);
    expect(result.small).toBe(true);
    expect(result.testable).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns passed=false when any criterion fails', () => {
    const story = makeStory({
      description: '<p>This story depends on the auth module being ready.</p>',
    });
    const result = validateINVEST(story);

    expect(result.independent).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('collects multiple warnings when multiple criteria fail', () => {
    const longText = 'x'.repeat(501);
    const items = Array.from({ length: 8 }, (_, i) => `<li>Item ${i}</li>`).join('');
    const story = makeStory({
      title: 'Refactor code',
      description: `<p>${longText}</p>`,
      acceptanceCriteria: `<ul>${items}</ul>`,
    });
    const result = validateINVEST(story);

    expect(result.negotiable).toBe(false);
    expect(result.valuable).toBe(false);
    expect(result.small).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('returns correct warning messages for each failed criterion', () => {
    const story = makeStory({
      title: 'Refactor',
      description: '<p>Depends on auth module. ' + 'a'.repeat(1001) + '</p>',
      acceptanceCriteria: '',
    });
    const result = validateINVEST(story);

    expect(result.warnings).toContain('Story may have dependencies on other stories (contains dependency keywords).');
    expect(result.warnings).toContain('Story description may be overly prescriptive (too detailed/long).');
    expect(result.warnings).toContain('Story scope may be too broad to estimate accurately.');
    expect(result.warnings).toContain('Story may not clearly express value/benefit to the user.');
    expect(result.warnings).toContain('Story lacks concrete, testable acceptance criteria.');
  });
});
