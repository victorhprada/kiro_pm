# Implementation Plan: Azure DevOps Work Items Creator

## Overview

Implementação de uma aplicação CLI interativa em TypeScript (Node.js) que automatiza a criação de work items no Azure DevOps seguindo hierarquia padronizada (Epic → Feature → N User Stories). Integra um módulo PM Skill rule-based baseado em frameworks PM open-source (PRD 8-Section, 3 C's + INVEST, Feature Request Analysis, Job Stories) sem dependência de LLM.

## Tasks

- [x] 1. Set up project structure, core interfaces and configuration
  - [x] 1.1 Initialize TypeScript project with dependencies
    - Create `package.json` with dependencies: `azure-devops-node-api`, `inquirer`, `dotenv`, `fast-check` (dev)
    - Create `tsconfig.json` with strict mode enabled
    - Create directory structure: `src/`, `src/domain/`, `src/application/`, `src/infrastructure/`, `src/presentation/`, `tests/unit/`, `tests/property/`, `tests/integration/`
    - _Requirements: 1.1, 1.4_

  - [x] 1.2 Define core domain interfaces and data models
    - Create `src/domain/models.ts` with interfaces: `WorkItemHierarchy`, `EpicData`, `FeatureData`, `UserStoryData`, `Project`, `Team`, `Sprint`, `ConnectionContext`, `TargetContext`, `CreationResult`, `CreationError`, `ApprovalResult`
    - Create `src/domain/types.ts` with types: `PRDSection`, `RefinementSession`, `Question`, `QuestionFlow`, `QuestionTemplate`, `CollectedInfo`, `INVESTValidation`, `JsonPatchOperation`
    - _Requirements: 4.1, 4.2, 4.3, 7.1, 7.2, 7.3_

  - [x] 1.3 Create custom error classes
    - Create `src/domain/errors.ts` with: `AzureDevOpsAuthError`, `WorkItemCreationError`, `RefinementError`, `ValidationError`
    - Each error class extends `Error` with appropriate additional properties as defined in design
    - _Requirements: 1.2, 1.3, 6.7_

  - [x] 1.4 Create ConfigManager for environment configuration
    - Create `src/infrastructure/config-manager.ts` implementing `ConfigManager` interface
    - Load PAT and organization URL from `.env` file using `dotenv`
    - Validate that PAT and organization URL are present and non-empty
    - Ensure PAT is never logged or exposed in any output
    - _Requirements: 1.1, 1.4_

- [x] 2. Implement Azure DevOps Client (Infrastructure Layer)
  - [x] 2.1 Implement AzureDevOpsClient with connection validation
    - Create `src/infrastructure/azure-devops-client.ts` implementing `AzureDevOpsClient` interface
    - Implement `validateConnection()` using `azure-devops-node-api` SDK
    - Implement `listProjects()`, `listTeams()`, `listSprints()` methods
    - Handle authentication errors (401) with descriptive messages
    - Handle organization not found (404) with appropriate error
    - Implement retry with exponential backoff (3 attempts) for network failures
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Implement work item creation with hierarchy linking
    - Implement `createWorkItem()` method using JSON Patch format
    - Build payload with required fields per work item type (Title, Description, AreaPath, IterationPath, AcceptanceCriteria for User Stories)
    - Add parent link relation (`System.LinkTypes.Hierarchy-Reverse`) when parentId is provided
    - Handle partial failure: preserve successfully created items and report specific failure
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 2.3 Write property tests for AzureDevOpsClient payloads
    - **Property 6: Parent Link Correctness** — For any Feature/User Story creation, payload includes correct parent link
    - **Property 7: Work Item Path Assignment** — For any work item in a TargetContext, payload includes correct iteration and area paths
    - **Property 10: Required Fields Completeness** — For any work item payload, all required fields for its type are present
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3**

- [x] 3. Implement PM Skill Module — Question Templates (Domain Layer)
  - [x] 3.1 Implement QuestionTemplates with PRD 8-Section structure
    - Create `src/domain/question-templates.ts` with the `QUESTION_FLOWS` array
    - Implement all 8 question flows: background, objective, market_segments, value_propositions, solution, release, user_scenarios, acceptance_criteria
    - Each flow has section, sectionTitle, purpose, mapsTo, questions array, and minAnswersRequired
    - Include follow-up conditions for required questions with insufficient answers
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Implement PMSkill refinement session logic
    - Create `src/application/pm-skill.ts` implementing `PMSkill` interface
    - Implement `startRefinement()`: create session with status 'in_progress', set first question from flows
    - Implement `getNextQuestion()`: navigate through question flows by section and question index
    - Implement `processAnswer()`: store answer, check follow-up conditions, advance to next question
    - Implement `isSessionComplete()`: check all required questions answered with minimum thresholds met
    - Implement follow-up logic: if answer is empty/whitespace for required question, generate follow-up before advancing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 3.3 Write property tests for PMSkill session management
    - **Property 2: Session Initialization from Any Input** — For any non-empty string, session is created with 'in_progress' status and first question available
    - **Property 4: Insufficient Answer Triggers Follow-up** — For any required question with empty/whitespace answer, follow-up is produced
    - **Validates: Requirements 3.1, 3.7**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Hierarchy Template Engine (Domain Layer)
  - [x] 5.1 Implement HierarchyTemplateEngine with 3 C's + INVEST
    - Create `src/domain/hierarchy-template-engine.ts` implementing `HierarchyTemplateEngine` interface
    - Implement `buildEpic()`: generate Epic from Background + Objective + Market Segments sections
    - Implement `buildFeature()`: generate Feature from Value Propositions + Solution sections
    - Implement `buildUserStories()`: generate User Stories using 3 C's format (Card = title, Conversation = description, Confirmation = acceptance criteria)
    - Implement `validateINVEST()`: validate each User Story against INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable)
    - Implement `applyFeedback()`: adjust hierarchy based on user feedback
    - _Requirements: 4.1, 4.2, 4.3, 5.3, 5.4_

  - [x] 5.2 Implement INVEST validation logic
    - Create `src/domain/invest-validation.ts` with validation functions for each INVEST criterion
    - Independent: story has no explicit dependency on other stories
    - Negotiable: description is not overly prescriptive
    - Valuable: has clear benefit statement
    - Estimable: scope is bounded
    - Small: fits within sprint (heuristic: acceptance criteria ≤ 6)
    - Testable: has concrete acceptance criteria
    - Return warnings for criteria not met
    - _Requirements: 4.3_

  - [x] 5.3 Implement HierarchyBuilder with validation
    - Create `src/domain/hierarchy-builder.ts` implementing `HierarchyBuilder` interface
    - Implement `build()`: assemble WorkItemHierarchy from Epic, Feature, and User Stories
    - Implement `validate()`: ensure hierarchy has exactly 1 Epic, 1 Feature, ≥1 User Story with non-empty fields
    - Implement `addUserStory()`: add new User Story preserving existing hierarchy
    - _Requirements: 4.1, 4.2, 4.3, 5.5_

  - [x] 5.4 Write property tests for hierarchy generation
    - **Property 3: Hierarchy Structural Invariant** — For any valid answers, hierarchy has exactly 1 Epic, 1 Feature, ≥1 User Story with non-empty fields
    - **Property 5: Adding User Stories Preserves Existing Hierarchy** — Adding a User Story preserves all existing items and increases count by 1
    - **Validates: Requirements 3.6, 4.1, 4.2, 4.3, 5.5**

- [x] 6. Implement HTML Formatting and Work Item Generator
  - [x] 6.1 Implement HTML formatter for work item content
    - Create `src/domain/html-formatter.ts` with functions to format descriptions and acceptance criteria as valid HTML
    - Support paragraphs, lists (ordered/unordered), bold, italic
    - Escape special HTML characters in user input
    - Ensure all tags are properly opened and closed
    - _Requirements: 7.4, 7.5_

  - [x] 6.2 Implement WorkItemGenerator
    - Create `src/application/work-item-generator.ts` implementing `WorkItemGenerator` interface
    - Implement `generateHierarchy()`: use HierarchyTemplateEngine to build hierarchy from session data
    - Implement `formatDescription()`: use HTML formatter for descriptions
    - Implement `formatAcceptanceCriteria()`: format criteria as HTML list
    - Wire PMSkill `generateHierarchy()` to use WorkItemGenerator internally
    - _Requirements: 4.1, 4.2, 4.3, 7.4, 7.5_

  - [x] 6.3 Write property tests for HTML formatting and result completeness
    - **Property 11: HTML Formatting Validity** — For any input string, output contains valid HTML with properly opened/closed tags and preserves semantic content
    - **Property 8: Creation Result Completeness** — For any set of created work items, result contains valid ID (>0) and non-empty URL for each
    - **Property 9: Partial Failure Resilience** — For any failure at item N, items 0..N-1 are preserved with IDs and URLs
    - **Validates: Requirements 6.6, 6.7, 7.4, 7.5**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement PAT Security and Feature Analysis
  - [x] 8.1 Implement PAT security sanitization
    - Create `src/domain/security.ts` with functions to sanitize outputs ensuring PAT never appears
    - Implement log sanitizer that redacts PAT from any string
    - Apply sanitization in error messages, log outputs, and user-facing responses
    - _Requirements: 1.4_

  - [x] 8.2 Implement Feature Analysis module
    - Create `src/domain/feature-analysis.ts` implementing prioritization and structuring logic from analyze-feature-requests framework
    - Structure Epic/Feature with theme, strategic alignment, impact, effort, risk metadata
    - Used by HierarchyTemplateEngine when building Epic descriptions
    - _Requirements: 3.2, 3.3, 4.1, 4.2_

  - [x] 8.3 Write property test for PAT security
    - **Property 1: PAT Security — Token Never Exposed** — For any PAT string and any operation, PAT never appears in log output, error messages, or user-facing responses
    - **Validates: Requirements 1.4**

- [x] 9. Implement CLI Presentation Layer and Orchestrator
  - [x] 9.1 Implement CLI interface with inquirer
    - Create `src/presentation/cli.ts` using `inquirer` for interactive prompts
    - Implement PAT/URL input prompt (PAT masked)
    - Implement project/team/sprint selection menus
    - Implement free-text input for user need
    - Implement refinement Q&A flow display
    - Implement hierarchy review display with approval/rejection prompts
    - Implement feedback input for rejected hierarchies
    - Implement creation result display (IDs and URLs)
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 3.1, 4.4, 5.1, 5.2, 5.3, 6.6_

  - [x] 9.2 Implement Orchestrator to wire all components
    - Create `src/application/orchestrator.ts` implementing `Orchestrator` interface
    - Implement `run()`: main flow coordinating all steps
    - Implement `setupConnection()`: config → validate → list projects
    - Implement `selectTarget()`: project → team → sprint selection
    - Implement `conductRefinement()`: start session → Q&A loop → generate hierarchy
    - Implement `reviewAndApprove()`: display hierarchy → approval loop with feedback
    - Implement `createWorkItems()`: create Epic → Feature → User Stories with links
    - Handle the approval-rejection-feedback cycle (loop until approved)
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 3.1, 3.6, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 9.3 Create application entry point
    - Create `src/index.ts` as main entry point
    - Instantiate all dependencies and wire them together
    - Call `orchestrator.run()` with proper error handling at top level
    - Add `bin` entry in `package.json` for CLI execution
    - _Requirements: 1.1_

- [x] 10. Implement unit tests for core modules
  - [x] 10.1 Write unit tests for ConfigManager and AzureDevOpsClient
    - Test valid PAT + URL validation
    - Test invalid/expired PAT error handling
    - Test invalid organization URL error handling
    - Test project/team/sprint listing with mocks
    - Test retry logic for network failures
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_

  - [x] 10.2 Write unit tests for PMSkill and QuestionTemplates
    - Test session start with various inputs
    - Test question flow navigation through all PRD sections
    - Test follow-up generation for insufficient answers
    - Test session completion detection
    - Test all 8 PRD sections are present in question flows
    - Test mapsTo mapping correctness (background→epic, solution→feature, etc.)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 10.3 Write unit tests for HierarchyTemplateEngine and INVEST validation
    - Test Epic generation from Background + Objective + Market Segments
    - Test Feature generation from Value Propositions + Solution
    - Test User Story generation in 3 C's format
    - Test INVEST validation for valid and invalid stories
    - Test feedback application and hierarchy adjustment
    - Test Feature Analysis structuring (theme, alignment, impact)
    - _Requirements: 4.1, 4.2, 4.3, 5.3, 5.4_

  - [x] 10.4 Write unit tests for HTML formatter and WorkItemGenerator
    - Test HTML formatting for paragraphs, lists, special characters
    - Test acceptance criteria formatting as HTML list
    - Test work item generation end-to-end from session data
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (11 properties total)
- Unit tests validate specific examples and edge cases
- The PM Skill module is entirely rule-based — no LLM dependency; frameworks from `.kiro/skills/` define structure and formats
- All frameworks (PRD Template, 3 C's + INVEST, Feature Request Analysis, Job Stories) are implemented as predefined question flows and generation templates

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "3.1"] },
    { "id": 3, "tasks": ["2.2", "3.2"] },
    { "id": 4, "tasks": ["2.3", "3.3", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 6, "tasks": ["5.4", "6.2", "8.1", "8.2"] },
    { "id": 7, "tasks": ["6.3", "8.3"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2"] },
    { "id": 10, "tasks": ["9.3"] },
    { "id": 11, "tasks": ["10.1", "10.2", "10.3", "10.4"] }
  ]
}
```
