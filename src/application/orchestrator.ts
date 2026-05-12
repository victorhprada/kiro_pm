/**
 * Orchestrator — Coordinates the full application flow.
 *
 * Wires together: CLI (presentation), PMSkill (application),
 * AzureDevOpsClient (infrastructure), ConfigManager (infrastructure),
 * and security sanitizer (domain).
 *
 * Flow: setupConnection → selectTarget → promptUserNeed →
 *       conductRefinement → reviewAndApprove loop → createWorkItems → displayResult
 *
 * Validates: Requirements 1.1, 2.1, 2.2, 2.3, 3.1, 3.6, 4.4,
 *            5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import { CLI } from '../presentation/cli';
import { PMSkillImpl } from './pm-skill';
import {
  AzureDevOpsClient,
  IAzureDevOpsClient,
} from '../infrastructure/azure-devops-client';
import { ConfigManager } from '../infrastructure/config-manager';
import { createSanitizer } from '../domain/security';
import {
  ConnectionContext,
  TargetContext,
  WorkItemHierarchy,
  ApprovalResult,
  CreationResult,
  CreationError,
  WorkItemResult,
} from '../domain/models';
import { Question } from '../domain/types';

export class Orchestrator {
  private cli: CLI;
  private pmSkill: PMSkillImpl;
  private configManager: ConfigManager;
  private adoClient: IAzureDevOpsClient | null = null;
  private sanitize: (text: string) => string = (t) => t;

  constructor(
    cli?: CLI,
    pmSkill?: PMSkillImpl,
    configManager?: ConfigManager,
    adoClient?: IAzureDevOpsClient
  ) {
    this.cli = cli ?? new CLI();
    this.pmSkill = pmSkill ?? new PMSkillImpl();
    this.configManager = configManager ?? new ConfigManager();
    if (adoClient) {
      this.adoClient = adoClient;
    }
  }

  /**
   * Main flow coordinating all steps.
   * setupConnection → selectTarget → promptUserNeed →
   * conductRefinement → reviewAndApprove loop → createWorkItems → displayResult
   */
  async run(): Promise<void> {
    try {
      // 1. Setup connection
      const connectionContext = await this.setupConnection();

      // 2. Select target (project, team, sprint)
      const targetContext = await this.selectTarget(connectionContext);

      // 3. Prompt user need
      const userNeed = await this.cli.promptUserNeed();

      // 4. Conduct refinement
      let hierarchy = await this.conductRefinement(userNeed);

      // 5. Review and approve loop
      let approvalResult = await this.reviewAndApprove(hierarchy);

      while (!approvalResult.approved) {
        if (approvalResult.addMoreStories) {
          // Prompt for new story details and add to hierarchy
          const storyDetails = await this.cli.promptUserNeed();
          const session = this.pmSkill.startRefinement(storyDetails);
          const newHierarchy = this.pmSkill.generateHierarchy(session);
          // Add new stories to existing hierarchy
          for (const story of newHierarchy.userStories) {
            hierarchy = {
              ...hierarchy,
              userStories: [...hierarchy.userStories, story],
            };
          }
        } else {
          // Get feedback and adjust hierarchy
          const feedback = await this.cli.promptFeedback();
          hierarchy = this.pmSkill.adjustHierarchy(hierarchy, feedback);
        }

        approvalResult = await this.reviewAndApprove(hierarchy);
      }

      // 6. Create work items
      const result = await this.createWorkItems(hierarchy, targetContext);

      // 7. Display result
      this.cli.displayCreationResult(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.cli.displayError(this.sanitize(message));
    }
  }

  /**
   * Sets up the connection to Azure DevOps.
   * Tries loading from .env first (ConfigManager), if fails prompts credentials via CLI.
   * Then validates connection and lists projects.
   *
   * Validates: Requirements 1.1
   */
  async setupConnection(): Promise<ConnectionContext> {
    let organizationUrl: string;
    let pat: string;

    try {
      // Try loading from .env first
      const config = await this.configManager.loadConfig();
      organizationUrl = config.organizationUrl;
      pat = config.pat;
    } catch {
      // If .env fails, prompt credentials via CLI
      const credentials = await this.cli.promptCredentials();
      organizationUrl = credentials.organizationUrl;
      pat = credentials.pat;
    }

    // Set up PAT sanitizer for all error messages
    this.sanitize = createSanitizer(pat);

    // Create Azure DevOps client if not injected
    if (!this.adoClient) {
      this.adoClient = new AzureDevOpsClient(organizationUrl, pat);
    }

    try {
      // Validate connection
      await this.adoClient.validateConnection();
      this.cli.displaySuccess('Conexão com Azure DevOps validada com sucesso.');

      // List projects
      const projects = await this.adoClient.listProjects();

      return {
        organizationUrl,
        isConnected: true,
        projects,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      throw new Error(this.sanitize(message));
    }
  }

  /**
   * Selects target project, team, and sprint via CLI.
   * Builds TargetContext with areaPath and iterationPath.
   *
   * Validates: Requirements 2.1, 2.2, 2.3
   */
  async selectTarget(context: ConnectionContext): Promise<TargetContext> {
    // Select project
    const project = await this.cli.selectProject(context.projects);

    // List and select team
    const teams = await this.adoClient!.listTeams(project.id);
    const team = await this.cli.selectTeam(teams);

    // List and select sprint
    const sprints = await this.adoClient!.listSprints(project.id, team.id);
    const sprint = await this.cli.selectSprint(sprints);

    // Build area path and iteration path
    const areaPath = `${project.name}\\${team.name}`;
    const iterationPath = sprint.path;

    return {
      project,
      team,
      sprint,
      areaPath,
      iterationPath,
    };
  }

  /**
   * Conducts the refinement session: starts session, loops Q&A, generates hierarchy.
   *
   * Validates: Requirements 3.1, 3.6
   */
  async conductRefinement(userNeed: string): Promise<WorkItemHierarchy> {
    // Start refinement session
    let session = this.pmSkill.startRefinement(userNeed);

    // Q&A loop
    let question: Question | null = this.pmSkill.getNextQuestion(session);

    while (question !== null) {
      // Display question
      this.cli.displayQuestion(question);

      // Prompt answer
      const answer = await this.cli.promptAnswer();

      // Process answer (may trigger follow-up)
      session = this.pmSkill.processAnswer(session, answer);

      // Get next question
      question = this.pmSkill.getNextQuestion(session);
    }

    // Generate hierarchy from completed session
    return this.pmSkill.generateHierarchy(session);
  }

  /**
   * Displays hierarchy and prompts for approval.
   * Returns the approval result (approved, rejected, or add more stories).
   *
   * Validates: Requirements 4.4, 5.1, 5.2, 5.3
   */
  async reviewAndApprove(hierarchy: WorkItemHierarchy): Promise<ApprovalResult> {
    // Display the hierarchy for review
    this.cli.displayHierarchy(hierarchy);

    // Prompt for approval
    return this.cli.promptApproval();
  }

  /**
   * Creates work items in Azure DevOps: Epic → Feature → User Stories.
   * Each item links to its parent. Handles partial failures.
   *
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
   */
  async createWorkItems(
    hierarchy: WorkItemHierarchy,
    target: TargetContext
  ): Promise<CreationResult> {
    const workItems: WorkItemResult[] = [];
    const errors: CreationError[] = [];

    // 1. Create Epic
    let epicResult: WorkItemResult;
    try {
      epicResult = await this.adoClient!.createWorkItem({
        projectName: target.project.name,
        workItemType: 'Epic',
        title: hierarchy.epic.title,
        description: hierarchy.epic.description,
        areaPath: target.areaPath,
        iterationPath: target.iterationPath,
        createdItems: [],
      });
      workItems.push(epicResult);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      errors.push({
        workItemType: 'Epic',
        title: hierarchy.epic.title,
        error: this.sanitize(message),
      });
      return { success: false, workItems, errors };
    }

    // 2. Create Feature (with Epic as parent)
    let featureResult: WorkItemResult;
    try {
      featureResult = await this.adoClient!.createWorkItem({
        projectName: target.project.name,
        workItemType: 'Feature',
        title: hierarchy.feature.title,
        description: hierarchy.feature.description,
        areaPath: target.areaPath,
        iterationPath: target.iterationPath,
        parentId: epicResult.id,
        createdItems: workItems,
      });
      workItems.push(featureResult);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      errors.push({
        workItemType: 'Feature',
        title: hierarchy.feature.title,
        error: this.sanitize(message),
      });
      return { success: false, workItems, errors };
    }

    // 3. Create User Stories (with Feature as parent)
    for (const story of hierarchy.userStories) {
      try {
        const storyResult = await this.adoClient!.createWorkItem({
          projectName: target.project.name,
          workItemType: 'User Story',
          title: story.title,
          description: story.description,
          areaPath: target.areaPath,
          iterationPath: target.iterationPath,
          acceptanceCriteria: story.acceptanceCriteria,
          parentId: featureResult.id,
          createdItems: workItems,
        });
        workItems.push(storyResult);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        errors.push({
          workItemType: 'User Story',
          title: story.title,
          error: this.sanitize(message),
        });
        // Continue creating remaining stories (partial failure resilience)
      }
    }

    const success = errors.length === 0;
    return { success, workItems, errors };
  }
}
