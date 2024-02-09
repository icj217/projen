import { GitIdentity } from "./task-workflow";
import { JobStepConfiguration, JobStep } from "./workflows-model";
import { removeNullOrUndefinedProperties } from "../util/object";

/**
 * A collection of very commonly used, individual, GitHub Workflow Job steps.
 */
export class WorkflowSteps {
  /**
   * Checks out a repository.
   *
   * @param options Options to configure the `checkout` JobStep
   * @returns A JobStep that checks out a repository
   */
  public static checkout(options: CheckoutOptions = {}): JobStep {
    const checkoutWith = removeNullOrUndefinedProperties({
      "fetch-depth": options?.with?.fetchDepth,
      token: options?.with?.token,
      ref: options?.with?.ref,
      repository: options?.with?.repository,
      ...(options?.with?.lfs ? { lfs: true } : {}),
    });

    return {
      ...this.buildJobStepConfig({
        ...options,
        name: options.name ?? "Checkout",
      }),
      uses: "actions/checkout@v3",
      with: Object.keys(checkoutWith).length > 0 ? checkoutWith : undefined,
    };
  }

  /**
   * Configures the git identity (user name and email).
   *
   * @param options Options to configure the git identity JobStep
   * @returns Job step that configures the provided git identity
   */
  public static setupGitIdentity(options: SetupGitIdentityOptions): JobStep {
    return {
      ...this.buildJobStepConfig({
        ...options,
        name: options.name ?? "Set git identity",
      }),
      run: [
        `git config user.name "${options.gitIdentity.name}"`,
        `git config user.email "${options.gitIdentity.email}"`,
      ].join("\n"),
    };
  }

  /**
   * Checks if a tag exists.
   *
   * Requires a checkout step to have been run before this step with "fetch-depth" set to "0".
   *
   * Outputs:
   * - `exists`: A string value of 'true' or 'false' indicating if the tag exists.
   *
   * @param tag The tag to check. You may use valid bash code instead of a literal string in this field.
   * @param options Options to configure the `tag-exists` JobStep
   * @returns Job step that checks if the provided tag exists
   */
  public static tagExists(tag: string, options: JobStepConfiguration): JobStep {
    const checkTag = (remoteTag: string) =>
      `git ls-remote -q --exit-code --tags origin ${remoteTag}`;
    const varIsSet = (variable: string) => `[ ! -z "$${variable}" ]`;
    const setOutput = (value: boolean) =>
      `(echo "exists=${value ? "true" : "false"}" >> $GITHUB_OUTPUT)`;

    return {
      ...this.buildJobStepConfig({
        ...options,
        name: options.name ?? "Check if tag exists",
        id: options.id ?? "check-tag",
      }),
      run: [
        `TAG=${tag}`,
        `(${varIsSet("TAG")} && ${checkTag("$TAG")} && ${setOutput(
          true
        )}) || ${setOutput(false)}`,
        "cat $GITHUB_OUTPUT",
      ].join("\n"),
    };
  }

  /**
   * Uploads an artifact.
   *
   * @param options Options to configure the `upload-artifact` JobStep
   * @returns A JobStep that uploads an artifact
   */
  public static uploadArtifact(options: UploadArtifactOptions): JobStep {
    const uploadArtifactWith: UploadArtifactWith =
      removeNullOrUndefinedProperties({
        name: options?.with?.name,
        path: options?.with?.path,
        overwrite: options?.with?.overwrite ?? true,
        "if-no-files-found": options?.with?.ifNoFilesFound,
        "retention-days": options?.with?.retentionDays,
        "compression-level": options?.with?.compressionLevel,
      });

    return {
      ...this.buildJobStepConfig({
        ...options,
        name: options.name ?? "Upload artifact",
      }),
      uses: "actions/upload-artifact@v4",
      with: uploadArtifactWith,
    };
  }

  /**
   * Simple adapter to ensure we only include the necessary fields for a JobStepConfiguration.
   */
  private static buildJobStepConfig(
    options: JobStepConfiguration
  ): JobStepConfiguration {
    return {
      continueOnError: options?.continueOnError,
      env: options?.env,
      id: options?.id,
      if: options?.if,
      name: options?.name,
      timeoutMinutes: options?.timeoutMinutes,
      workingDirectory: options?.workingDirectory,
    };
  }
}
export interface CheckoutOptions extends JobStepConfiguration {
  /**
   * Options for `checkout`.
   */
  readonly with?: CheckoutWith;
}

/**
 * Options for `checkout`.
 */
export interface CheckoutWith {
  /**
   * Number of commits to fetch. 0 indicates all history for all branches and tags.
   *
   * @default 1
   */
  readonly fetchDepth?: number;
  /**
   * Whether LFS is enabled for the GitHub repository
   *
   * @default false
   */
  readonly lfs?: boolean;

  /**
   * Branch or tag name.
   * @default - the default branch is implicitly used
   */
  readonly ref?: string;

  /**
   * The repository (owner/repo) to use.
   * @default - the default repository is implicitly used
   */
  readonly repository?: string;

  /**
   * A GitHub token to use when checking out the repository.
   *
   * If the intent is to push changes back to the branch, then you must use a
   * PAT with `repo` (and possibly `workflows`) permissions.
   * @default - the default GITHUB_TOKEN is implicitly used
   */
  readonly token?: string;
}

export interface SetupGitIdentityOptions extends JobStepConfiguration {
  /**
   * The identity to use.
   */
  readonly gitIdentity: GitIdentity;
}

export interface UploadArtifactWith {
  /**
   * Name of the artifact to upload.
   *
   * @default "artifact"
   */
  readonly name?: string;

  /**
   * A file, directory or wildcard pattern that describes what to upload
   */
  readonly path: string;

  /**
   * The desired behavior if no files are found using the provided path.
   * Available Options:
   *   warn: Output a warning but do not fail the action
   *   error: Fail the action with an error message
   *   ignore: Do not output any warnings or errors, the action does not fail
   *
   * @default "warn"
   */
  readonly ifNoFilesFound?: "error" | "warn" | "ignore";

  /**
   * Duration after which artifact will expire in days. 0 means using default repository retention.
   *
   * Minimum 1 day.
   * Maximum 90 days unless changed from the repository settings page.
   *
   * @default - The default repository retention
   */
  readonly retentionDays?: number;

  /**
   * The level of compression for Zlib to be applied to the artifact archive.
   *
   * The value can range from 0 to 9.
   * For large files that are not easily compressed, a value of 0 is recommended for significantly faster uploads.
   *
   * @default 6
   */
  readonly compressionLevel?: number;

  /**
   * Whether action should overwrite an existing artifact with the same name (should one exist)
   *
   * Introduced in v4 and represents a breaking change from the behavior of the v3 action.
   * To maintain backwards compatibility with existing, this should be set the `true` (the default).
   *
   * @default true
   */
  readonly overwrite?: boolean;
}

export interface UploadArtifactOptions extends JobStepConfiguration {
  /**
   * Options for `upload-artifact`.
   */
  readonly with: UploadArtifactWith;
}
