import { config } from './config.js';
import { EventBus } from './event-bus.js';
import { AuthClient } from '../modules/auth/auth-client.js';
import { ProjectClient } from '../modules/projects/project-client.js';
import { WorkspaceClient } from '../modules/workspace/workspace-client.js';
import { DeploymentClient } from '../modules/deployment/deployment-client.js';
import { EditorService } from '../modules/editor/editor-service.js';
import { FileSystemService } from '../modules/filesystem/filesystem-service.js';
import { TerminalService } from '../modules/terminal/terminal-service.js';
import { GitService } from '../modules/git/git-service.js';
import { PreviewService } from '../modules/preview/preview-service.js';
import { UIService } from '../modules/ui/ui-service.js';
import { TypeScriptLanguageServerClient } from '../modules/workspace/language-server-client.js';

export class ApplicationRuntime {
  constructor(app) {
    this.app = app;
    this.config = config;
    this.events = new EventBus();
    this.auth = new AuthClient();
    this.project = new ProjectClient();
    this.workspace = new WorkspaceClient();
    this.deployment = new DeploymentClient();
    this.editor = new EditorService({ app });
    this.filesystem = new FileSystemService({ app });
    this.terminal = new TerminalService({ app, workspaceClient: this.workspace });
    this.git = new GitService({ app });
    this.preview = new PreviewService({ app });
    this.ui = new UIService({ app });
    this.languageServer = new TypeScriptLanguageServerClient({ workspaceClient: this.workspace });
  }

  get capabilities() {
    return Object.freeze({
      localEditor: true,
      localFilesystem: true,
      browserGit: true,
      pwa: true,
      cloudAuth: this.auth.enabled,
      cloudProjects: this.project.enabled,
      cloudWorkspace: this.workspace.enabled,
      cloudDeployment: this.deployment.enabled,
      realTerminal: this.workspace.enabled,
      realTypeScriptLanguageServer: this.workspace.enabled
    });
  }
}
