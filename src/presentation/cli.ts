/**
 * CLI Interface for Azure DevOps Work Items Creator
 *
 * Uses inquirer for interactive prompts and selections.
 * Handles all user-facing interactions: credentials, selections,
 * refinement Q&A, hierarchy review, and creation results.
 */

import type {
  Project,
  Team,
  Sprint,
  WorkItemHierarchy,
  ApprovalResult,
  CreationResult,
} from '../domain/models';
import type { Question } from '../domain/types';

// Dynamic import helper for ESM-only inquirer in CommonJS project
async function getInquirer() {
  const inquirer = await import('inquirer');
  return inquirer.default;
}

export class CLI {
  /**
   * Prompts the user for Azure DevOps credentials.
   * PAT input is masked for security.
   *
   * Validates: Requirements 1.1
   */
  async promptCredentials(): Promise<{ organizationUrl: string; pat: string }> {
    const inquirer = await getInquirer();
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'organizationUrl',
        message: 'URL da organização Azure DevOps (ex: https://dev.azure.com/org):',
        validate: (input: string) => {
          if (!input.trim()) return 'A URL da organização é obrigatória.';
          if (!input.startsWith('https://')) return 'A URL deve começar com https://';
          return true;
        },
      },
      {
        type: 'password',
        name: 'pat',
        message: 'Personal Access Token (PAT):',
        mask: '*',
        validate: (input: string) => {
          if (!input.trim()) return 'O PAT é obrigatório.';
          return true;
        },
      },
    ]);

    return {
      organizationUrl: answers.organizationUrl.trim(),
      pat: answers.pat.trim(),
    };
  }

  /**
   * Displays a list of projects for the user to select from.
   *
   * Validates: Requirements 2.1
   */
  async selectProject(projects: Project[]): Promise<Project> {
    if (projects.length === 0) {
      throw new Error('Nenhum projeto disponível na organização.');
    }

    const inquirer = await getInquirer();
    const { projectId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'projectId',
        message: 'Selecione o projeto:',
        choices: projects.map((p) => ({
          name: p.description ? `${p.name} — ${p.description}` : p.name,
          value: p.id,
        })),
      },
    ]);

    return projects.find((p) => p.id === projectId)!;
  }

  /**
   * Displays a list of teams for the user to select from.
   * Handles the case where no teams are available.
   *
   * Validates: Requirements 2.2
   */
  async selectTeam(teams: Team[]): Promise<Team> {
    if (teams.length === 0) {
      throw new Error('Não há times disponíveis no projeto selecionado.');
    }

    const inquirer = await getInquirer();
    const { teamId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'teamId',
        message: 'Selecione o time:',
        choices: teams.map((t) => ({
          name: t.name,
          value: t.id,
        })),
      },
    ]);

    return teams.find((t) => t.id === teamId)!;
  }

  /**
   * Displays a list of sprints with status indicators for the user to select from.
   * Handles the case where no sprints are available.
   *
   * Validates: Requirements 2.3
   */
  async selectSprint(sprints: Sprint[]): Promise<Sprint> {
    if (sprints.length === 0) {
      throw new Error('Não há sprints disponíveis para o time selecionado.');
    }

    const statusIndicator = (status: Sprint['status']): string => {
      switch (status) {
        case 'current':
          return '● ';
        case 'future':
          return '○ ';
        case 'past':
          return '◌ ';
      }
    };

    const inquirer = await getInquirer();
    const { sprintId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'sprintId',
        message: 'Selecione a sprint:',
        choices: sprints.map((s) => {
          const indicator = statusIndicator(s.status);
          const dates =
            s.startDate && s.endDate
              ? ` (${formatDate(s.startDate)} - ${formatDate(s.endDate)})`
              : '';
          return {
            name: `${indicator}${s.name}${dates}`,
            value: s.id,
          };
        }),
      },
    ]);

    return sprints.find((s) => s.id === sprintId)!;
  }

  /**
   * Prompts the user for their need in free text.
   *
   * Validates: Requirements 3.1
   */
  async promptUserNeed(): Promise<string> {
    const inquirer = await getInquirer();
    const { userNeed } = await inquirer.prompt([
      {
        type: 'input',
        name: 'userNeed',
        message: 'Descreva sua necessidade:',
        validate: (input: string) => {
          if (!input.trim()) return 'A descrição da necessidade é obrigatória.';
          return true;
        },
      },
    ]);

    return userNeed.trim();
  }

  /**
   * Displays a refinement question to the user.
   *
   * Validates: Requirements 3.1
   */
  displayQuestion(question: Question): void {
    console.log('');
    console.log(`[${question.section.toUpperCase()}] ${question.text}`);
    if (!question.required) {
      console.log('  (opcional — pressione Enter para pular)');
    }
  }

  /**
   * Prompts the user for an answer to the current refinement question.
   */
  async promptAnswer(): Promise<string> {
    const inquirer = await getInquirer();
    const { answer } = await inquirer.prompt([
      {
        type: 'input',
        name: 'answer',
        message: '>',
      },
    ]);

    return answer.trim();
  }

  /**
   * Displays the generated work item hierarchy for user review.
   * Shows Epic, Feature, and User Stories in a formatted tree.
   *
   * Validates: Requirements 4.4, 5.1
   */
  displayHierarchy(hierarchy: WorkItemHierarchy): void {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  HIERARQUIA DE WORK ITEMS GERADA');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // Epic
    console.log(`  📋 EPIC: ${hierarchy.epic.title}`);
    console.log(`     ${stripHtml(hierarchy.epic.description).substring(0, 120)}`);
    console.log('');

    // Feature
    console.log(`  ├─ 🎯 FEATURE: ${hierarchy.feature.title}`);
    console.log(`  │  ${stripHtml(hierarchy.feature.description).substring(0, 120)}`);
    console.log('');

    // User Stories
    hierarchy.userStories.forEach((story, index) => {
      const isLast = index === hierarchy.userStories.length - 1;
      const prefix = isLast ? '└─' : '├─';
      const continuation = isLast ? '   ' : '│  ';

      console.log(`  │  ${prefix} 📝 US${index + 1}: ${story.title}`);
      console.log(`  │  ${continuation} ${stripHtml(story.description).substring(0, 100)}`);

      if (story.acceptanceCriteria) {
        const criteria = stripHtml(story.acceptanceCriteria).substring(0, 80);
        console.log(`  │  ${continuation} AC: ${criteria}`);
      }
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  }

  /**
   * Prompts the user to approve, reject, or request more stories.
   *
   * Validates: Requirements 5.1, 5.2, 5.3
   */
  async promptApproval(): Promise<ApprovalResult> {
    const inquirer = await getInquirer();
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'O que deseja fazer?',
        choices: [
          { name: '✅ Aprovar e criar work items', value: 'approve' },
          { name: '✏️  Solicitar correções', value: 'reject' },
          { name: '➕ Adicionar mais User Stories', value: 'add_more' },
        ],
      },
    ]);

    switch (action) {
      case 'approve':
        return { approved: true };
      case 'reject':
        return { approved: false };
      case 'add_more':
        return { approved: false, addMoreStories: true };
      default:
        return { approved: false };
    }
  }

  /**
   * Prompts the user for feedback/corrections on the rejected hierarchy.
   *
   * Validates: Requirements 5.3
   */
  async promptFeedback(): Promise<string> {
    const inquirer = await getInquirer();
    const { feedback } = await inquirer.prompt([
      {
        type: 'input',
        name: 'feedback',
        message: 'Descreva as correções necessárias:',
        validate: (input: string) => {
          if (!input.trim()) return 'O feedback é obrigatório para ajustar as demandas.';
          return true;
        },
      },
    ]);

    return feedback.trim();
  }

  /**
   * Displays the creation result with IDs and URLs of created work items.
   *
   * Validates: Requirements 6.6
   */
  displayCreationResult(result: CreationResult): void {
    console.log('');

    if (result.success) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('  ✅ WORK ITEMS CRIADOS COM SUCESSO');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');

      result.workItems.forEach((item) => {
        console.log(`  ${getTypeIcon(item.type)} [${item.type}] ${item.title}`);
        console.log(`     ID: ${item.id}`);
        console.log(`     URL: ${item.url}`);
        console.log('');
      });
    } else {
      console.log('═══════════════════════════════════════════════════════');
      console.log('  ⚠️  CRIAÇÃO PARCIAL — ERROS ENCONTRADOS');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');

      if (result.workItems.length > 0) {
        console.log('  Itens criados com sucesso:');
        result.workItems.forEach((item) => {
          console.log(`    ${getTypeIcon(item.type)} [${item.type}] ${item.title} (ID: ${item.id})`);
          console.log(`       URL: ${item.url}`);
        });
        console.log('');
      }

      if (result.errors.length > 0) {
        console.log('  Erros:');
        result.errors.forEach((err) => {
          console.log(`    ❌ [${err.workItemType}] ${err.title}`);
          console.log(`       Motivo: ${err.error}`);
        });
        console.log('');
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  }

  /**
   * Displays an error message to the user.
   */
  displayError(message: string): void {
    console.log('');
    console.log(`  ❌ Erro: ${message}`);
    console.log('');
  }

  /**
   * Displays a success message to the user.
   */
  displaySuccess(message: string): void {
    console.log('');
    console.log(`  ✅ ${message}`);
    console.log('');
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTypeIcon(type: string): string {
  switch (type.toLowerCase()) {
    case 'epic':
      return '📋';
    case 'feature':
      return '🎯';
    case 'user story':
      return '📝';
    default:
      return '📄';
  }
}
