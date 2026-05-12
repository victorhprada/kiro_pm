import { describe, it, expect } from 'vitest';
import {
  analyzeFeature,
  formatAnalysisForEpic,
  formatAnalysisForFeature,
  FeatureAnalysis,
} from '../../../src/domain/feature-analysis';
import { CollectedInfo } from '../../../src/domain/types';

function makeCollectedInfo(overrides: Partial<CollectedInfo> = {}): CollectedInfo {
  return {
    context: 'Automatizar criação de work items no Azure DevOps',
    objective: 'Reduzir tempo de criação de demandas',
    customerBenefit: 'Equipes de desenvolvimento ganham produtividade ao não precisar criar work items manualmente',
    targetAudience: 'Desenvolvedores e PMs de todas as equipes',
    customerJobs: 'Criar work items rapidamente',
    customerGains: 'Economia de tempo',
    keyFeatures: 'Criação automática de Epic, Feature, User Stories',
    scopeLimits: 'Apenas Azure DevOps',
    userScenarios: 'When I have a new feature, I want to create work items, so I can track progress',
    acceptanceCriteria: 'Work items criados com vínculos corretos',
    ...overrides,
  };
}

describe('analyzeFeature', () => {
  it('should return a valid FeatureAnalysis with all fields', () => {
    const info = makeCollectedInfo();
    const result = analyzeFeature(info);

    expect(result).toHaveProperty('theme');
    expect(result).toHaveProperty('strategicAlignment');
    expect(result).toHaveProperty('impact');
    expect(result).toHaveProperty('effort');
    expect(result).toHaveProperty('risk');
    expect(result).toHaveProperty('priority');
    expect(result.priority).toBeGreaterThanOrEqual(1);
    expect(result.priority).toBeLessThanOrEqual(5);
  });

  it('should derive "Automação" theme from automation keywords', () => {
    const info = makeCollectedInfo({ context: 'Automatizar processos de deploy' });
    const result = analyzeFeature(info);
    expect(result.theme).toBe('Automação');
  });

  it('should derive "Integração" theme from integration keywords', () => {
    const info = makeCollectedInfo({
      context: 'Conectar sistema com API externa',
      objective: 'Integração com parceiros',
      keyFeatures: 'API REST',
    });
    const result = analyzeFeature(info);
    expect(result.theme).toBe('Integração');
  });

  it('should derive "Segurança" theme from security keywords', () => {
    const info = makeCollectedInfo({
      context: 'Implementar autenticação multi-fator',
      objective: 'Melhorar segurança do sistema',
      keyFeatures: 'MFA, OAuth',
    });
    const result = analyzeFeature(info);
    expect(result.theme).toBe('Segurança');
  });

  it('should default to "Produto" theme when no keywords match', () => {
    const info = makeCollectedInfo({
      context: 'Criar algo novo',
      objective: 'Entregar valor',
      keyFeatures: 'Coisas',
    });
    const result = analyzeFeature(info);
    expect(result.theme).toBe('Produto');
  });

  it('should use strategicAlignment field when provided', () => {
    const info = makeCollectedInfo({
      strategicAlignment: 'Alinhado com OKR Q1 de produtividade',
    });
    const result = analyzeFeature(info);
    expect(result.strategicAlignment).toBe('Alinhado com OKR Q1 de produtividade');
  });

  it('should infer strategic alignment from objective and benefit when not provided', () => {
    const info = makeCollectedInfo({
      strategicAlignment: undefined,
      objective: 'Reduzir custos',
      customerBenefit: 'Economia de 30% no orçamento',
    });
    const result = analyzeFeature(info);
    expect(result.strategicAlignment).toContain('Reduzir custos');
    expect(result.strategicAlignment).toContain('Economia de 30% no orçamento');
  });

  it('should assess high impact for broad audience and strong benefit', () => {
    const info = makeCollectedInfo({
      targetAudience: 'Todos os colaboradores da empresa',
      customerBenefit: 'Redução significativa de tempo gasto em tarefas manuais. Melhoria na qualidade das entregas.',
    });
    const result = analyzeFeature(info);
    expect(result.impact).toBe('high');
  });

  it('should assess low impact for narrow audience and weak benefit', () => {
    const info = makeCollectedInfo({
      targetAudience: 'Apenas o admin do sistema',
      customerBenefit: 'Conveniência',
    });
    const result = analyzeFeature(info);
    expect(result.impact).toBe('low');
  });

  it('should assess high effort for many features with integrations', () => {
    const info = makeCollectedInfo({
      keyFeatures: 'Login, Dashboard, Relatórios, Notificações, API, Webhooks',
      integrations: 'Slack, Teams, Jira',
    });
    const result = analyzeFeature(info);
    expect(result.effort).toBe('high');
  });

  it('should assess low effort for few features without integrations', () => {
    const info = makeCollectedInfo({
      keyFeatures: 'Botão de exportar',
      integrations: undefined,
    });
    const result = analyzeFeature(info);
    expect(result.effort).toBe('low');
  });

  it('should assess high risk when risks, dependencies, and constraints are all present', () => {
    const info = makeCollectedInfo({
      risks: 'Pode impactar performance',
      dependencies: 'Depende do time de infra',
      constraints: 'Regulação LGPD',
    });
    const result = analyzeFeature(info);
    expect(result.risk).toBe('high');
  });

  it('should assess low risk when no risk fields are present', () => {
    const info = makeCollectedInfo({
      risks: undefined,
      dependencies: undefined,
      constraints: undefined,
    });
    const result = analyzeFeature(info);
    expect(result.risk).toBe('low');
  });

  it('should calculate priority 1 for high impact, low effort, low risk', () => {
    const info = makeCollectedInfo({
      targetAudience: 'Todos os colaboradores da empresa',
      customerBenefit: 'Ganho enorme de produtividade para toda a organização. Redução de custos operacionais.',
      keyFeatures: 'Um botão',
      integrations: undefined,
      risks: undefined,
      dependencies: undefined,
      constraints: undefined,
    });
    const result = analyzeFeature(info);
    expect(result.priority).toBe(1);
  });

  it('should calculate priority 5 for low impact, high effort, high risk', () => {
    const info = makeCollectedInfo({
      targetAudience: 'Apenas um usuário específico',
      customerBenefit: 'Pouco',
      keyFeatures: 'A, B, C, D, E, F, G, H',
      integrations: 'Sistema legado complexo',
      risks: 'Alto risco técnico',
      dependencies: 'Depende de 3 times',
      constraints: 'Regulação complexa',
    });
    const result = analyzeFeature(info);
    expect(result.priority).toBe(5);
  });
});

describe('formatAnalysisForEpic', () => {
  const analysis: FeatureAnalysis = {
    theme: 'Automação',
    strategicAlignment: 'Alinhado com OKR Q1',
    impact: 'high',
    effort: 'medium',
    risk: 'low',
    priority: 2,
  };

  it('should return valid HTML with table structure', () => {
    const result = formatAnalysisForEpic(analysis);
    expect(result).toContain('<h3>');
    expect(result).toContain('</h3>');
    expect(result).toContain('<table>');
    expect(result).toContain('</table>');
    expect(result).toContain('<tr>');
    expect(result).toContain('</tr>');
  });

  it('should include all analysis fields', () => {
    const result = formatAnalysisForEpic(analysis);
    expect(result).toContain('Automação');
    expect(result).toContain('Alinhado com OKR Q1');
    expect(result).toContain('high');
    expect(result).toContain('medium');
    expect(result).toContain('low');
    expect(result).toContain('2 - Alta');
  });

  it('should escape HTML in analysis values', () => {
    const xssAnalysis: FeatureAnalysis = {
      theme: '<script>alert("xss")</script>',
      strategicAlignment: 'Test & "quotes"',
      impact: 'high',
      effort: 'low',
      risk: 'medium',
      priority: 3,
    };
    const result = formatAnalysisForEpic(xssAnalysis);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&amp;');
    expect(result).toContain('&quot;');
  });
});

describe('formatAnalysisForFeature', () => {
  const analysis: FeatureAnalysis = {
    theme: 'Integração',
    strategicAlignment: 'Conectar ecossistema',
    impact: 'medium',
    effort: 'high',
    risk: 'medium',
    priority: 4,
  };

  it('should return valid HTML with list structure', () => {
    const result = formatAnalysisForFeature(analysis);
    expect(result).toContain('<h3>');
    expect(result).toContain('</h3>');
    expect(result).toContain('<ul>');
    expect(result).toContain('</ul>');
    expect(result).toContain('<li>');
    expect(result).toContain('</li>');
  });

  it('should include relevant analysis fields', () => {
    const result = formatAnalysisForFeature(analysis);
    expect(result).toContain('Integração');
    expect(result).toContain('medium');
    expect(result).toContain('high');
    expect(result).toContain('4 - Baixa');
  });

  it('should escape HTML in analysis values', () => {
    const xssAnalysis: FeatureAnalysis = {
      theme: 'Test <b>bold</b>',
      strategicAlignment: 'N/A',
      impact: 'low',
      effort: 'low',
      risk: 'low',
      priority: 1,
    };
    const result = formatAnalysisForFeature(xssAnalysis);
    expect(result).not.toContain('<b>');
    expect(result).toContain('&lt;b&gt;');
  });
});
