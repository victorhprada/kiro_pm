/**
 * Question Templates following the PRD 8-Section Structure.
 *
 * Each flow maps to a PRD section and collects information that feeds
 * into specific work item types (Epic, Feature, User Stories, or metadata).
 *
 * Based on the create-prd skill (.kiro/skills/create-prd/SKILL.md),
 * job-stories skill, and user-stories skill frameworks.
 */

import { QuestionFlow } from './types';

/**
 * Checks if an answer is empty or whitespace-only.
 * Used as the default followUpCondition for required questions.
 */
const isInsufficientAnswer = (answer: string): boolean => {
  return answer.trim().length === 0;
};

/**
 * All 8 question flows following the PRD Template structure.
 *
 * Mapping:
 * - Background + Objective + Market Segments → Epic
 * - Value Propositions + Solution → Feature
 * - User Scenarios + Acceptance Criteria → User Stories
 * - Release → Metadata
 */
export const QUESTION_FLOWS: QuestionFlow[] = [
  {
    section: 'background',
    sectionTitle: '3. Background (PRD)',
    purpose: 'Coletar contexto e motivação — alimenta o Epic',
    mapsTo: 'epic',
    questions: [
      {
        id: 'bg_1',
        text: 'Sobre o que é esta iniciativa? Qual é o contexto?',
        required: true,
        followUpCondition: isInsufficientAnswer,
        followUpText: 'Preciso entender o contexto da iniciativa para prosseguir. Pode descrever brevemente sobre o que se trata?',
      },
      {
        id: 'bg_2',
        text: 'Por que agora? Algo mudou recentemente que motiva esta demanda?',
        required: true,
        followUpCondition: isInsufficientAnswer,
        followUpText: 'Entender o timing é importante. O que motivou essa demanda neste momento?',
      },
      {
        id: 'bg_3',
        text: 'Isso é algo que só recentemente se tornou possível? (nova tecnologia, regulação, etc.)',
        required: false,
      },
    ],
    minAnswersRequired: 2,
  },
  {
    section: 'objective',
    sectionTitle: '4. Objective (PRD)',
    purpose: 'Definir objetivo e métricas de sucesso — alimenta o Epic',
    mapsTo: 'epic',
    questions: [
      {
        id: 'obj_1',
        text: 'Qual é o objetivo principal? Por que isso importa para o negócio?',
        required: true,
        followUpCondition: isInsufficientAnswer,
        followUpText: 'O objetivo principal é essencial para definir o Epic. Pode descrever o que se pretende alcançar?',
      },
      {
        id: 'obj_2',
        text: 'Como isso beneficia a empresa e os clientes?',
        required: true,
        followUpCondition: isInsufficientAnswer,
        followUpText: 'Preciso entender os benefícios para empresa e clientes. Pode elaborar?',
      },
      {
        id: 'obj_3',
        text: 'Como você vai medir o sucesso? (métricas, KPIs, OKRs)',
        required: false,
      },
      {
        id: 'obj_4',
        text: 'Como isso se alinha com a visão e estratégia do produto?',
        required: false,
      },
    ],
    minAnswersRequired: 2,
  },
  {
    section: 'market_segments',
    sectionTitle: '5. Market Segments (PRD)',
    purpose: 'Identificar público-alvo e restrições — alimenta Epic/Feature',
    mapsTo: 'epic',
    questions: [
      {
        id: 'mkt_1',
        text: 'Para quem estamos construindo isso? Quem são os usuários/beneficiários?',
        required: true,
        followUpCondition: isInsufficientAnswer,
        followUpText: 'Identificar o público-alvo é fundamental. Quem vai usar ou se beneficiar desta solução?',
      },
      {
        id: 'mkt_2',
        text: 'Existem restrições ou limitações conhecidas? (técnicas, regulatórias, de mercado)',
        required: false,
      },
    ],
    minAnswersRequired: 1,
  },
  {
    section: 'value_propositions',
    sectionTitle: '6. Value Propositions (PRD)',
    purpose: 'Definir valor entregue — alimenta a Feature',
    mapsTo: 'feature',
    questions: [
      {
        id: 'vp_1',
        text: 'Quais necessidades ou "jobs" dos clientes estamos endereçando?',
        required: true,
        followUpCondition: isInsufficientAnswer,
        followUpText: 'Preciso entender as necessidades dos clientes que serão atendidas. Pode descrever os "jobs to be done"?',
      },
      {
        id: 'vp_2',
        text: 'O que os clientes vão ganhar com isso? Quais dores serão evitadas?',
        required: true,
        followUpCondition: isInsufficientAnswer,
        followUpText: 'Os ganhos e dores evitadas definem a proposta de valor. O que melhora para o cliente?',
      },
      {
        id: 'vp_3',
        text: 'Qual problema resolvemos melhor que as alternativas existentes?',
        required: false,
      },
    ],
    minAnswersRequired: 2,
  },
  {
    section: 'solution',
    sectionTitle: '7. Solution (PRD)',
    purpose: 'Descrever funcionalidades e premissas — alimenta a Feature',
    mapsTo: 'feature',
    questions: [
      {
        id: 'sol_1',
        text: 'Descreva as funcionalidades-chave que precisam ser implementadas.',
        required: true,
        followUpCondition: isInsufficientAnswer,
        followUpText: 'As funcionalidades-chave são essenciais para definir a Feature. Pode listar as principais?',
      },
      {
        id: 'sol_2',
        text: 'Quais são os limites do escopo? (o que NÃO faz parte)',
        required: true,
        followUpCondition: isInsufficientAnswer,
        followUpText: 'Definir o que está fora do escopo ajuda a manter o foco. O que NÃO será incluído?',
      },
      {
        id: 'sol_3',
        text: 'Existem premissas que acreditamos mas ainda não provamos?',
        required: false,
      },
      {
        id: 'sol_4',
        text: 'Existem integrações com outros sistemas necessárias?',
        required: false,
      },
    ],
    minAnswersRequired: 2,
  },
  {
    section: 'release',
    sectionTitle: '8. Release (PRD)',
    purpose: 'Definir escopo de entrega e dependências — metadata',
    mapsTo: 'metadata',
    questions: [
      {
        id: 'rel_1',
        text: 'O que entra na primeira versão vs. versões futuras?',
        required: false,
      },
      {
        id: 'rel_2',
        text: 'Existem dependências técnicas ou de outras equipes?',
        required: false,
      },
      {
        id: 'rel_3',
        text: 'Existem riscos conhecidos ou impedimentos potenciais?',
        required: false,
      },
    ],
    minAnswersRequired: 0,
  },
  {
    section: 'user_scenarios',
    sectionTitle: 'User Scenarios (Job Stories format)',
    purpose: 'Coletar cenários de uso no formato "When [situation], I want [motivation], so I can [outcome]" — alimenta User Stories',
    mapsTo: 'user_stories',
    questions: [
      {
        id: 'us_1',
        text: 'Descreva os cenários de uso principais: Quando [situação], eu quero [motivação], para que [resultado].',
        required: true,
        followUpCondition: isInsufficientAnswer,
        followUpText: 'Preciso de pelo menos um cenário de uso para gerar User Stories. Descreva: Quando [situação], eu quero [motivação], para que [resultado].',
      },
      {
        id: 'us_2',
        text: 'Existem cenários alternativos ou fluxos de exceção?',
        required: false,
      },
      {
        id: 'us_3',
        text: 'Quantas User Stories você estima que são necessárias?',
        required: false,
      },
    ],
    minAnswersRequired: 1,
  },
  {
    section: 'acceptance_criteria',
    sectionTitle: 'Acceptance Criteria (3 Cs Confirmation)',
    purpose: 'Definir critérios de aceitação testáveis — alimenta User Stories',
    mapsTo: 'user_stories',
    questions: [
      {
        id: 'ac_1',
        text: 'Quais são os critérios de aceitação para cada cenário? (comportamento observável e testável)',
        required: true,
        followUpCondition: isInsufficientAnswer,
        followUpText: 'Critérios de aceitação testáveis são necessários para as User Stories. Descreva o comportamento esperado.',
      },
      {
        id: 'ac_2',
        text: 'Existem regras de negócio específicas que devem ser validadas?',
        required: false,
      },
      {
        id: 'ac_3',
        text: 'Quais são os critérios de pronto (Definition of Done)?',
        required: false,
      },
    ],
    minAnswersRequired: 1,
  },
];
