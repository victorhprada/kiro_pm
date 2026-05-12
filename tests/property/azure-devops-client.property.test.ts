import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  buildWorkItemPayload,
  CreateWorkItemParams,
  JsonPatchOperation,
} from '../../src/infrastructure/azure-devops-client';

// ─── Arbitraries ────────────────────────────────────────────────────────────

const workItemTypeArb = fc.constantFrom('Epic', 'Feature', 'User Story') as fc.Arbitrary<
  'Epic' | 'Feature' | 'User Story'
>;

const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

const areaPathArb = fc.tuple(nonEmptyStringArb, nonEmptyStringArb).map(
  ([project, area]) => `${project}\\${area}`
);

const iterationPathArb = fc.tuple(nonEmptyStringArb, nonEmptyStringArb).map(
  ([project, sprint]) => `${project}\\${sprint}`
);

const parentIdArb = fc.integer({ min: 1, max: 1_000_000 });

const organizationUrlArb = fc.webUrl().map((url) => url.replace(/\/$/, ''));

const acceptanceCriteriaArb = nonEmptyStringArb.map(
  (s) => `<ul><li>${s}</li></ul>`
);

// ─── Helper to find a patch operation by path ───────────────────────────────

function findOp(payload: JsonPatchOperation[], fieldPath: string): JsonPatchOperation | undefined {
  return payload.find((op) => op.path === fieldPath);
}

function findRelation(payload: JsonPatchOperation[]): JsonPatchOperation | undefined {
  return payload.find((op) => op.path === '/relations/-');
}

// ─── Property 6: Parent Link Correctness ────────────────────────────────────

describe('Property 6: Parent Link Correctness', () => {
  /**
   * **Validates: Requirements 6.2, 6.3**
   *
   * For any Feature/User Story creation with a parentId, the payload MUST contain
   * a relation with rel: "System.LinkTypes.Hierarchy-Reverse" and URL containing the parentId.
   */
  it('payload includes correct parent link when parentId is provided for Feature/User Story', () => {
    const featureOrUserStoryArb = fc.constantFrom('Feature', 'User Story') as fc.Arbitrary<
      'Feature' | 'User Story'
    >;

    fc.assert(
      fc.property(
        featureOrUserStoryArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        areaPathArb,
        iterationPathArb,
        parentIdArb,
        organizationUrlArb,
        acceptanceCriteriaArb,
        (type, title, description, areaPath, iterationPath, parentId, orgUrl, acceptanceCriteria) => {
          const params: CreateWorkItemParams = {
            projectName: 'TestProject',
            workItemType: type,
            title,
            description,
            areaPath,
            iterationPath,
            parentId,
            acceptanceCriteria: type === 'User Story' ? acceptanceCriteria : undefined,
          };

          const payload = buildWorkItemPayload(params, orgUrl);
          const relation = findRelation(payload);

          // Relation MUST exist
          expect(relation).toBeDefined();
          // Relation type MUST be Hierarchy-Reverse
          expect(relation!.value.rel).toBe('System.LinkTypes.Hierarchy-Reverse');
          // URL MUST contain the parentId
          expect(relation!.value.url).toContain(`/${parentId}`);
          // URL MUST start with the organization URL
          expect(relation!.value.url).toContain(orgUrl);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('payload does NOT include parent link when parentId is not provided', () => {
    fc.assert(
      fc.property(
        workItemTypeArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        areaPathArb,
        iterationPathArb,
        organizationUrlArb,
        (type, title, description, areaPath, iterationPath, orgUrl) => {
          const params: CreateWorkItemParams = {
            projectName: 'TestProject',
            workItemType: type,
            title,
            description,
            areaPath,
            iterationPath,
            // No parentId
          };

          const payload = buildWorkItemPayload(params, orgUrl);
          const relation = findRelation(payload);

          // No relation should be present
          expect(relation).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 7: Work Item Path Assignment ──────────────────────────────────

describe('Property 7: Work Item Path Assignment', () => {
  /**
   * **Validates: Requirements 6.4, 6.5**
   *
   * For any work item creation in a given TargetContext, the payload MUST include
   * the correct iteration path and area path in the correct fields.
   */
  it('payload includes correct iteration and area paths for any work item type', () => {
    fc.assert(
      fc.property(
        workItemTypeArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        areaPathArb,
        iterationPathArb,
        organizationUrlArb,
        acceptanceCriteriaArb,
        (type, title, description, areaPath, iterationPath, orgUrl, acceptanceCriteria) => {
          const params: CreateWorkItemParams = {
            projectName: 'TestProject',
            workItemType: type,
            title,
            description,
            areaPath,
            iterationPath,
            acceptanceCriteria: type === 'User Story' ? acceptanceCriteria : undefined,
          };

          const payload = buildWorkItemPayload(params, orgUrl);

          const areaOp = findOp(payload, '/fields/System.AreaPath');
          const iterOp = findOp(payload, '/fields/System.IterationPath');

          // Area path MUST be present and match exactly
          expect(areaOp).toBeDefined();
          expect(areaOp!.value).toBe(areaPath);

          // Iteration path MUST be present and match exactly
          expect(iterOp).toBeDefined();
          expect(iterOp!.value).toBe(iterationPath);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 10: Required Fields Completeness ──────────────────────────────

describe('Property 10: Required Fields Completeness', () => {
  /**
   * **Validates: Requirements 7.1, 7.2, 7.3**
   *
   * For any work item type, payload MUST contain Title, Description, AreaPath.
   * For User Story, it MUST also contain AcceptanceCriteria.
   */
  it('payload contains all required fields for Epic and Feature types', () => {
    const epicOrFeatureArb = fc.constantFrom('Epic', 'Feature') as fc.Arbitrary<'Epic' | 'Feature'>;

    fc.assert(
      fc.property(
        epicOrFeatureArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        areaPathArb,
        iterationPathArb,
        organizationUrlArb,
        (type, title, description, areaPath, iterationPath, orgUrl) => {
          const params: CreateWorkItemParams = {
            projectName: 'TestProject',
            workItemType: type,
            title,
            description,
            areaPath,
            iterationPath,
          };

          const payload = buildWorkItemPayload(params, orgUrl);

          // Required fields: Title, Description, AreaPath
          expect(findOp(payload, '/fields/System.Title')).toBeDefined();
          expect(findOp(payload, '/fields/System.Title')!.value).toBe(title);

          expect(findOp(payload, '/fields/System.Description')).toBeDefined();
          expect(findOp(payload, '/fields/System.Description')!.value).toBe(description);

          expect(findOp(payload, '/fields/System.AreaPath')).toBeDefined();
          expect(findOp(payload, '/fields/System.AreaPath')!.value).toBe(areaPath);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('payload contains all required fields for User Story including AcceptanceCriteria', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb,
        nonEmptyStringArb,
        areaPathArb,
        iterationPathArb,
        organizationUrlArb,
        acceptanceCriteriaArb,
        (title, description, areaPath, iterationPath, orgUrl, acceptanceCriteria) => {
          const params: CreateWorkItemParams = {
            projectName: 'TestProject',
            workItemType: 'User Story',
            title,
            description,
            areaPath,
            iterationPath,
            acceptanceCriteria,
          };

          const payload = buildWorkItemPayload(params, orgUrl);

          // Required fields: Title, Description, AreaPath, AcceptanceCriteria
          expect(findOp(payload, '/fields/System.Title')).toBeDefined();
          expect(findOp(payload, '/fields/System.Title')!.value).toBe(title);

          expect(findOp(payload, '/fields/System.Description')).toBeDefined();
          expect(findOp(payload, '/fields/System.Description')!.value).toBe(description);

          expect(findOp(payload, '/fields/System.AreaPath')).toBeDefined();
          expect(findOp(payload, '/fields/System.AreaPath')!.value).toBe(areaPath);

          expect(findOp(payload, '/fields/Microsoft.VSTS.Common.AcceptanceCriteria')).toBeDefined();
          expect(findOp(payload, '/fields/Microsoft.VSTS.Common.AcceptanceCriteria')!.value).toBe(
            acceptanceCriteria
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
