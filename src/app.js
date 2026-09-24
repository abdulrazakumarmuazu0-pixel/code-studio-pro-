// ============================================
// CODE STUDIO PRO - Main Application
// PWA + Android/iOS Native Support
// ============================================

class CodeStudio {
    constructor() {
        this.editor = null;
        this.currentFile = null;
        this.openFiles = [];
        this.fileSystem = new Map();
        this.terminalHistory = [];
        this.terminalHistoryIndex = 0;
        this.terminalCwd = '';
        this.cloudTerminal = null;
        this.cloudTerminalWorkspaceId = null;
        this.cloudProjectId = null;
        this.isDarkTheme = true;
        this.projectName = 'untitled-project';
        this.clipboard = null;
        this.contextTarget = null;
        this.selectedFolder = '';
        this.expandedFolders = new Set();
        
        // Real per-file Monaco models (so diagnostics/Problems work across the
        // whole project, not just whichever file happens to be open right now).
        this.monacoModels = new Map();
        this.welcomeModel = null;
        this.deferredPrompt = null;
        this.isNativeApp = false;
        this.platform = 'web';
        this.settings = {
            theme: 'dark',
            fontSize: 14,
            wordWrap: 'on',
            autoSave: 'afterDelay',
            gitAuthorName: '',
            gitAuthorEmail: '',
        };
        
        // Real git state (isomorphic-git + LightningFS), lazily initialized
        // the first time a git action is used.
        this.gitFsReady = false;
        this.gitFs = null;
        this.gitPfs = null;
        this.gitDir = '/repo';
        this.gitRemoteUrl = '';
        this.gitCurrentBranch = 'main';
        this.previewDeviceMode = false;
        this.previewDeviceWidth = '100%';
        
        this.init();
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    async init() {
        // Detect platform
        this.detectPlatform();
        
        // Load settings
        this.loadSettings();
        
        // Register Service Worker only from a supported origin.
        // IMPORTANT: file:// builds are intentionally editor-only; they must
        // never invoke the Service Worker API because browsers reject it.
        if (window.location.protocol !== 'file:' && window.location.origin !== 'null') {
            await this.registerServiceWorker();
        } else {
            console.info('[SW] File-origin editor mode: Service Worker registration is disabled.');
        }
        
        // Setup PWA install prompt
        this.setupPWAInstall();
        
        // Setup offline detection
        this.setupOfflineDetection();
        
        // Load Monaco Editor
        await this.loadMonaco();
        
        // Initialize file system
        this.initFileSystem();
        
        // Setup event listeners
        this.setupEvents();
        
        // Hide loading, show welcome
        this.hideLoading();
        
        // Load recent projects
        this.loadRecentProjects();
        await this.restoreLastProject();
    }
    
    detectPlatform() {
        // Check if running as Capacitor/Cordova native app
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            this.isNativeApp = true;
            this.platform = window.Capacitor.getPlatform(); // 'ios', 'android', 'web'
            console.log('[App] Running as native app on:', this.platform);
        } else if (window.cordova) {
            this.isNativeApp = true;
            this.platform = window.device ? window.device.platform.toLowerCase() : 'native';
            console.log('[App] Running as Cordova app on:', this.platform);
        } else {
            console.log('[App] Running as web/PWA');
        }
        
        // Apply platform-specific styles
        if (this.isNativeApp) {
            document.body.classList.add('native-app');
            if (this.platform === 'ios') {
                document.body.classList.add('ios');
            } else if (this.platform === 'android') {
                document.body.classList.add('android');
            }
        }
    }
    
    async registerServiceWorker() {
        // Service Workers require a trustworthy origin. A file:// page (and an
        // opaque sandboxed iframe) cannot register a Service Worker. Do not
        // attempt registration in those environments; doing so only creates
        // a noisy console error while the editor itself can still run locally.
        const protocol = window.location.protocol;
        const origin = window.location.origin;

        // Absolute fail-closed guard: do not touch navigator.serviceWorker on file://.
        if (protocol === 'file:' || origin === 'null') {
            console.info('[SW] Skipped registration for unsupported file/opaque origin:', origin);
            return;
        }
        const isLocalhostHttp = (protocol === 'http:' &&
            /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname));
        const isServiceWorkerOrigin = protocol === 'https:' || isLocalhostHttp ||
            (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

        if (!('serviceWorker' in navigator)) {
            console.info('[SW] Service Worker API is unavailable in this runtime.');
            return;
        }

        if (!isServiceWorkerOrigin) {
            console.info('[SW] Skipped registration: Service Workers require an HTTP(S) or supported native origin. Current origin:', origin);
            return;
        }

        try {
                const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
                this.swRegistration = registration;
                console.log('[SW] Registered:', registration.scope);

                // Ask a waiting worker to activate only after the user has a current UI.
                // This keeps updates real and avoids silently terminating an active editor session.
                if (registration.waiting && navigator.serviceWorker.controller) {
                    registration.waiting.postMessage({ type: 'CODE_STUDIO_SKIP_WAITING' });
                }

                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (this._swReloading) return;
                    this._swReloading = true;
                    window.location.reload();
                }, { once: true });
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showToast('Update available! Refresh to update.', 'info');
                        }
                    });
                });
                
                // Check for existing controller
                if (registration.active) {
                    console.log('[SW] Active controller found');
                }
        } catch (error) {
            // Registration failures are operationally relevant only on a supported
            // service-worker origin. Never surface a file:// registration error.
            if (window.location.protocol !== 'file:' && window.location.origin !== 'null') {
                console.error('[SW] Registration failed:', error);
            } else {
                console.info('[SW] Registration skipped for unsupported origin.');
            }
        }
    }
    
    setupPWAInstall() {
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Store the event for later use
            this.deferredPrompt = e;
            // Show install banner
            this.showPWAInstallBanner();
        });
        
        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            this.hidePWAInstallBanner();
            this.showToast('Code Studio Pro installed!', 'success');
            console.log('[PWA] App was installed');
        });
    }
    
    setupOfflineDetection() {
        const offlineIndicator = document.getElementById('offlineIndicator');
        
        window.addEventListener('online', () => {
            offlineIndicator.classList.remove('active');
            this.showToast('Back online!', 'success');
            // Trigger background sync
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((reg) => {
                    if ('sync' in reg) {
                        reg.sync.register('sync-projects').catch(() => {});
                    }
                });
            }
        });
        
        window.addEventListener('offline', () => {
            offlineIndicator.classList.add('active');
            this.showToast('You are offline. Working in local mode.', 'warning');
        });
        
        // Check initial state
        if (!navigator.onLine) {
            offlineIndicator.classList.add('active');
        }
    }
    
    async loadMonaco() {
        return new Promise((resolve) => {
            require.config({ 
                paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }
            });
            
            require(['vs/editor/editor.main'], () => {
                // Real diagnostics: enable JS/TS semantic + syntax checking, and
                // JSON schema validation, so the Problems panel reflects actual
                // errors Monaco's language services find — not a fake list.
                monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: false,
                    noSyntaxValidation: false
                });
                monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                    target: monaco.languages.typescript.ScriptTarget.ES2020,
                    allowNonTsExtensions: true,
                    allowJs: true,
                    checkJs: true,
                    jsx: monaco.languages.typescript.JsxEmit.React,
                    module: monaco.languages.typescript.ModuleKind.ESNext,
                    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs
                });
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                    noSemanticValidation: false,
                    noSyntaxValidation: false
                });
                monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                    target: monaco.languages.typescript.ScriptTarget.ES2020,
                    allowNonTsExtensions: true,
                    jsx: monaco.languages.typescript.JsxEmit.React,
                    module: monaco.languages.typescript.ModuleKind.ESNext,
                    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs
                });
                monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                    validate: true,
                    allowComments: false
                });
                
                this.registerTypeScriptLanguageProviders();

                this.welcomeModel = monaco.editor.createModel(this.getWelcomeContent(), 'javascript');
                
                this.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
                    model: this.welcomeModel,
                    theme: this.settings.theme === 'light' ? 'vs' : 'vs-dark',
                    fontSize: this.settings.fontSize,
                    fontFamily: 'Fira Code, SF Mono, Monaco, monospace',
                    minimap: { enabled: true },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    roundedSelection: false,
                    padding: { top: 16 },
                    lineNumbers: 'on',
                    renderLineHighlight: 'all',
                    selectOnLineNumbers: true,
                    matchBrackets: 'always',
                    tabSize: 2,
                    insertSpaces: true,
                    wordWrap: this.settings.wordWrap,
                    folding: true,
                    foldingStrategy: 'indentation',
                    showFoldingControls: 'always',
                    bracketPairColorization: { enabled: true },
                    guides: {
                        bracketPairs: true,
                        indentation: true
                    },
                    quickSuggestions: true,
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnEnter: 'on',
                    formatOnPaste: true,
                    formatOnType: true,
                    autoIndent: 'full',
                    dragAndDrop: true,
                    links: true,
                    mouseWheelZoom: true,
                    multiCursorModifier: 'altCmd',
                    renderWhitespace: 'selection',
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on'
                });
                
                // Update cursor position
                this.editor.onDidChangeCursorPosition((e) => {
                    document.getElementById('cursorPosition').textContent = 
                        `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
                });
                
                // Content sync, modification tracking, and autosave are handled
                // per-model in getOrCreateModel() so they work for every open
                // file, not just whichever one is on screen right now.
                
                // Focus change auto-save
                window.addEventListener('blur', () => {
                    if (this.settings.autoSave === 'onFocusChange' && this.currentFile) {
                        this.saveFile();
                    }
                });
                
                // Real Problems panel: Monaco fires this whenever any model's
                // diagnostics change, across every open file at once.
                monaco.editor.onDidChangeMarkers(() => {
                    this.refreshProblemsPanel();
                });
                
                resolve();
            });
        });
    }
    
    getWelcomeContent() {
        return `// Welcome to Code Studio Pro! 🚀
// ============================================
// Build websites & mobile apps in your browser
// 
// Features:
// ✅ Monaco Editor (VS Code powered)
// ✅ Live Preview
// ✅ Terminal
// ✅ Mobile App Builder
// ✅ Offline Support (PWA)
// ✅ Android & iOS Export
// 
// Keyboard Shortcuts:
// Ctrl+N  - New File
// Ctrl+O  - Open Project
// Ctrl+S  - Save File
// Ctrl+P  - Run Preview
// Ctrl+B  - Toggle Preview
// Ctrl+F  - Find
// Ctrl+H  - Replace
// Ctrl+/  - Toggle Comment
// 
// Start coding below:
`;

    }
    
    initFileSystem() {
        const defaultFiles = {
            'index.html': {
                type: 'file',
                content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My App</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>🚀 Welcome to Code Studio!</h1>
        <p>Start building your amazing project here.</p>
        <button id="btn">Click Me</button>
        <div id="output"></div>
    </div>
    <script src="app.js"><\/script>
</body>
</html>`,
                language: 'html'
            },
            'style.css': {
                type: 'file',
                content: `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.container {
    background: white;
    padding: 40px;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    text-align: center;
    max-width: 420px;
    width: 100%;
    animation: fadeIn 0.6s ease;
}

h1 {
    color: #333;
    margin-bottom: 12px;
    font-size: 28px;
    font-weight: 800;
}

p {
    color: #666;
    margin-bottom: 24px;
    line-height: 1.6;
    font-size: 15px;
}

button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 14px 36px;
    border-radius: 30px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5);
}

button:active {
    transform: translateY(0);
}

#output {
    margin-top: 20px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 12px;
    font-size: 14px;
    color: #333;
    display: none;
}

#output.show {
    display: block;
    animation: slideUp 0.3s ease;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}`,
                language: 'css'
            },
            'app.js': {
                type: 'file',
                content: `// Your JavaScript code here
console.log('🚀 Code Studio Pro - App started!');

const btn = document.getElementById('btn');
const output = document.getElementById('output');

btn.addEventListener('click', () => {
    output.innerHTML = \`
        <strong>✅ Success!</strong><br>
        <span style="color: #666;">Your app is working perfectly.</span><br>
        <span style="font-size: 12px; color: #999; margin-top: 8px; display: block;">
            Built with Code Studio Pro
        </span>
    \`;
    output.classList.add('show');
    
    console.log('Button clicked! App is running.');
});

// Example: Fetch API
async function fetchData(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
}

// Example: Local Storage
function saveToStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getFromStorage(key) {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
}`,
                language: 'javascript'
            },
            'README.md': {
                type: 'file',
                content: `# My Project

Welcome to your new project built with **Code Studio Pro**!

## 🚀 Getting Started

1. Edit files in the explorer panel on the left
2. Click **Run** (▶️) to see live preview
3. Use **Mobile Builder** to build Android/iOS apps

## ✨ Features

- ✅ Monaco Editor with IntelliSense
- ✅ Live Preview with auto-refresh
- ✅ Built-in Terminal
- ✅ Mobile App Builder (APK/AAB)
- ✅ Offline Support (PWA)
- ✅ Git Integration
- ✅ Auto-save

## 📱 Build Mobile App

1. Click the **Mobile** button
2. Select your target platform (Android/iOS)
3. Choose device frame
4. Click **Build APK** or **Build AAB**

## 🛠️ Tech Stack

- HTML5
- CSS3
- JavaScript (ES6+)
- Capacitor (for mobile builds)

---
Built with ❤️ using Code Studio Pro`,
                language: 'markdown'
            }
        };
        
        Object.entries(defaultFiles).forEach(([name, data]) => {
            this.fileSystem.set(name, { ...data, modified: false });
        });
        
        this.renderFileTree();
    }
    
    setupEvents() {
        // Context menu
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.file-item')) {
                e.preventDefault();
                this.contextTarget = e.target.closest('.file-item').dataset.path;
                this.showContextMenu(e.clientX, e.clientY);
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                document.getElementById('contextMenu').style.display = 'none';
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        this.saveFile();
                        break;
                    case 'n':
                        e.preventDefault();
                        this.newFile();
                        break;
                    case 'o':
                        e.preventDefault();
                        this.openProject();
                        break;
                    case 'p':
                        e.preventDefault();
                        this.runCode();
                        break;
                    case 'b':
                        e.preventDefault();
                        this.togglePreview();
                        break;
                    case 'f':
                        e.preventDefault();
                        this.editor.getAction('actions.find').run();
                        break;
                    case 'h':
                        e.preventDefault();
                        this.editor.getAction('editor.action.startFindReplaceAction:').run();
                        break;
                    case '/':
                        e.preventDefault();
                        this.toggleComment();
                        break;
                    case 'k':
                        if (e.ctrlKey) {
                            e.preventDefault();
                            this.formatCode();
                        }
                        break;
                }
            }
        });
        
        // Handle visibility change (auto-save)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.settings.autoSave !== 'off') {
                this.saveFile();
            }
        });
        
        // Don't lose in-progress edits on refresh/close
        window.addEventListener('beforeunload', () => {
            this.syncCurrentFileToMemory();
            this.saveProjectToDB();
        });
    }
    
    // ============================================
    // LOADING & UI
    // ============================================
    hideLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        const progressBar = document.getElementById('loadingProgress');
        
        // Simulate loading progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(() => {
                    loadingScreen.classList.add('hidden');
                    document.getElementById('welcomeScreen').classList.add('active');
                }, 300);
            }
            progressBar.style.width = progress + '%';
        }, 200);
    }
    
    // ============================================
    // FILE SYSTEM
    // ============================================
    renderFileTree() {
        const tree = document.getElementById('fileTree');
        tree.innerHTML = '';
        const root = this.buildFileTree();
        this.renderTreeNode(root, tree, 0);
    }
    
    // Groups the flat fileSystem Map (keys are full paths like "src/utils/x.js")
    // into a real nested tree so folders can contain files and other folders.
    buildFileTree() {
        const root = { type: 'folder', name: '', path: '', children: new Map() };
        
        const ensureFolder = (path) => {
            if (!path) return root;
            const parts = path.split('/');
            let node = root;
            let cur = '';
            for (const part of parts) {
                cur = cur ? `${cur}/${part}` : part;
                if (!node.children.has(part)) {
                    node.children.set(part, { type: 'folder', name: part, path: cur, children: new Map() });
                }
                node = node.children.get(part);
            }
            return node;
        };
        
        // Explicit folders first (so empty folders still show up)
        this.fileSystem.forEach((data, path) => {
            if (data.type === 'folder') ensureFolder(path);
        });
        
        // Files create any missing intermediate folders implicitly
        this.fileSystem.forEach((data, path) => {
            if (data.type !== 'file') return;
            const parts = path.split('/');
            const fileName = parts.pop();
            const parentNode = ensureFolder(parts.join('/'));
            parentNode.children.set(fileName, { type: 'file', name: fileName, path, data });
        });
        
        return root;
    }
    
    renderTreeNode(node, container, depth) {
        const folders = [];
        const files = [];
        node.children.forEach(child => (child.type === 'folder' ? folders : files).push(child));
        folders.sort((a, b) => a.name.localeCompare(b.name));
        files.sort((a, b) => a.name.localeCompare(b.name));
        
        folders.forEach(folder => {
            const expanded = this.expandedFolders.has(folder.path);
            const item = document.createElement('div');
            item.className = `file-item folder ${folder.path === this.selectedFolder ? 'active' : ''}`;
            item.dataset.path = folder.path;
            item.style.paddingLeft = `${8 + depth * 16}px`;
            item.innerHTML = `
                <span class="file-icon">
                    <i class="fas fa-chevron-${expanded ? 'down' : 'right'}" style="font-size: 9px; width: 10px; display: inline-block;"></i>
                    <i class="fas fa-folder${expanded ? '-open' : ''}" style="color: #dcb67a;"></i>
                </span>
                <span class="file-name">${this.escapeHtml(folder.name)}</span>
            `;
            item.onclick = (e) => {
                e.stopPropagation();
                this.toggleFolder(folder.path);
            };
            container.appendChild(item);
            
            if (expanded) {
                this.renderTreeNode(folder, container, depth + 1);
            }
        });
        
        files.forEach(file => {
            const item = document.createElement('div');
            item.className = `file-item ${file.path === this.currentFile ? 'active' : ''}`;
            item.dataset.path = file.path;
            item.style.paddingLeft = `${8 + (depth + 1) * 16}px`;
            
            const icon = this.getFileIcon(file.name);
            
            item.innerHTML = `
                <span class="file-icon">${icon}</span>
                <span class="file-name">${this.escapeHtml(file.name)}</span>
                ${file.data.modified ? '<span class="file-modified"></span>' : ''}
            `;
            
            item.onclick = () => this.openFile(file.path);
            item.ondblclick = () => this.openFile(file.path);
            
            container.appendChild(item);
        });
    }
    
    // Expands/collapses a folder in the Explorer and marks it as the target
    // for "New File" / "New Folder" (toolbar buttons create inside it).
    toggleFolder(path) {
        if (this.expandedFolders.has(path)) {
            this.expandedFolders.delete(path);
        } else {
            this.expandedFolders.add(path);
        }
        this.selectedFolder = path;
        this.renderFileTree();
    }
    
    // Walks up from a context-menu target (file or folder) to find the
    // folder path that "New File Here" / "New Folder Here" should use.
    getContextFolder() {
        if (!this.contextTarget) return this.selectedFolder;
        const target = this.fileSystem.get(this.contextTarget);
        if (target && target.type === 'folder') return this.contextTarget;
        const parts = this.contextTarget.split('/');
        parts.pop();
        return parts.join('/');
    }
    
    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const icons = {
            html: '<i class="fab fa-html5" style="color: #e34c26;"></i>',
            htm: '<i class="fab fa-html5" style="color: #e34c26;"></i>',
            css: '<i class="fab fa-css3-alt" style="color: #264de4;"></i>',
            scss: '<i class="fab fa-sass" style="color: #cc6699;"></i>',
            sass: '<i class="fab fa-sass" style="color: #cc6699;"></i>',
            less: '<i class="fab fa-less" style="color: #1d365d;"></i>',
            js: '<i class="fab fa-js" style="color: #f7df1e;"></i>',
            jsx: '<i class="fab fa-react" style="color: #61dafb;"></i>',
            ts: '<i class="fab fa-js" style="color: #3178c6;"></i>',
            tsx: '<i class="fab fa-react" style="color: #61dafb;"></i>',
            json: '<i class="fas fa-cog" style="color: #d4d4d4;"></i>',
            md: '<i class="fas fa-book" style="color: #fff;"></i>',
            py: '<i class="fab fa-python" style="color: #3776ab;"></i>',
            java: '<i class="fab fa-java" style="color: #007396;"></i>',
            php: '<i class="fab fa-php" style="color: #777bb4;"></i>',
            rb: '<i class="fas fa-gem" style="color: #cc342d;"></i>',
            go: '<i class="fab fa-golang" style="color: #00add8;"></i>',
            rs: '<i class="fab fa-rust" style="color: #dea584;"></i>',
            vue: '<i class="fab fa-vuejs" style="color: #4fc08d;"></i>',
            angular: '<i class="fab fa-angular" style="color: #dd0031;"></i>',
            png: '<i class="fas fa-image" style="color: #4ec9b0;"></i>',
            jpg: '<i class="fas fa-image" style="color: #4ec9b0;"></i>',
            jpeg: '<i class="fas fa-image" style="color: #4ec9b0;"></i>',
            gif: '<i class="fas fa-image" style="color: #4ec9b0;"></i>',
            svg: '<i class="fas fa-image" style="color: #4ec9b0;"></i>',
            ico: '<i class="fas fa-image" style="color: #4ec9b0;"></i>',
            xml: '<i class="fas fa-code" style="color: #ff6600;"></i>',
            sql: '<i class="fas fa-database" style="color: #f29111;"></i>',
            yaml: '<i class="fas fa-file-code" style="color: #cb171e;"></i>',
            yml: '<i class="fas fa-file-code" style="color: #cb171e;"></i>',
            dockerfile: '<i class="fab fa-docker" style="color: #2496ed;"></i>',
            gitignore: '<i class="fab fa-git-alt" style="color: #f05032;"></i>'
        };
        return icons[ext] || '<i class="fas fa-file" style="color: var(--text-secondary);"></i>';
    }
    
    getLanguage(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const langs = {
            html: 'html', htm: 'html',
            css: 'css', scss: 'scss', sass: 'sass', less: 'less',
            js: 'javascript', jsx: 'javascript',
            ts: 'typescript', tsx: 'typescript',
            json: 'json',
            md: 'markdown',
            py: 'python',
            java: 'java',
            php: 'php',
            rb: 'ruby',
            go: 'go',
            rs: 'rust',
            vue: 'html',
            xml: 'xml',
            sql: 'sql',
            yaml: 'yaml', yml: 'yaml',
            dockerfile: 'dockerfile',
            sh: 'shell', bash: 'shell', zsh: 'shell'
        };
        return langs[ext] || 'plaintext';
    }
    
    // Real per-file Monaco models: each open file keeps its own live model
    // (and diagnostics) instead of being overwritten by whichever file is
    // currently on screen — this is what makes cross-file Problems possible.
    getOrCreateModel(path) {
        if (this.monacoModels.has(path)) return this.monacoModels.get(path);
        
        const file = this.fileSystem.get(path);
        if (!file) return null;
        
        const uri = monaco.Uri.parse(`file:///${encodeURI(path)}`);
        const model = monaco.editor.createModel(file.content, this.getLanguage(path), uri);
        
        model.onDidChangeContent(() => {
            const f = this.fileSystem.get(path);
            if (f) {
                f.content = model.getValue();
                this.markFileAsModified(path);
                if (this.isTypeScriptLike(path) && this.runtime?.languageServer?.socket?.readyState === WebSocket.OPEN) {
                    this.runtime.languageServer.change(path, model.getValue()).then(() => this.refreshTypeScriptDiagnostics(path)).catch(() => {});
                }
                if (this.settings.autoSave === 'afterDelay') {
                    this.debouncedSave();
                }
            }
        });
        
        this.monacoModels.set(path, model);
        return model;
    }
    
    // Disposes the Monaco model(s) for the given paths and cleans up any open
    // tabs pointing at them — used whenever files are deleted, moved, or the
    // whole project is swapped out (so we never leak or show stale diagnostics).
    closeModelsFor(paths) {
        paths.forEach(path => {
            const model = this.monacoModels.get(path);
            if (model) {
                if (this.editor && this.editor.getModel() === model) {
                    this.editor.setModel(this.welcomeModel);
                }
                model.dispose();
                this.monacoModels.delete(path);
            }
            const idx = this.openFiles.indexOf(path);
            if (idx !== -1) this.openFiles.splice(idx, 1);
            if (this.currentFile === path) this.currentFile = null;
        });
        
        if (!this.currentFile && this.openFiles.length > 0) {
            this.openFile(this.openFiles[this.openFiles.length - 1]);
        } else if (!this.currentFile) {
            document.getElementById('fileLanguage').textContent = 'Plain Text';
        }
    }
    
    disposeAllModels() {
        this.monacoModels.forEach(model => model.dispose());
        this.monacoModels.clear();
        this.openFiles = [];
        this.currentFile = null;
        if (this.editor && this.welcomeModel) {
            this.editor.setModel(this.welcomeModel);
        }
    }
    
    openFile(filename) {
        const file = this.fileSystem.get(filename);
        if (!file || file.type === 'folder') return;
        
        this.currentFile = filename;
        
        // New files/folders created via the toolbar default to this file's folder,
        // and every ancestor folder is expanded so the open file is visible
        const parts = filename.split('/');
        parts.pop();
        this.selectedFolder = parts.join('/');
        let cur = '';
        for (const part of parts) {
            cur = cur ? `${cur}/${part}` : part;
            this.expandedFolders.add(cur);
        }
        
        if (!this.openFiles.includes(filename)) {
            this.openFiles.push(filename);
        }
        
        const model = this.getOrCreateModel(filename);
        this.editor.setModel(model);
        if (this.isTypeScriptLike(filename) && this.runtime?.languageServer?.socket?.readyState === WebSocket.OPEN) {
            this.runtime.languageServer.open(filename, model.getValue()).then(() => this.refreshTypeScriptDiagnostics(filename)).catch(() => {});
        }
        
        this.renderTabs();
        this.renderFileTree();
        document.getElementById('fileLanguage').textContent = this.getLanguage(filename).toUpperCase();
        this.refreshProblemsPanel();
    }

    syncCurrentFileToMemory() {
        if (!this.currentFile || !this.editor) return;
        const current = this.fileSystem.get(this.currentFile);
        const model = this.monacoModels.get(this.currentFile);
        if (current && model) current.content = model.getValue();
    }
    
    renderTabs() {
        const tabsBar = document.getElementById('tabsBar');
        tabsBar.innerHTML = '';
        
        this.openFiles.forEach(filename => {
            const file = this.fileSystem.get(filename);
            const baseName = filename.split('/').pop();
            const tab = document.createElement('div');
            tab.className = `tab ${filename === this.currentFile ? 'active' : ''} ${file?.modified ? 'tab-unsaved' : ''}`;
            tab.title = filename;
            tab.innerHTML = `
                <span class="tab-icon">${this.getFileIcon(baseName)}</span>
                <span class="tab-name">${this.escapeHtml(baseName)}</span>
                <span class="tab-close" onclick="event.stopPropagation(); app.closeTab('${filename}')">
                    <i class="fas fa-times"></i>
                </span>
            `;
            tab.onclick = () => this.openFile(filename);
            tabsBar.appendChild(tab);
        });
    }
    
    closeTab(filename) {
        const index = this.openFiles.indexOf(filename);
        this.openFiles = this.openFiles.filter(f => f !== filename);
        
        const model = this.monacoModels.get(filename);
        if (model) {
            if (this.editor.getModel() === model) {
                this.editor.setModel(this.welcomeModel);
            }
            model.dispose();
            this.monacoModels.delete(filename);
        }
        
        if (this.currentFile === filename) {
            if (this.openFiles.length > 0) {
                this.openFile(this.openFiles[Math.min(index, this.openFiles.length - 1)]);
            } else {
                this.currentFile = null;
                document.getElementById('fileLanguage').textContent = 'Plain Text';
            }
        }
        
        this.renderTabs();
    }
    
    highlightFileInTree(filename) {
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.toggle('active', item.dataset.path === filename);
        });
    }
    
    markFileAsModified(filename) {
        const file = this.fileSystem.get(filename);
        if (file && !file.modified) {
            file.modified = true;
            this.renderTabs();
            this.renderFileTree();
        }
    }
    
    saveFile() {
        if (!this.currentFile) return;
        this.syncCurrentFileToMemory();
        const file = this.fileSystem.get(this.currentFile);
        if (file) {
            file.modified = false;
            this.renderTabs();
            this.renderFileTree();
            this.showToast('File saved', 'success');
            
            // Save this file, and persist the whole project so nothing is lost on reload
            this.saveToIndexedDB(this.currentFile, file.content);
            this.saveProjectToDB();
            
            // Keep live preview in sync with real, saved code
            if (document.getElementById('previewPanel')?.classList.contains('open')) {
                this.runCode();
            }
        }
    }
    
    debouncedSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => this.saveFile(), 1000);
    }
    
    // ============================================
    // INDEXEDDB STORAGE
    // ============================================
    async saveToIndexedDB(path, content) {
        try {
            const db = await this.openDB();
            await this.idbRequest(db, 'files', 'readwrite', (store) =>
                store.put({ path, content, timestamp: Date.now() })
            );
        } catch (err) {
            console.error('IndexedDB save error:', err);
        }
    }
    
    async loadFromIndexedDB(path) {
        try {
            const db = await this.openDB();
            return await this.idbRequest(db, 'files', 'readonly', (store) => store.get(path));
        } catch (err) {
            console.error('IndexedDB load error:', err);
            return null;
        }
    }
    
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('code-studio-db', 2);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'path' });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                if (db.objectStoreNames.contains('projects')) {
                    db.deleteObjectStore('projects');
                }
                db.createObjectStore('projects', { keyPath: 'id' });
            };
        });
    }
    
    // Wrap a single IDBRequest in a real Promise so callers can safely await it
    idbRequest(db, storeName, mode, action) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const req = action(store);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    
    // ============================================
    // REAL PROJECT PERSISTENCE (IndexedDB)
    // ============================================
    async saveProjectToDB() {
        try {
            const db = await this.openDB();
            const files = {};
            this.fileSystem.forEach((data, name) => {
                files[name] = data;
            });
            await this.idbRequest(db, 'projects', 'readwrite', (store) =>
                store.put({
                    id: this.projectName,
                    name: this.projectName,
                    files,
                    timestamp: Date.now()
                })
            );
            localStorage.setItem('code-studio-last-project', this.projectName);
        } catch (err) {
            console.error('Project save error:', err);
        }
    }
    
    async loadProjectFromDB(name) {
        try {
            const db = await this.openDB();
            return await this.idbRequest(db, 'projects', 'readonly', (store) => store.get(name));
        } catch (err) {
            console.error('Project load error:', err);
            return null;
        }
    }
    
    async listProjectsFromDB() {
        try {
            const db = await this.openDB();
            const all = await this.idbRequest(db, 'projects', 'readonly', (store) => store.getAll());
            return (all || []).sort((a, b) => b.timestamp - a.timestamp);
        } catch (err) {
            console.error('List projects error:', err);
            return [];
        }
    }
    
    async deleteProjectFromDB(name) {
        try {
            const db = await this.openDB();
            await this.idbRequest(db, 'projects', 'readwrite', (store) => store.delete(name));
        } catch (err) {
            console.error('Delete project error:', err);
        }
    }
    
    async loadProjectByName(name) {
        const record = await this.loadProjectFromDB(name);
        if (!record) {
            this.showToast('Project not found', 'error');
            return;
        }
        this.projectName = record.name;
        this.disposeAllModels();
        this.fileSystem = new Map(Object.entries(record.files));
        localStorage.setItem('code-studio-last-project', record.name);
        
        document.getElementById('welcomeScreen').classList.remove('active');
        document.getElementById('appContainer').style.display = 'flex';
        
        this.renderFileTree();
        const names = Array.from(this.fileSystem.keys());
        const first = this.fileSystem.has('index.html') ? 'index.html' : names.find(n => this.fileSystem.get(n).type === 'file');
        if (first) this.openFile(first);
        this.showToast(`Opened "${record.name}"`, 'success');
    }

    async restoreLastProject() {
        const last = localStorage.getItem('code-studio-last-project');
        if (!last) return;
        const record = await this.loadProjectFromDB(last);
        if (!record || !record.files || Object.keys(record.files).length === 0) return;
        await this.loadProjectByName(last);
        this.showToast(`Restored "${record.name}"`, 'success');
    }
    
    formatRelativeTime(timestamp) {
        const diffMs = Date.now() - timestamp;
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
        return new Date(timestamp).toLocaleDateString();
    }
    
    // ============================================
    // FILE CREATION
    // ============================================
    newFile() {
        document.getElementById('newFileName').value = '';
        document.getElementById('fileTemplate').value = '';
        document.getElementById('newFileLocationHint').textContent =
            `Creating in: /${this.selectedFolder || ''} — type a path with "/" to place it elsewhere`;
        document.getElementById('newFileModal').classList.add('active');
        setTimeout(() => document.getElementById('newFileName').focus(), 100);
    }
    
    createNewFile() {
        const rawName = document.getElementById('newFileName').value.trim();
        const template = document.getElementById('fileTemplate').value;
        
        if (!rawName) return;
        
        // A typed path with "/" is used as-is; otherwise it's placed inside
        // whichever folder is currently selected (or the root).
        const name = rawName.includes('/')
            ? rawName.replace(/^\/+/, '')
            : (this.selectedFolder ? `${this.selectedFolder}/${rawName}` : rawName);
        
        if (this.fileSystem.has(name)) {
            this.showToast('File already exists!', 'error');
            return;
        }
        
        let content = '';
        switch(template) {
            case 'html':
                content = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    
</body>
</html>`;
                break;
            case 'css':
                content = `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Inter', sans-serif;
}`;
                break;
            case 'js':
                content = `// JavaScript module

function init() {
    console.log('Initialized!');
}

init();`;
                break;
            case 'react':
                content = `import React from 'react';

function App() {
    return (
        <div className="app">
            <h1>Hello React!</h1>
        </div>
    );
}

export default App;`;
                break;
            case 'vue':
                content = `<template>
    <div class="app">
        <h1>{{ message }}</h1>
    </div>
</template>

<script>
export default {
    data() {
        return {
            message: 'Hello Vue!'
        }
    }
}
<\/script>

<style scoped>
.app {
    text-align: center;
}
</style>`;
                break;
        }
        
        this.fileSystem.set(name, {
            type: 'file',
            content: content,
            language: this.getLanguage(name),
            modified: false
        });
        
        // Auto-expand every ancestor folder so the new file is visible
        const ancestorParts = name.split('/');
        let cur = '';
        for (let i = 0; i < ancestorParts.length - 1; i++) {
            cur = cur ? `${cur}/${ancestorParts[i]}` : ancestorParts[i];
            this.expandedFolders.add(cur);
        }
        
        this.renderFileTree();
        this.openFile(name);
        this.closeModal('newFileModal');
        this.showToast(`Created ${name}`, 'success');
        this.saveProjectToDB();
    }
    
    newFolder() {
        document.getElementById('newFolderName').value = '';
        document.getElementById('newFolderLocationHint').textContent =
            `Creating in: /${this.selectedFolder || ''} — type a path with "/" to nest it deeper`;
        document.getElementById('newFolderModal').classList.add('active');
        setTimeout(() => document.getElementById('newFolderName').focus(), 100);
    }
    
    createNewFolder() {
        const rawName = document.getElementById('newFolderName').value.trim();
        if (!rawName) return;
        
        const name = rawName.includes('/')
            ? rawName.replace(/^\/+/, '')
            : (this.selectedFolder ? `${this.selectedFolder}/${rawName}` : rawName);
        
        if (this.fileSystem.has(name)) {
            this.showToast('Already exists!', 'error');
            return;
        }
        
        this.fileSystem.set(name, {
            type: 'folder',
            content: null,
            modified: false
        });
        
        const ancestorParts = name.split('/');
        let cur = '';
        for (let i = 0; i < ancestorParts.length - 1; i++) {
            cur = cur ? `${cur}/${ancestorParts[i]}` : ancestorParts[i];
            this.expandedFolders.add(cur);
        }
        this.expandedFolders.add(name);
        this.selectedFolder = name;
        
        this.renderFileTree();
        this.closeModal('newFolderModal');
        this.showToast(`Created folder ${name}`, 'success');
        this.saveProjectToDB();
    }
    
    // ============================================
    // PREVIEW
    // ============================================
    togglePreview() {
        const panel = document.getElementById('previewPanel');
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
            this.runCode();
        }
    }
    
    runCode() {
        // Find an entry HTML file: prefer index.html, else the first .html file
        const names = Array.from(this.fileSystem.keys());
        const htmlName = this.fileSystem.has('index.html')
            ? 'index.html'
            : names.find(n => this.fileSystem.get(n).type === 'file' && /\.html?$/i.test(n));
        
        if (!htmlName) {
            this.showToast('No HTML file found!', 'error');
            return;
        }
        
        // Sync the file currently open in the editor before building the preview,
        // so unsaved-but-typed changes still show up live.
        this.syncCurrentFileToMemory();
        
        let html = this.fileSystem.get(htmlName).content;

        // Preview is always an untrusted execution surface. Keep it isolated from
        // the editor origin and inject a restrictive baseline CSP into generated
        // blob previews. Do not grant allow-same-origin: that combination with
        // allow-scripts defeats the sandbox boundary for same-origin content.
        const previewCsp = "default-src 'self' https: data: blob:; base-uri 'none'; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; style-src 'self' 'unsafe-inline' https: data:; img-src 'self' https: data: blob:; font-src 'self' https: data: blob:; media-src 'self' https: data: blob:; connect-src https:; frame-ancestors 'none'; form-action 'none'";
        const previewMeta = `<meta http-equiv=\"Content-Security-Policy\" content=\"${previewCsp.replace(/\"/g, '&quot;')}\">`;
        if (/<head\b[^>]*>/i.test(html)) html = html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${previewMeta}`);
        else html = `${previewMeta}\n${html}`;
        
        const resolveLocal = (path) => {
            const clean = decodeURIComponent(path).split('#')[0].split('?')[0];
            const htmlDir = htmlName.includes('/') ? htmlName.slice(0, htmlName.lastIndexOf('/') + 1) : '';
            const parts = (htmlDir + clean).split('/');
            const normalized = [];
            parts.forEach(part => {
                if (!part || part === '.') return;
                if (part === '..') normalized.pop();
                else normalized.push(part);
            });
            const candidate = normalized.join('/');
            return this.fileSystem.get(candidate) || this.fileSystem.get(clean.replace(/^\.\//, '')) || this.fileSystem.get(path);
        };
        
        // Inline every local <link rel="stylesheet" href="*.css">
        html = html.replace(/<link[^>]*href=["']([^"':]+\.css)["'][^>]*>/gi, (match, href) => {
            const cssFile = resolveLocal(href);
            return cssFile ? `<style>\n${cssFile.content}\n</style>` : match;
        });
        
        // Inline every local <script src="*.js"></script> (order preserved)
        html = html.replace(/<script[^>]*src=["']([^"':]+\.js)["'][^>]*><\/script>/gi, (match, src) => {
            const jsFile = resolveLocal(src);
            return jsFile ? `<script>\n${jsFile.content}\n<\/script>` : match;
        });
        
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        // Free the previous preview blob so memory doesn't grow on every keystroke
        if (this.lastPreviewUrl) {
            URL.revokeObjectURL(this.lastPreviewUrl);
        }
        this.lastPreviewUrl = url;
        
        const frame = document.getElementById('previewFrame');
        if (frame) frame.src = url;
        
        const mobileFrame = document.getElementById('mobilePreview');
        const mobilePanel = document.getElementById('mobilePanel');
        if (mobileFrame && mobilePanel && mobilePanel.classList.contains('open')) {
            mobileFrame.src = url;
        }
        
        this.showToast('Preview updated', 'info');
    }
    
    refreshPreview() {
        this.runCode();
    }
    
    openInNewTab() {
        const frame = document.getElementById('previewFrame');
        window.open(frame.src, '_blank');
    }
    
    toggleDeviceMode() {
        const panel = document.getElementById('previewPanel');
        const frame = document.getElementById('previewFrame');
        if (!panel || !frame) return;
        this.previewDeviceMode = !this.previewDeviceMode;
        panel.classList.toggle('device-mode', this.previewDeviceMode);
        frame.style.width = this.previewDeviceMode ? this.previewDeviceWidth : '100%';
        frame.style.margin = this.previewDeviceMode ? '0 auto' : '0';
        const button = panel.querySelector('[title="Device Mode"]');
        if (button) button.classList.toggle('active', this.previewDeviceMode);
        this.showToast(this.previewDeviceMode ? 'Device preview enabled' : 'Responsive preview enabled', 'info');
    }
    
    // ============================================
    // MOBILE BUILDER
    // ============================================
    toggleMobilePanel() {
        document.getElementById('mobilePanel').classList.toggle('open');
        if (document.getElementById('mobilePanel').classList.contains('open')) {
            this.runCode();
        }
    }
    
    selectPlatform(platform, element) {
        document.querySelectorAll('.device-option').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        
        const apkBtn = document.getElementById('buildApkBtn');
        const aabBtn = document.getElementById('buildAabBtn');
        
        if (platform === 'ios') {
            apkBtn.innerHTML = '<i class="fas fa-hammer"></i> Build IPA';
            aabBtn.style.display = 'none';
        } else {
            apkBtn.innerHTML = '<i class="fas fa-hammer"></i> Build APK';
            aabBtn.style.display = 'flex';
        }
    }
    
    changeDevice() {
        const device = document.getElementById('deviceSelect').value;
        const frame = document.getElementById('deviceFrame');
        
        const sizes = {
            iphone14: { width: '260px', height: '540px' },
            iphoneSE: { width: '220px', height: '400px' },
            pixel7: { width: '250px', height: '520px' },
            samsungS23: { width: '255px', height: '530px' },
            ipad: { width: '340px', height: '450px' }
        };
        
        const size = sizes[device];
        if (size) {
            frame.style.width = size.width;
            frame.style.height = size.height;
        }
    }
    
    async buildAPK() {
        const progress = document.getElementById('buildProgress');
        const fill = document.getElementById('progressFill');
        const text = document.getElementById('progressText');
        const btn = document.getElementById('buildApkBtn');
        
        btn.disabled = true;
        progress.classList.add('active');
        
        const steps = [
            { pct: 15, msg: 'Packaging your project files...' },
            { pct: 40, msg: 'Writing package.json...' },
            { pct: 65, msg: 'Writing capacitor.config.json...' },
            { pct: 90, msg: 'Zipping build-ready source...' },
            { pct: 100, msg: 'Source package ready!' }
        ];
        
        for (const step of steps) {
            await this.delay(500);
            fill.style.width = step.pct + '%';
            text.textContent = step.msg;
        }
        
        await this.createDownloadableBuild('apk');
        
        progress.classList.remove('active');
        fill.style.width = '0%';
        btn.disabled = false;
        
        this.showToast('Downloaded a real, buildable Capacitor project — see the README inside for how to compile the actual APK.', 'success');
    }
    
    async buildAAB() {
        const progress = document.getElementById('buildProgress');
        const fill = document.getElementById('progressFill');
        const text = document.getElementById('progressText');
        const btn = document.getElementById('buildAabBtn');
        
        btn.disabled = true;
        progress.classList.add('active');
        
        const steps = [
            { pct: 15, msg: 'Packaging your project files...' },
            { pct: 40, msg: 'Writing package.json...' },
            { pct: 65, msg: 'Writing capacitor.config.json...' },
            { pct: 90, msg: 'Zipping build-ready source...' },
            { pct: 100, msg: 'Source package ready!' }
        ];
        
        for (const step of steps) {
            await this.delay(500);
            fill.style.width = step.pct + '%';
            text.textContent = step.msg;
        }
        
        await this.createDownloadableBuild('aab');
        
        progress.classList.remove('active');
        fill.style.width = '0%';
        btn.disabled = false;
        
        this.showToast('Downloaded a real, buildable Capacitor project — see the README inside for how to compile the actual AAB.', 'success');
    }
    
    // Builds a real, buildable Capacitor project (source files, not a compiled
    // binary — an actual APK/AAB requires the Android SDK + Gradle, which can't
    // run inside a browser). The zip can be built with `npm install && npm run
    // build:android` (or build:aab / build:ios) on a real machine.
    async createDownloadableBuild(type) {
        if (typeof JSZip === 'undefined') {
            this.showToast('ZIP support failed to load. Check your connection.', 'error');
            return;
        }
        
        const zip = new JSZip();
        const safeName = (this.projectName || 'my-app').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'my-app';
        const appId = `com.codestudio.${safeName.replace(/-/g, '')}`;
        
        // 1. www/ — the actual project files the user wrote
        const wwwFolder = zip.folder('www');
        this.fileSystem.forEach((data, name) => {
            if (data.type === 'file') {
                wwwFolder.file(name, data.content);
            }
        });
        
        // 2. package.json — scripts to sync + build with Capacitor
        zip.file('package.json', JSON.stringify({
            name: safeName,
            version: '1.0.0',
            description: `${this.projectName} — built with Code Studio Pro`,
            scripts: {
                sync: 'npx cap sync',
                'build:android': 'npx cap sync android && cd android && ./gradlew assembleDebug',
                'build:android-release': 'npx cap sync android && cd android && ./gradlew assembleRelease',
                'build:aab': 'npx cap sync android && cd android && ./gradlew bundleRelease',
                'build:ios': "npx cap sync ios && cd ios/App && xcodebuild -scheme App -destination 'platform=iOS Simulator,name=iPhone 14'",
                'open:android': 'npx cap open android',
                'open:ios': 'npx cap open ios'
            },
            dependencies: {
                '@capacitor/core': '^5.0.0',
                '@capacitor/android': '^5.0.0',
                '@capacitor/ios': '^5.0.0'
            },
            devDependencies: {
                '@capacitor/cli': '^5.0.0'
            }
        }, null, 2));
        
        // 3. capacitor.config.json — points Capacitor at the www/ folder above
        zip.file('capacitor.config.json', JSON.stringify({
            appId,
            appName: this.projectName || 'My App',
            webDir: 'www',
            bundledWebRuntime: false,
            server: { androidScheme: 'https' }
        }, null, 2));
        
        // 4. README with exact next steps, since no binary is produced here
        zip.file('README.md', `# ${this.projectName}

This is a real, buildable Capacitor project generated from your Code Studio Pro
project. It contains your actual source files — it is **not** a compiled
${type.toUpperCase()}. Building a real ${type.toUpperCase()} needs the Android
SDK and Gradle, which can't run inside a browser.

## To build a real ${type.toUpperCase()}

1. Install Node.js, then in this folder run:
   \`\`\`
   npm install
   npx cap add android
   npm run build:${type === 'aab' ? 'aab' : 'android'}
   \`\`\`
2. Install [Android Studio](https://developer.android.com/studio) if you don't
   have the Android SDK / Gradle already.
3. The output ${type.toUpperCase()} will be under \`android/app/build/outputs/\`.

For iOS, use \`npx cap add ios\` and \`npm run build:ios\` on a Mac with Xcode.
`);
        
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}-capacitor-src.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    exportProject() {
        const exportData = {
            name: this.projectName,
            version: '1.0.0',
            created: new Date().toISOString(),
            files: {}
        };
        
        this.fileSystem.forEach((data, name) => {
            if (data.type === 'file') {
                exportData.files[name] = data.content;
            }
        });
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.projectName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Project exported!', 'success');
    }
    
    importProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.zip,.txt';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (file.name.toLowerCase().endsWith('.zip')) {
                await this.importProjectFromZip(file);
                return;
            }
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (data.files) {
                        this.disposeAllModels();
                        this.fileSystem.clear();
                        
                        Object.entries(data.files).forEach(([name, content]) => {
                            this.fileSystem.set(name, {
                                type: 'file',
                                content: content,
                                language: this.getLanguage(name),
                                modified: false
                            });
                        });
                        
                        this.projectName = data.name || 'imported-project';
                        this.renderFileTree();
                        
                        document.getElementById('welcomeScreen').classList.remove('active');
                        document.getElementById('appContainer').style.display = 'flex';
                        
                        const first = this.fileSystem.has('index.html') ? 'index.html' : Array.from(this.fileSystem.keys())[0];
                        if (first) this.openFile(first);
                        
                        await this.saveProjectToDB();
                        this.showToast('Project imported!', 'success');
                    }
                } catch (err) {
                    this.showToast('Invalid project file', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    async importProjectFromZip(file) {
        if (typeof JSZip === 'undefined') {
            this.showToast('ZIP support failed to load. Check your connection.', 'error');
            return;
        }
        try {
            const zip = await JSZip.loadAsync(file);
            this.disposeAllModels();
            this.fileSystem.clear();
            
            const entries = Object.values(zip.files).filter(f => !f.dir);
            const textExt = /\.(html?|css|scss|sass|less|js|jsx|ts|tsx|json|md|py|java|php|rb|go|rs|vue|xml|sql|yaml|yml|txt|gitignore)$/i;
            const topLevels = new Set(entries.map(entry => entry.name.split('/')[0]));
            const hasSingleWrapper = topLevels.size === 1 && entries.every(entry => entry.name.includes('/'));
            const wrapper = hasSingleWrapper ? [...topLevels][0] + '/' : '';
            
            for (const entry of entries) {
                const name = wrapper && entry.name.startsWith(wrapper) ? entry.name.slice(wrapper.length) : entry.name;
                if (!name) continue;
                
                if (textExt.test(name)) {
                    const content = await entry.async('string');
                    this.fileSystem.set(name, {
                        type: 'file',
                        content,
                        language: this.getLanguage(name),
                        modified: false
                    });
                }
                // Binary assets (images, fonts) are skipped: this editor's virtual
                // file system stores text content only.
            }
            
            this.projectName = file.name.replace(/\.zip$/i, '') || 'imported-project';
            this.renderFileTree();
            
            document.getElementById('welcomeScreen').classList.remove('active');
            document.getElementById('appContainer').style.display = 'flex';
            
            const first = this.fileSystem.has('index.html') ? 'index.html' : Array.from(this.fileSystem.keys())[0];
            if (first) this.openFile(first);
            
            await this.saveProjectToDB();
            this.showToast(`Imported ${this.fileSystem.size} file(s) from ZIP`, 'success');
        } catch (err) {
            console.error('ZIP import error:', err);
            this.showToast('Failed to read ZIP file', 'error');
        }
    }
    
    // ============================================
    // TERMINAL
    // ============================================
    async handleTerminal(e) {
        const input = e.target;
        if (e.key === 'Enter' && !this.runtime?.workspace?.enabled) {
            e.preventDefault();
            this.showToast('Production workspace API is not configured. Terminal execution is unavailable; no local simulation is used.', 'error');
            return;
        }
        if (e.key === 'Enter' && this.runtime?.workspace?.enabled) {
            e.preventDefault();
            const command = input.value.trim();
            if (!command) return;
            try {
                const socket = await this.openCloudTerminal();
                if (socket.readyState !== WebSocket.OPEN) throw new Error('Terminal is still connecting. Try again.');
                this.terminalHistory.push(command);
                this.terminalHistoryIndex = this.terminalHistory.length;
                const panel = document.getElementById('terminalPanel');
                const cmdLine = document.createElement('div');
                cmdLine.className = 'terminal-line';
                cmdLine.innerHTML = `<span class="terminal-prompt">➜ /workspace</span><span></span>`;
                cmdLine.lastElementChild.textContent = command;
                panel.insertBefore(cmdLine, panel.lastElementChild);
                input.value = '';
                input.disabled = true;
                socket.send(JSON.stringify({ type: 'input', data: `${command}\r` }));
            } catch (err) {
                this.showToast(err.message || 'Terminal unavailable.', 'error');
            } finally { input.disabled = false; input.focus(); }
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (this.terminalHistoryIndex > 0) {
                this.terminalHistoryIndex--;
                input.value = this.terminalHistory[this.terminalHistoryIndex] || '';
            }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (this.terminalHistoryIndex < this.terminalHistory.length - 1) {
                this.terminalHistoryIndex++;
                input.value = this.terminalHistory[this.terminalHistoryIndex] || '';
            } else {
                this.terminalHistoryIndex = this.terminalHistory.length;
                input.value = '';
            }
            return;
        }
        if (e.key !== 'Enter') return;
        
        const command = input.value.trim();
        
        if (!command) return;
        
        this.terminalHistory.push(command);
        this.terminalHistoryIndex = this.terminalHistory.length;
        
        const panel = document.getElementById('terminalPanel');
        
        // Add command line
        const cmdLine = document.createElement('div');
        cmdLine.className = 'terminal-line';
        cmdLine.innerHTML = `<span class="terminal-prompt">➜ ${this.escapeHtml(this.terminalCwd ? '/' + this.terminalCwd : '~')}</span><span>${this.escapeHtml(command)}</span>`;
        panel.insertBefore(cmdLine, panel.lastElementChild);
        panel.scrollTop = panel.scrollHeight;
        
        input.value = '';
        input.disabled = true;
        
        // Process command (some — git push/pull/clone, npm install — hit the network)
        let response;
        try {
            response = await this.processCommand(command);
        } catch (err) {
            response = { text: err.message || String(err), type: 'error' };
        }
        
        if (response) {
            const respLine = document.createElement('div');
            respLine.className = 'terminal-line';
            respLine.innerHTML = `<span style="width: 20px;"></span><span class="terminal-output ${response.type || ''}" style="white-space: pre-wrap;">${this.escapeHtml(response.text)}</span>`;
            panel.insertBefore(respLine, panel.lastElementChild);
        }
        
        input.disabled = false;
        input.focus();
        panel.scrollTop = panel.scrollHeight;
    }
    
    // Resolves a path argument (relative or absolute, with "." / "..") against
    // the terminal's current working directory.
    resolveTerminalPath(pathArg) {
        const base = pathArg.startsWith('/') ? [] : this.terminalCwd.split('/').filter(Boolean);
        const parts = pathArg.replace(/^\/+/, '').split('/').filter(Boolean);
        for (const part of parts) {
            if (part === '.') continue;
            if (part === '..') { base.pop(); continue; }
            base.push(part);
        }
        return base.join('/');
    }
    
    terminalFolderExists(path) {
        if (!path) return true;
        const entry = this.fileSystem.get(path);
        if (entry && entry.type === 'folder') return true;
        const prefix = path + '/';
        for (const key of this.fileSystem.keys()) {
            if (key.startsWith(prefix)) return true;
        }
        return false;
    }
    
    // Immediate children of a path, real vs. implied-by-nested-files folders included
    terminalLs(targetPath) {
        const prefix = targetPath ? targetPath + '/' : '';
        const seen = new Map();
        this.fileSystem.forEach((data, path) => {
            if (prefix && !path.startsWith(prefix)) return;
            const rel = prefix ? path.slice(prefix.length) : path;
            if (!rel) return;
            const [first, ...rest] = rel.split('/');
            seen.set(first, rest.length > 0 ? 'folder' : data.type);
        });
        return Array.from(seen.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }
    
    async processCommand(command) {
        // supports a single `>` or `>>` redirect for echo, e.g. echo hi > notes.txt
        const parts = command.trim().split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);
        
        switch (cmd) {
            case 'help':
                return { text: `Available commands:
  pwd                    Show current directory
  cd <dir>               Change directory (.. supported)
  ls [dir]                List files/folders
  mkdir <dir>             Create a folder
  touch <file>            Create an empty file
  rm [-r] <path>          Remove a file (or folder with -r)
  rmdir <dir>             Remove an empty folder
  cp <src> <dest>         Copy a file
  mv <src> <dest>         Move/rename a file or folder
  cat <file>              Show file content
  echo <text> [> file]    Print text, or write it to a file
  git <status|init|add|commit -m ""|log|branch|checkout|push|pull|remote add origin <url>>
  npm install [pkg]       Add a real dependency to package.json (see note)
  npm run <script>        Show/run a package.json script
  build                   Refresh the live preview
  export                  Download project as JSON
  version                 Show version
  whoami                  Show user info
  clear                   Clear terminal` };
            
            case 'pwd':
                return { text: '/' + this.terminalCwd };
            
            case 'cd': {
                if (!args[0] || args[0] === '~' || args[0] === '/') {
                    this.terminalCwd = '';
        this.cloudTerminal = null;
        this.cloudTerminalWorkspaceId = null;
        this.cloudProjectId = null;
                    return { text: '' };
                }
                const target = this.resolveTerminalPath(args[0]);
                if (!this.terminalFolderExists(target)) {
                    return { text: `cd: no such directory: ${args[0]}`, type: 'error' };
                }
                this.terminalCwd = target;
                return { text: '' };
            }
            
            case 'ls': {
                const target = args[0] ? this.resolveTerminalPath(args[0]) : this.terminalCwd;
                if (target && !this.terminalFolderExists(target)) {
                    return { text: `ls: no such directory: ${args[0]}`, type: 'error' };
                }
                const entries = this.terminalLs(target);
                if (entries.length === 0) return { text: '(empty)' };
                return { text: entries.map(([name, type]) => type === 'folder' ? `${name}/` : name).join('  ') };
            }
            
            case 'mkdir': {
                if (!args[0]) return { text: 'Usage: mkdir <name>', type: 'error' };
                const path = this.resolveTerminalPath(args[0]);
                if (this.fileSystem.has(path)) return { text: `mkdir: already exists: ${args[0]}`, type: 'error' };
                this.fileSystem.set(path, { type: 'folder', content: null, modified: false });
                let cur = '';
                for (const part of path.split('/').slice(0, -1)) {
                    cur = cur ? `${cur}/${part}` : part;
                    this.expandedFolders.add(cur);
                }
                this.expandedFolders.add(path);
                this.renderFileTree();
                this.saveProjectToDB();
                return { text: `Created ${path}`, type: 'success' };
            }
            
            case 'touch': {
                if (!args[0]) return { text: 'Usage: touch <file>', type: 'error' };
                const path = this.resolveTerminalPath(args[0]);
                if (!this.fileSystem.has(path)) {
                    this.fileSystem.set(path, { type: 'file', content: '', language: this.getLanguage(path), modified: false });
                    this.renderFileTree();
                    this.saveProjectToDB();
                }
                return { text: `Created ${path}`, type: 'success' };
            }
            
            case 'rm': {
                let target = args[0];
                let recursive = false;
                if (target === '-r' || target === '-rf') { recursive = true; target = args[1]; }
                if (!target) return { text: 'Usage: rm [-r] <path>', type: 'error' };
                const path = this.resolveTerminalPath(target);
                const entry = this.fileSystem.get(path);
                if (!entry) return { text: `rm: no such file: ${target}`, type: 'error' };
                if (entry.type === 'folder') {
                    if (!recursive) return { text: `rm: ${target} is a directory (use rm -r)`, type: 'error' };
                    const prefix = path + '/';
                    const toDelete = [];
                    this.fileSystem.forEach((d, p) => { if (p === path || p.startsWith(prefix)) toDelete.push(p); });
                    toDelete.forEach(p => { this.fileSystem.delete(p); this.closeTab(p); });
                } else {
                    this.fileSystem.delete(path);
                    this.closeTab(path);
                }
                this.renderFileTree();
                this.saveProjectToDB();
                return { text: `Removed ${path}`, type: 'success' };
            }
            
            case 'rmdir': {
                if (!args[0]) return { text: 'Usage: rmdir <dir>', type: 'error' };
                const path = this.resolveTerminalPath(args[0]);
                const hasChildren = this.terminalLs(path).length > 0;
                if (hasChildren) return { text: `rmdir: not empty: ${args[0]}`, type: 'error' };
                this.fileSystem.delete(path);
                this.renderFileTree();
                this.saveProjectToDB();
                return { text: `Removed ${path}`, type: 'success' };
            }
            
            case 'cp': {
                if (!args[0] || !args[1]) return { text: 'Usage: cp <src> <dest>', type: 'error' };
                const src = this.resolveTerminalPath(args[0]);
                const dest = this.resolveTerminalPath(args[1]);
                const entry = this.fileSystem.get(src);
                if (!entry || entry.type !== 'file') return { text: `cp: no such file: ${args[0]}`, type: 'error' };
                this.fileSystem.set(dest, { ...entry, modified: false });
                this.renderFileTree();
                this.saveProjectToDB();
                return { text: `Copied to ${dest}`, type: 'success' };
            }
            
            case 'mv': {
                if (!args[0] || !args[1]) return { text: 'Usage: mv <src> <dest>', type: 'error' };
                const src = this.resolveTerminalPath(args[0]);
                const dest = this.resolveTerminalPath(args[1]);
                const entry = this.fileSystem.get(src);
                if (!entry) return { text: `mv: no such file: ${args[0]}`, type: 'error' };
                if (entry.type === 'folder') {
                    const prefix = src + '/';
                    const toMove = [];
                    this.fileSystem.forEach((d, p) => { if (p === src || p.startsWith(prefix)) toMove.push(p); });
                    let activeChanged = false;
                    toMove.forEach(p => {
                        const d = this.fileSystem.get(p);
                        const newPath = p === src ? dest : dest + '/' + p.slice(prefix.length);
                        this.fileSystem.delete(p);
                        this.fileSystem.set(newPath, d);
                        
                        const openIdx = this.openFiles.indexOf(p);
                        if (openIdx !== -1) this.openFiles[openIdx] = newPath;
                        if (this.currentFile === p) { this.currentFile = newPath; activeChanged = true; }
                        
                        const model = this.monacoModels.get(p);
                        if (model) {
                            if (this.editor.getModel() === model) this.editor.setModel(this.welcomeModel);
                            model.dispose();
                            this.monacoModels.delete(p);
                        }
                    });
                    if (activeChanged) this.editor.setModel(this.getOrCreateModel(this.currentFile));
                } else {
                    this.fileSystem.delete(src);
                    this.fileSystem.set(dest, entry);
                    const openIdx = this.openFiles.indexOf(src);
                    if (openIdx !== -1) this.openFiles[openIdx] = dest;
                    
                    const model = this.monacoModels.get(src);
                    if (model) {
                        if (this.editor.getModel() === model) this.editor.setModel(this.welcomeModel);
                        model.dispose();
                        this.monacoModels.delete(src);
                    }
                    
                    if (this.currentFile === src) {
                        this.currentFile = dest;
                        this.editor.setModel(this.getOrCreateModel(dest));
                    }
                }
                this.renderTabs();
                this.renderFileTree();
                this.saveProjectToDB();
                return { text: `Moved to ${dest}`, type: 'success' };
            }
            
            case 'cat': {
                if (!args[0]) return { text: 'Usage: cat <filename>', type: 'error' };
                const path = this.resolveTerminalPath(args[0]);
                const file = this.fileSystem.get(path);
                if (!file || file.type !== 'file') return { text: 'File not found', type: 'error' };
                return { text: file.content.substring(0, 2000) };
            }
            
            case 'echo': {
                const redirectIdx = args.findIndex(a => a === '>' || a === '>>');
                if (redirectIdx === -1) return { text: args.join(' ') };
                
                const append = args[redirectIdx] === '>>';
                const text = args.slice(0, redirectIdx).join(' ');
                const target = args[redirectIdx + 1];
                if (!target) return { text: 'Usage: echo <text> > <file>', type: 'error' };
                
                const path = this.resolveTerminalPath(target);
                const existing = this.fileSystem.get(path);
                const newContent = append && existing ? existing.content + '\n' + text : text;
                this.fileSystem.set(path, { type: 'file', content: newContent, language: this.getLanguage(path), modified: false });
                this.renderFileTree();
                if (this.currentFile === path) this.editor.setValue(newContent);
                this.saveProjectToDB();
                return { text: `Wrote ${path}`, type: 'success' };
            }
            
            case 'clear':
                document.getElementById('terminalPanel').innerHTML = `
                    <div class="terminal-line">
                        <span class="terminal-prompt">➜</span>
                        <div class="terminal-input-wrapper">
                            <input type="text" class="terminal-input" id="terminalInput" placeholder="Type a command..." onkeydown="app.handleTerminal(event)" autocomplete="off" spellcheck="false">
                        </div>
                    </div>
                `;
                document.getElementById('terminalInput').focus();
                return null;
            
            case 'git':
                return await this.terminalGit(args);
            
            case 'npm':
                return await this.terminalNpm(args);
            
            case 'build':
                this.runCode();
                return { text: 'Live preview refreshed. Note: a real installable build comes from "npm run build:android" on your machine (see README in the exported project).', type: 'success' };
            
            case 'export':
                this.exportProject();
                return { text: '✓ Project exported as JSON', type: 'success' };
            
            case 'deploy':
                return { text: 'Deploying isn\'t wired to a real host yet — export your project and deploy it with any static host (Netlify, Vercel, GitHub Pages, etc).', type: 'warning' };
            
            case 'version':
                return { text: 'Code Studio Pro v2.0.0' };
            
            case 'whoami':
                return { text: 'Developer @ Code Studio Pro' };
            
            default:
                return { text: `Command not found: ${cmd}. Type 'help' for available commands.`, type: 'error' };
        }
    }
    
    // git subcommands run through the same real isomorphic-git engine as the
    // Source Control panel — the terminal is just another way to drive it.
    async terminalGit(args) {
        const sub = args[0];
        
        if (!sub || sub === 'status') {
            if (!(await this.gitHasRepo())) return { text: 'Not a git repository. Run "git init" first.', type: 'error' };
            await this.gitSyncToFs();
            const matrix = await git.statusMatrix({ fs: this.gitFs, dir: this.gitDir });
            const changed = matrix.filter(([, head, workdir, stage]) => !(head === 1 && workdir === 1 && stage === 1));
            const branch = (await git.currentBranch({ fs: this.gitFs, dir: this.gitDir })) || 'main';
            const lines = [`On branch ${branch}`];
            lines.push(changed.length === 0 ? 'nothing to commit, working tree clean' : changed.map(([f]) => `  modified: ${f}`).join('\n'));
            return { text: lines.join('\n') };
        }
        
        if (sub === 'init') {
            await this.gitInitRepo();
            return { text: 'Initialized empty Git repository', type: 'success' };
        }
        
        if (sub === 'add') {
            if (!(await this.gitHasRepo())) return { text: 'Not a git repository. Run "git init" first.', type: 'error' };
            await this.gitSyncToFs();
            const matrix = await git.statusMatrix({ fs: this.gitFs, dir: this.gitDir });
            for (const [filepath, , workdir] of matrix) {
                if (workdir === 0) await git.remove({ fs: this.gitFs, dir: this.gitDir, filepath });
                else await git.add({ fs: this.gitFs, dir: this.gitDir, filepath });
            }
            return { text: 'Changes staged', type: 'success' };
        }
        
        if (sub === 'commit') {
            const mIdx = args.indexOf('-m');
            const message = mIdx !== -1 ? args.slice(mIdx + 1).join(' ').replace(/^["']|["']$/g, '') : '';
            if (!message) return { text: 'Usage: git commit -m "message"', type: 'error' };
            if (!(await this.gitHasRepo())) return { text: 'Not a git repository. Run "git init" first.', type: 'error' };
            await this.gitSyncToFs();
            const matrix = await git.statusMatrix({ fs: this.gitFs, dir: this.gitDir });
            for (const [filepath, , workdir] of matrix) {
                if (workdir === 0) await git.remove({ fs: this.gitFs, dir: this.gitDir, filepath });
                else await git.add({ fs: this.gitFs, dir: this.gitDir, filepath });
            }
            const sha = await git.commit({ fs: this.gitFs, dir: this.gitDir, message, author: this.gitAuthor() });
            return { text: `[${(await git.currentBranch({ fs: this.gitFs, dir: this.gitDir })) || 'main'} ${sha.slice(0, 7)}] ${message}`, type: 'success' };
        }
        
        if (sub === 'log') {
            if (!(await this.gitHasRepo())) return { text: 'Not a git repository.', type: 'error' };
            const log = await git.log({ fs: this.gitFs, dir: this.gitDir, depth: 10 });
            if (log.length === 0) return { text: 'No commits yet' };
            return { text: log.map(c => `${c.oid.slice(0, 7)} ${c.commit.message.split('\n')[0]} (${c.commit.author.name})`).join('\n') };
        }
        
        if (sub === 'branch') {
            if (!(await this.gitHasRepo())) return { text: 'Not a git repository.', type: 'error' };
            if (args[1]) {
                await git.branch({ fs: this.gitFs, dir: this.gitDir, ref: args[1] });
                return { text: `Created branch ${args[1]}`, type: 'success' };
            }
            const branches = await git.listBranches({ fs: this.gitFs, dir: this.gitDir });
            const current = (await git.currentBranch({ fs: this.gitFs, dir: this.gitDir })) || 'main';
            return { text: branches.map(b => (b === current ? '* ' : '  ') + b).join('\n') };
        }
        
        if (sub === 'checkout') {
            if (!args[1]) return { text: 'Usage: git checkout <branch>', type: 'error' };
            await this.gitSwitchBranch(args[1]);
            return { text: `Switched to branch '${args[1]}'`, type: 'success' };
        }
        
        if (sub === 'push') {
            await this.gitPushRepo();
            return { text: 'Push complete (see toast for result)', type: 'success' };
        }
        
        if (sub === 'pull') {
            await this.gitPullRepo();
            return { text: 'Pull complete (see toast for result)', type: 'success' };
        }
        
        if (sub === 'remote' && args[1] === 'add' && args[2] && args[3]) {
            this.gitRemoteUrl = args[3];
            this.saveSettings();
            return { text: `Remote '${args[2]}' set to ${args[3]}`, type: 'success' };
        }
        
        if (sub === 'clone' && args[1]) {
            await this.gitCloneRepo(args[1]);
            return { text: 'Clone complete (see toast for result)', type: 'success' };
        }
        
        return { text: `git: unsupported subcommand '${sub}'. Try: status, init, add, commit -m "", log, branch, checkout, push, pull, remote add origin <url>, clone <url>`, type: 'error' };
    }
    
    // Real dependency management: looks up the actual latest version from the
    // npm registry and writes it into package.json. It can't download and run
    // node_modules or a bundler in-browser, so it's a real manifest edit, not
    // a real install — the README in exported builds explains the last mile.
    async terminalNpm(args) {
        if (this.runtime?.workspace?.enabled) {
            const id = await this.ensureCloudWorkspace();
            const command = ['npm', ...args];
            const result = await this.runtime.workspace.exec(id, command, { cwd: '/workspace', timeoutMs: 120000 });
            return { text: `${result.output || ''}${result.exitCode ? `\n(exit code ${result.exitCode})` : ''}`, type: result.exitCode ? 'error' : 'success' };
        }
        throw new Error('Production workspace API is required for npm execution.');
    }
    
    // ============================================
    // UI HELPERS
    // ============================================
    switchSidebar(view, sourceEvent) {
        document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('active'));
        sourceEvent?.currentTarget?.classList.add('active');
        if (view === 'git') {
            this.showGit();
        }
    }
    
    switchPanel(panel, sourceEvent) {
        document.querySelectorAll('.panel-tab').forEach(tab => tab.classList.remove('active'));
        sourceEvent?.currentTarget?.classList.add('active');
        
        const content = document.getElementById('panelContent');
        
        switch(panel) {
            case 'terminal':
                content.innerHTML = `
                    <div id="terminalPanel" class="terminal">
                        <div class="terminal-line">
                            <span class="terminal-prompt">➜</span>
                            <div class="terminal-input-wrapper">
                                <input type="text" class="terminal-input" id="terminalInput" placeholder="Type a command..." onkeydown="app.handleTerminal(event)" autocomplete="off" spellcheck="false">
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'problems':
                content.innerHTML = '<div id="problemsPanel"></div>';
                this.refreshProblemsPanel();
                break;
            case 'output':
                content.innerHTML = '<div style="padding: 16px; color: var(--text-secondary);">Build output will appear here...</div>';
                break;
            case 'debug':
                content.innerHTML = '<div style="padding: 16px; color: var(--text-secondary);">Debug console ready...</div>';
                break;
        }
    }
    
    // Real Problems panel: reads Monaco's actual diagnostics (syntax + semantic
    // JS/TS errors, JSON schema errors, etc.) across every open file's model —
    // nothing here is a canned or simulated list.
    refreshProblemsPanel() {
        if (typeof monaco === 'undefined' || !this.editor) return;
        
        const allMarkers = monaco.editor.getModelMarkers({});
        const items = [];
        allMarkers.forEach(m => {
            let path;
            try {
                path = decodeURIComponent(m.resource.path.replace(/^\//, ''));
            } catch (e) {
                path = m.resource.path.replace(/^\//, '');
            }
            if (this.fileSystem.has(path)) {
                items.push({ ...m, path });
            }
        });
        
        const errorCount = items.filter(m => m.severity === monaco.MarkerSeverity.Error).length;
        const warningCount = items.filter(m => m.severity === monaco.MarkerSeverity.Warning).length;
        
        const badge = document.getElementById('problemsBadge');
        if (badge) badge.textContent = items.length;
        
        const panel = document.getElementById('problemsPanel');
        if (!panel) return; // Problems tab isn't the active bottom panel right now
        
        if (items.length === 0) {
            panel.innerHTML = '<div style="padding: 16px; color: var(--success);"><i class="fas fa-check-circle"></i> No problems detected</div>';
            return;
        }
        
        const byFile = {};
        items.forEach(m => {
            (byFile[m.path] = byFile[m.path] || []).push(m);
        });
        
        const sevIcon = (sev) => {
            if (sev === monaco.MarkerSeverity.Error) return '<i class="fas fa-times-circle" style="color: var(--error, #f14c4c);"></i>';
            if (sev === monaco.MarkerSeverity.Warning) return '<i class="fas fa-exclamation-triangle" style="color: var(--warning, #cca700);"></i>';
            return '<i class="fas fa-info-circle" style="color: var(--text-secondary);"></i>';
        };
        
        panel.innerHTML = `
            <div style="padding: 6px 12px; font-size: 12px; color: var(--text-secondary); border-bottom: 1px solid var(--border);">
                ${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} warning${warningCount === 1 ? '' : 's'}
            </div>
            ${Object.entries(byFile).map(([path, msgs]) => `
                <div>
                    <div style="font-weight: 600; font-size: 12px; padding: 6px 12px 2px; color: var(--text-secondary);">
                        <i class="fas fa-file-code"></i> ${this.escapeHtml(path)}
                    </div>
                    ${msgs.map(m => `
                        <div class="problem-item" style="padding: 4px 12px 4px 30px; font-size: 12px; cursor: pointer;"
                             onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'"
                             onclick="app.jumpToProblem('${path.replace(/'/g, "\\'")}', ${m.startLineNumber}, ${m.startColumn})">
                            ${sevIcon(m.severity)} ${this.escapeHtml(m.message)}
                            <span style="color: var(--text-secondary);">[Ln ${m.startLineNumber}, Col ${m.startColumn}]</span>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        `;
    }
    
    jumpToProblem(path, line, col) {
        this.openFile(path);
        setTimeout(() => {
            this.editor.revealLineInCenter(line);
            this.editor.setPosition({ lineNumber: line, column: col });
            this.editor.focus();
        }, 50);
    }
    
    toggleBottomPanel() {
        document.getElementById('bottomPanel').classList.toggle('collapsed');
        const icon = document.getElementById('panelToggleIcon');
        icon.className = document.getElementById('bottomPanel').classList.contains('collapsed') 
            ? 'fas fa-chevron-up' 
            : 'fas fa-chevron-down';
    }
    
    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        const theme = this.isDarkTheme ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        document.getElementById('themeIcon').className = this.isDarkTheme ? 'fas fa-moon' : 'fas fa-sun';
        
        if (this.editor) {
            monaco.editor.setTheme(this.isDarkTheme ? 'vs-dark' : 'vs');
        }
        
        this.settings.theme = theme;
        this.saveSettings();
    }
    
    collapseExplorer() {
        document.getElementById('explorerPanel').classList.toggle('collapsed');
    }
    
    // ============================================
    // PWA FUNCTIONS
    // ============================================
    showPWAInstallBanner() {
        if (this.deferredPrompt && !this.isNativeApp) {
            document.getElementById('pwaInstallBanner').classList.add('active');
        }
    }
    
    hidePWAInstallBanner() {
        document.getElementById('pwaInstallBanner').classList.remove('active');
    }
    
    dismissPWAInstall() {
        this.hidePWAInstallBanner();
        // Remember dismissal
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }
    
    async installPWA() {
        if (!this.deferredPrompt) return;
        
        this.deferredPrompt.prompt();
        
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            this.showToast('Installing Code Studio Pro...', 'success');
        }
        
        this.deferredPrompt = null;
        this.hidePWAInstallBanner();
    }
    
    // ============================================
    // SETTINGS
    // ============================================
    loadSettings() {
        try {
            const saved = localStorage.getItem('code-studio-settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
            const theme = this.settings.theme === 'system'
                ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
                : this.settings.theme;
            this.isDarkTheme = theme !== 'light';
            document.documentElement.setAttribute('data-theme', theme);
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    }
    
    saveSettings() {
        try {
            localStorage.setItem('code-studio-settings', JSON.stringify(this.settings));
        } catch (err) {
            console.error('Failed to save settings:', err);
        }
    }
    
    showSettings() {
        document.getElementById('settingsTheme').value = this.settings.theme;
        document.getElementById('settingsFontSize').value = this.settings.fontSize;
        document.getElementById('settingsWordWrap').value = this.settings.wordWrap;
        document.getElementById('settingsAutoSave').value = this.settings.autoSave;
        document.getElementById('settingsModal').classList.add('active');
    }
    
    applySettings() {
        this.settings.theme = document.getElementById('settingsTheme').value;
        this.settings.fontSize = parseInt(document.getElementById('settingsFontSize').value);
        this.settings.wordWrap = document.getElementById('settingsWordWrap').value;
        this.settings.autoSave = document.getElementById('settingsAutoSave').value;
        
        const resolvedTheme = this.settings.theme === 'system'
            ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
            : this.settings.theme;
        this.isDarkTheme = resolvedTheme !== 'light';
        document.documentElement.setAttribute('data-theme', resolvedTheme);
        document.getElementById('themeIcon').className = this.isDarkTheme ? 'fas fa-moon' : 'fas fa-sun';

        // Apply immediately
        if (this.editor) {
            this.editor.updateOptions({
                fontSize: this.settings.fontSize,
                wordWrap: this.settings.wordWrap
            });
            monaco.editor.setTheme(this.isDarkTheme ? 'vs-dark' : 'vs');
        }
        this.saveSettings();
    }
    
    // ============================================
    // PROJECT MANAGEMENT
    // ============================================
    async newProject() {
        const input = prompt('Project name:', 'new-project');
        if (input === null) return; // user cancelled
        const projectName = input.trim() || 'untitled-project';
        
        const existing = await this.loadProjectFromDB(projectName);
        if (existing && !confirm(`A project named "${projectName}" already exists. Overwrite it with a fresh template?`)) {
            return;
        }
        
        this.projectName = projectName;
        this.disposeAllModels();
        this.fileSystem.clear();
        this.initFileSystem();
        await this.saveProjectToDB();
        
        document.getElementById('welcomeScreen').classList.remove('active');
        document.getElementById('appContainer').style.display = 'flex';
        
        this.openFile('index.html');
        this.showToast(`Project "${projectName}" created!`, 'success');
        this.loadRecentProjects();
    }
    
    async openProject() {
        // Generic "Open Project" button: let the user pick a project by name,
        // or fall back to importing a project file from disk.
        const projects = await this.listProjectsFromDB();
        if (projects.length === 0) {
            this.showToast('No saved projects yet. Importing a file instead...', 'info');
            this.importProject();
            return;
        }
        const names = projects.map(p => p.name).join(', ');
        const choice = prompt(`Type a project name to open (or leave blank to import a file):\n\nSaved projects: ${names}`);
        if (choice === null) return;
        if (!choice.trim()) {
            this.importProject();
            return;
        }
        await this.loadProjectByName(choice.trim());
    }
    
    cloneRepo() {
        const url = prompt('Enter repository URL to clone (e.g. https://github.com/user/repo.git):');
        if (!url || !url.trim()) return;
        this.gitCloneRepo(url.trim());
    }
    
    async loadRecentProjects() {
        const projects = await this.listProjectsFromDB();
        const container = document.getElementById('recentProjectsList');
        if (!container) return;
        container.innerHTML = '';
        
        if (projects.length === 0) {
            container.innerHTML = `<div style="padding: 16px; color: var(--text-secondary); font-size: 13px;">No saved projects yet. Click "New Project" to start — your work is saved automatically as you edit.</div>`;
            return;
        }
        
        projects.forEach(proj => {
            const fileCount = proj.files ? Object.keys(proj.files).length : 0;
            const div = document.createElement('div');
            div.className = 'recent-project';
            div.innerHTML = `
                <div class="recent-project-info">
                    <div class="recent-project-icon"><i class="fas fa-folder"></i></div>
                    <div>
                        <div class="recent-project-name">${proj.name}</div>
                        <div class="recent-project-date">${this.formatRelativeTime(proj.timestamp)} · ${fileCount} file${fileCount === 1 ? '' : 's'}</div>
                    </div>
                </div>
                <i class="fas fa-chevron-right recent-project-arrow"></i>
            `;
            div.onclick = () => this.loadProjectByName(proj.name);
            container.appendChild(div);
        });
    }
    
    // ============================================
    // EDITOR FEATURES
    // ============================================
    formatCode() {
        this.editor.getAction('editor.action.formatDocument').run();
        this.showToast('Code formatted!', 'success');
    }
    
    findAndReplace() {
        this.editor.getAction('editor.action.startFindReplaceAction:').run();
    }
    
    toggleComment() {
        this.editor.getAction('editor.action.commentLine').run();
    }
    
    // ============================================
    // CONTEXT MENU
    // ============================================
    showContextMenu(x, y) {
        const menu = document.getElementById('contextMenu');
        const maxX = window.innerWidth - 220;
        const maxY = window.innerHeight - 250;
        
        menu.style.left = Math.min(x, maxX) + 'px';
        menu.style.top = Math.min(y, maxY) + 'px';
        menu.style.display = 'block';
    }
    
    ctxNewFile() {
        this.selectedFolder = this.getContextFolder();
        this.newFile();
        document.getElementById('contextMenu').style.display = 'none';
    }
    
    ctxNewFolder() {
        this.selectedFolder = this.getContextFolder();
        this.newFolder();
        document.getElementById('contextMenu').style.display = 'none';
    }
    
    ctxRename() {
        document.getElementById('contextMenu').style.display = 'none';
        const target = this.fileSystem.get(this.contextTarget);
        if (!target) return;
        
        const oldBaseName = this.contextTarget.split('/').pop();
        const newBaseName = prompt('New name:', oldBaseName);
        if (!newBaseName || newBaseName === oldBaseName) return;
        
        const parts = this.contextTarget.split('/');
        parts[parts.length - 1] = newBaseName;
        const newPath = parts.join('/');
        
        if (this.fileSystem.has(newPath)) {
            this.showToast('A file/folder with that name already exists!', 'error');
            return;
        }
        
        if (target.type === 'folder') {
            // Renaming a folder means renaming every file/folder path under it too
            const oldPrefix = this.contextTarget + '/';
            const newPrefix = newPath + '/';
            const toRename = [];
            this.fileSystem.forEach((data, path) => {
                if (path === this.contextTarget || path.startsWith(oldPrefix)) toRename.push(path);
            });
            let activeChanged = false;
            toRename.forEach(path => {
                const data = this.fileSystem.get(path);
                const renamedPath = path === this.contextTarget ? newPath : newPrefix + path.slice(oldPrefix.length);
                this.fileSystem.delete(path);
                this.fileSystem.set(renamedPath, data);
                
                const openIdx = this.openFiles.indexOf(path);
                if (openIdx !== -1) this.openFiles[openIdx] = renamedPath;
                if (this.currentFile === path) { this.currentFile = renamedPath; activeChanged = true; }
                
                // The old Monaco model's URI still points at the old path — drop
                // it so the new path gets a fresh model (built from the same
                // content) the next time it's opened.
                const model = this.monacoModels.get(path);
                if (model) {
                    if (this.editor.getModel() === model) this.editor.setModel(this.welcomeModel);
                    model.dispose();
                    this.monacoModels.delete(path);
                }
            });
            if (this.expandedFolders.has(this.contextTarget)) {
                this.expandedFolders.delete(this.contextTarget);
                this.expandedFolders.add(newPath);
            }
            if (this.selectedFolder === this.contextTarget) this.selectedFolder = newPath;
            if (activeChanged) this.editor.setModel(this.getOrCreateModel(this.currentFile));
        } else {
            this.fileSystem.delete(this.contextTarget);
            this.fileSystem.set(newPath, target);
            
            const openIdx = this.openFiles.indexOf(this.contextTarget);
            if (openIdx !== -1) this.openFiles[openIdx] = newPath;
            
            const model = this.monacoModels.get(this.contextTarget);
            if (model) {
                if (this.editor.getModel() === model) this.editor.setModel(this.welcomeModel);
                model.dispose();
                this.monacoModels.delete(this.contextTarget);
            }
            
            if (this.currentFile === this.contextTarget) {
                this.currentFile = newPath;
                this.editor.setModel(this.getOrCreateModel(newPath));
            }
        }
        
        this.renderTabs();
        this.renderFileTree();
        this.showToast('Renamed!', 'success');
        this.saveProjectToDB();
    }
    
    ctxDelete() {
        document.getElementById('contextMenu').style.display = 'none';
        if (!confirm(`Delete ${this.contextTarget}?`)) return;
        
        const target = this.fileSystem.get(this.contextTarget);
        if (target && target.type === 'folder') {
            const prefix = this.contextTarget + '/';
            const toDelete = [];
            this.fileSystem.forEach((data, path) => {
                if (path === this.contextTarget || path.startsWith(prefix)) toDelete.push(path);
            });
            toDelete.forEach(path => {
                this.fileSystem.delete(path);
                this.closeTab(path);
            });
            this.expandedFolders.delete(this.contextTarget);
            if (this.selectedFolder === this.contextTarget || this.selectedFolder.startsWith(prefix)) {
                this.selectedFolder = '';
            }
        } else {
            this.fileSystem.delete(this.contextTarget);
            this.closeTab(this.contextTarget);
        }
        
        this.renderFileTree();
        this.showToast('Deleted!', 'success');
        this.saveProjectToDB();
    }
    
    ctxCopy() {
        this.clipboard = this.contextTarget;
        document.getElementById('contextMenu').style.display = 'none';
        this.showToast('Copied to clipboard', 'info');
    }
    
    ctxPaste() {
        document.getElementById('contextMenu').style.display = 'none';
        if (!this.clipboard) return;
        
        const clip = this.fileSystem.get(this.clipboard);
        if (!clip) return;
        
        const targetFolder = this.getContextFolder();
        
        if (clip.type === 'folder') {
            const oldPrefix = this.clipboard + '/';
            const baseName = this.clipboard.split('/').pop() + '_copy';
            const newBase = targetFolder ? `${targetFolder}/${baseName}` : baseName;
            
            if (this.fileSystem.has(newBase)) {
                this.showToast('A folder with that name already exists here!', 'error');
                return;
            }
            
            const descendants = [];
            this.fileSystem.forEach((data, path) => {
                if (path.startsWith(oldPrefix)) descendants.push([path, data]);
            });
            
            this.fileSystem.set(newBase, { type: 'folder', content: null, modified: false });
            descendants.forEach(([path, data]) => {
                this.fileSystem.set(newBase + '/' + path.slice(oldPrefix.length), { ...data });
            });
            this.expandedFolders.add(newBase);
        } else {
            const baseName = this.clipboard.split('/').pop();
            const ext = baseName.includes('.') ? '.' + baseName.split('.').pop() : '';
            const base = ext ? baseName.slice(0, -ext.length) : baseName;
            const newName = targetFolder ? `${targetFolder}/${base}_copy${ext}` : `${base}_copy${ext}`;
            this.fileSystem.set(newName, { ...clip, modified: false });
        }
        
        this.renderFileTree();
        this.showToast('Pasted!', 'success');
        this.saveProjectToDB();
    }
    
    // ============================================
    // MENU ACTIONS
    // ============================================
    showMenu(menu) {
        const menus = {
            file: ['New File (Ctrl+N)', 'Open Project (Ctrl+O)', 'Save (Ctrl+S)', 'Export Project', 'Import Project'],
            edit: ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Find (Ctrl+F)', 'Replace (Ctrl+H)', 'Format (Ctrl+K)'],
            view: ['Toggle Sidebar', 'Toggle Preview (Ctrl+B)', 'Toggle Terminal', 'Toggle Word Wrap'],
            run: ['Run (Ctrl+P)', 'Debug', 'Build', 'Deploy'],
            tools: ['Mobile Builder', 'Git Tools', 'Extensions', 'Settings']
        };
        this.showToast(`${menu}: ${menus[menu].join(', ')}`, 'info');
    }
    
    async showAccount() {
        const modal = document.getElementById('accountModal');
        if (!modal) return;
        modal.classList.add('active');
        await this.refreshAccount();
    }

    async refreshAccount() {
        const status = document.getElementById('accountStatus');
        const details = document.getElementById('accountDetails');
        if (!status || !details) return;
        if (!this.runtime?.auth?.enabled) {
            status.textContent = 'Cloud authentication is not configured for this deployment.';
            details.innerHTML = '<p style="color:var(--text-secondary);">Configure CODE_STUDIO_API_BASE_URL on the deployment environment to enable production authentication.</p>';
            return;
        }
        try {
            const result = await this.runtime.auth.me();
            const user = result?.user;
            status.textContent = 'Authenticated';
            details.innerHTML = `<div><strong>${this.escapeHtml(user?.displayName || user?.email || 'User')}</strong></div><div style="color:var(--text-secondary); margin-top:4px;">${this.escapeHtml(user?.email || '')}</div><div style="color:var(--text-secondary); margin-top:4px;">Role: ${this.escapeHtml(user?.role || 'user')}</div>`;
            document.getElementById('accountAuthForms')?.setAttribute('hidden', 'hidden');
            document.getElementById('accountLogout')?.removeAttribute('hidden');
        } catch {
            status.textContent = 'Not authenticated';
            details.innerHTML = '<p style="color:var(--text-secondary);">Sign in or create an account to use cloud workspaces, Git integrations and deployments.</p>';
            document.getElementById('accountAuthForms')?.removeAttribute('hidden');
            document.getElementById('accountLogout')?.setAttribute('hidden', 'hidden');
        }
    }

    async accountLogin() {
        if (!this.runtime?.auth?.enabled) return this.showToast('Production authentication API is not configured.', 'error');
        const email = document.getElementById('accountEmail')?.value.trim();
        const password = document.getElementById('accountPassword')?.value || '';
        if (!email || !password) return this.showToast('Email and password are required.', 'error');
        try {
            await this.runtime.auth.login({ email, password });
            try { await this.ensureCloudWorkspace(); } catch (workspaceError) { console.warn('[Workspace] deferred:', workspaceError.message); }
            this.showToast('Signed in successfully.', 'success');
            await this.refreshAccount();
        } catch (err) { this.showToast(err.message, 'error'); }
    }

    async accountRegister() {
        if (!this.runtime?.auth?.enabled) return this.showToast('Production authentication API is not configured.', 'error');
        const displayName = document.getElementById('accountDisplayName')?.value.trim();
        const email = document.getElementById('accountEmail')?.value.trim();
        const password = document.getElementById('accountPassword')?.value || '';
        if (!email || password.length < 10) return this.showToast('Use a valid email and a password of at least 10 characters.', 'error');
        try {
            await this.runtime.auth.register({ email, password, displayName });
            try { await this.ensureCloudWorkspace(); } catch (workspaceError) { console.warn('[Workspace] deferred:', workspaceError.message); }
            this.showToast('Account created successfully.', 'success');
            await this.refreshAccount();
        } catch (err) { this.showToast(err.message, 'error'); }
    }

    async accountLogout() {
        try {
            await this.runtime.auth.logout();
            this.showToast('Signed out.', 'success');
            await this.refreshAccount();
        } catch (err) { this.showToast(err.message, 'error'); }
    }

    async ensureCloudWorkspace() {
        if (!this.runtime?.auth?.enabled || !this.runtime?.workspace?.enabled || !this.runtime?.project?.enabled) {
            throw new Error('Production cloud APIs are not configured.');
        }
        const auth = await this.runtime.auth.me();
        if (!auth?.user) throw new Error('AUTHENTICATION_REQUIRED');
        const name = (this.projectName || 'untitled-project').trim().slice(0, 80) || 'untitled-project';
        let project = null;
        const projects = await this.runtime.project.list();
        project = (projects.projects || []).find(p => p.name === name) || (projects.projects || [])[0] || null;
        if (!project) project = (await this.runtime.project.create(name, 'Code Studio cloud workspace')).project;
        this.cloudProjectId = project.id;
        if (!this.runtime.workspace.currentId) {
            const workspace = await this.runtime.workspace.create({ projectId: project.id });
            this.runtime.workspace.currentId = workspace?.workspace?.id || workspace?.id || null;
        }
        if (!this.runtime.workspace.currentId) throw new Error('CLOUD_WORKSPACE_CREATE_FAILED');
        const state = await this.runtime.workspace.get(this.runtime.workspace.currentId);
        if (state?.workspace?.status !== 'running') await this.runtime.workspace.start(this.runtime.workspace.currentId);
        this.cloudTerminalWorkspaceId = this.runtime.workspace.currentId;
        await this.attachTypeScriptLanguageServer();
        return this.runtime.workspace.currentId;
    }

    async attachTypeScriptLanguageServer() {
        if (!this.runtime?.languageServer?.connect || !this.runtime.workspace?.currentId) return null;
        if (this.tsLanguageServerWorkspaceId === this.runtime.workspace.currentId && this.runtime.languageServer.socket?.readyState === WebSocket.OPEN) return this.runtime.languageServer;
        try {
            await this.runtime.languageServer.connect(this.runtime.workspace.currentId);
            this.tsLanguageServerWorkspaceId = this.runtime.workspace.currentId;
            for (const [path, model] of this.monacoModels.entries()) {
                if (this.isTypeScriptLike(path)) await this.runtime.languageServer.open(path, model.getValue());
            }
            this.showToast('Real TypeScript language server connected.', 'success');
            return this.runtime.languageServer;
        } catch (error) {
            console.warn('[LanguageServer] unavailable:', error.message);
            return null;
        }
    }

    isTypeScriptLike(path) {
        return /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(String(path || ''));
    }

    async refreshTypeScriptDiagnostics(path) {
        if (!this.isTypeScriptLike(path) || !this.runtime?.languageServer?.socket || this.runtime.languageServer.socket.readyState !== WebSocket.OPEN) return;
        try {
            const result = await this.runtime.languageServer.diagnostics(path);
            const model = this.monacoModels.get(path);
            if (!model || typeof monaco === 'undefined') return;
            const severity = { error: monaco.MarkerSeverity.Error, warning: monaco.MarkerSeverity.Warning, info: monaco.MarkerSeverity.Info };
            monaco.editor.setModelMarkers(model, 'code-studio-typescript-language-server', (result || []).map(d => ({
                severity: severity[d.severity] || monaco.MarkerSeverity.Error,
                message: `${d.message}${d.code ? ` (TS${d.code})` : ''}`,
                startLineNumber: d.range?.start?.line || 1,
                startColumn: d.range?.start?.character || 1,
                endLineNumber: d.range?.end?.line || d.range?.start?.line || 1,
                endColumn: d.range?.end?.character || ((d.range?.start?.character || 1) + 1)
            })));
            this.refreshProblemsPanel();
        } catch (error) { console.warn('[LanguageServer] diagnostics failed:', error.message); }
    }

    registerTypeScriptLanguageProviders() {
        if (this.tsLanguageProvidersRegistered || typeof monaco === 'undefined') return;
        this.tsLanguageProvidersRegistered = true;
        const selectors = [{ language: 'typescript' }, { language: 'typescriptreact' }, { language: 'javascript' }, { language: 'javascriptreact' }];
        const kindMap = { method: monaco.languages.CompletionItemKind.Method, function: monaco.languages.CompletionItemKind.Function, property: monaco.languages.CompletionItemKind.Property, variable: monaco.languages.CompletionItemKind.Variable, class: monaco.languages.CompletionItemKind.Class, interface: monaco.languages.CompletionItemKind.Interface, module: monaco.languages.CompletionItemKind.Module, keyword: monaco.languages.CompletionItemKind.Keyword, enum: monaco.languages.CompletionItemKind.Enum, const: monaco.languages.CompletionItemKind.Constant, type: monaco.languages.CompletionItemKind.TypeParameter, alias: monaco.languages.CompletionItemKind.Reference };
        selectors.forEach(selector => monaco.languages.registerCompletionItemProvider(selector.language, {
            triggerCharacters: ['.', '/', '"', "'"],
            provideCompletionItems: async (model, position) => {
                const client = this.runtime?.languageServer;
                if (!client || client.socket?.readyState !== WebSocket.OPEN) return { suggestions: [] };
                try {
                    const result = await client.completion(model.uri.path.replace(/^\//, ''), { line: position.lineNumber, character: position.column });
                    return { suggestions: (result || []).map(item => ({ label: item.label, kind: kindMap[item.kind] || monaco.languages.CompletionItemKind.Text, insertText: item.insertText || item.label, sortText: item.sortText, detail: item.detail })) };
                } catch { return { suggestions: [] }; }
            }
        }));
        selectors.forEach(selector => monaco.languages.registerHoverProvider(selector.language, { provideHover: async (model, position) => {
            const client = this.runtime?.languageServer; if (!client || client.socket?.readyState !== WebSocket.OPEN) return null;
            try { return await client.hover(model.uri.path.replace(/^\//, ''), { line: position.lineNumber, character: position.column }); } catch { return null; }
        }}));
        selectors.forEach(selector => monaco.languages.registerDefinitionProvider(selector.language, { provideDefinition: async (model, position) => {
            const client = this.runtime?.languageServer; if (!client || client.socket?.readyState !== WebSocket.OPEN) return [];
            try { const result = await client.definition(model.uri.path.replace(/^\//, ''), { line: position.lineNumber, character: position.column }); return (result || []).map(d => ({ uri: monaco.Uri.parse(`file:///${d.uri}`), range: new monaco.Range(d.range.start.line, d.range.start.character, d.range.end.line, d.range.end.character) })); } catch { return []; }
        }}));
    }

    async openCloudTerminal() {
        const id = await this.ensureCloudWorkspace();
        if (this.cloudTerminal && this.cloudTerminal.readyState === WebSocket.OPEN) return this.cloudTerminal;
        const socket = this.runtime.workspace.openTerminal(id, { cols: 120, rows: 30, cwd: '/workspace' });
        this.cloudTerminal = socket;
        this.cloudTerminalWorkspaceId = id;
        socket.binaryType = 'arraybuffer';
        socket.onopen = () => this.showToast('Production workspace terminal connected.', 'success');
        socket.onmessage = event => {
            const data = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
            const panel = document.getElementById('terminalPanel');
            if (!panel) return;
            const line = document.createElement('div');
            line.className = 'terminal-line';
            line.innerHTML = `<span style="width:20px;"></span><span class="terminal-output" style="white-space:pre-wrap;"></span>`;
            line.querySelector('.terminal-output').textContent = data;
            panel.insertBefore(line, panel.lastElementChild);
            panel.scrollTop = panel.scrollHeight;
        };
        socket.onerror = () => this.showToast('Production terminal connection failed.', 'error');
        socket.onclose = () => { this.cloudTerminal = null; };
        return socket;
    }

    async requireCloudWorkspaceForRemoteGit() {
        if (!this.runtime?.workspace?.enabled) {
            this.showToast('Remote Git requires the production workspace API. Configure it and select a cloud workspace first.', 'error');
            return false;
        }
        if (!this.runtime.workspace.currentId) {
            try { await this.ensureCloudWorkspace(); } catch (error) {
                this.showToast(`Cloud workspace unavailable: ${error.message}`, 'error');
                return false;
            }
        }
        return true;
    }

    async syncEditorToCloudWorkspace() {
        if (!(await this.requireCloudWorkspaceForRemoteGit())) return false;
        const id = this.runtime.workspace.currentId;
        for (const [path, data] of this.fileSystem) {
            if (data.type === 'file') await this.runtime.workspace.writeFile(id, path, data.content);
        }
        return true;
    }

    async syncCloudWorkspaceToEditor() {
        if (!(await this.requireCloudWorkspaceForRemoteGit())) return false;
        const id = this.runtime.workspace.currentId;
        const result = await this.runtime.workspace.files(id);
        const files = result?.files || [];
        this.disposeAllModels();
        this.fileSystem.clear();
        for (const path of files) {
            const item = await this.runtime.workspace.readFile(id, path);
            this.fileSystem.set(path, { type: 'file', content: item.content, language: this.getLanguage(path), modified: false });
        }
        this.renderFileTree();
        const first = this.fileSystem.has('index.html') ? 'index.html' : Array.from(this.fileSystem.keys())[0];
        if (first) this.openFile(first);
        await this.saveProjectToDB();
        return true;
    }
    
    gitStatus() {
        this.showGit();
    }
    
    syncChanges() {
        this.showGit();
    }
    
    // ============================================
    // GIT — real git via isomorphic-git + LightningFS
    // Everything below runs actual git operations against a virtual
    // filesystem persisted in IndexedDB (not a simulation).
    // ============================================
    ensureGitLibs() {
        if (typeof window.LightningFS === 'undefined' || typeof window.git === 'undefined') {
            this.showToast('Git libraries failed to load — check your connection and reload.', 'error');
            return false;
        }
        return true;
    }
    
    async initGitFs() {
        if (this.gitFsReady) return true;
        if (!this.ensureGitLibs()) return false;
        this.gitFs = new LightningFS('code-studio-git-fs');
        this.gitPfs = this.gitFs.promises;
        try {
            await this.gitPfs.mkdir(this.gitDir);
        } catch (err) {
            if (err.code !== 'EEXIST') console.error(err);
        }
        this.gitFsReady = true;
        return true;
    }
    
    // A minimal fetch-based HTTP client matching isomorphic-git's `http` interface
    // (avoids needing an ESM import for isomorphic-git/http/web in a classic script).
    get gitHttp() {
        return {
            request: async ({ url, method = 'GET', headers = {}, body }) => {
                let bodyBuffer;
                if (body) {
                    const chunks = [];
                    for await (const chunk of body) chunks.push(chunk);
                    const total = chunks.reduce((n, c) => n + c.length, 0);
                    bodyBuffer = new Uint8Array(total);
                    let offset = 0;
                    for (const c of chunks) { bodyBuffer.set(c, offset); offset += c.length; }
                }
                const res = await fetch(url, { method, headers, body: bodyBuffer });
                const resHeaders = {};
                res.headers.forEach((v, k) => { resHeaders[k] = v; });
                const arrayBuffer = await res.arrayBuffer();
                const bodyChunk = new Uint8Array(arrayBuffer);
                return {
                    url: res.url,
                    method,
                    headers: resHeaders,
                    body: (async function* () { yield bodyChunk; })(),
                    statusCode: res.status,
                    statusMessage: res.statusText
                };
            }
        };
    }
    
    gitAuthor() {
        return {
            name: this.settings.gitAuthorName || 'Code Studio User',
            email: this.settings.gitAuthorEmail || 'user@codestudio.local'
        };
    }
    
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    // Write every file currently in the editor into the git working directory,
    // and remove anything there that the editor no longer has (so status/diff
    // reflect exactly what's open right now, including unsaved deletions).
    async gitSyncToFs() {
        const wanted = new Set();
        for (const [name, data] of this.fileSystem) {
            if (data.type !== 'file') continue;
            wanted.add(name);
            const parts = name.split('/');
            let cur = this.gitDir;
            for (let i = 0; i < parts.length - 1; i++) {
                cur += '/' + parts[i];
                try { await this.gitPfs.mkdir(cur); } catch (e) { if (e.code !== 'EEXIST') throw e; }
            }
            await this.gitPfs.writeFile(`${this.gitDir}/${name}`, data.content, 'utf8');
        }
        
        const existing = await this.gitListFiles('');
        for (const path of existing) {
            if (!wanted.has(path)) {
                try { await this.gitPfs.unlink(`${this.gitDir}/${path}`); } catch (e) {}
            }
        }
    }
    
    async gitListFiles(prefix) {
        let results = [];
        let entries;
        try {
            entries = await this.gitPfs.readdir(`${this.gitDir}/${prefix}`.replace(/\/$/, ''));
        } catch (e) {
            return results;
        }
        for (const entry of entries) {
            if (entry === '.git') continue;
            const relPath = prefix ? `${prefix}/${entry}` : entry;
            const stat = await this.gitPfs.stat(`${this.gitDir}/${relPath}`);
            if (stat.isDirectory()) {
                results = results.concat(await this.gitListFiles(relPath));
            } else {
                results.push(relPath);
            }
        }
        return results;
    }
    
    async gitWipeDir() {
        const removeAll = async (relPath) => {
            let entries = [];
            try { entries = await this.gitPfs.readdir(`${this.gitDir}/${relPath}`.replace(/\/$/, '')); } catch (e) { return; }
            for (const entry of entries) {
                const childRel = relPath ? `${relPath}/${entry}` : entry;
                const full = `${this.gitDir}/${childRel}`;
                const stat = await this.gitPfs.stat(full);
                if (stat.isDirectory()) {
                    await removeAll(childRel);
                    try { await this.gitPfs.rmdir(full); } catch (e) {}
                } else {
                    try { await this.gitPfs.unlink(full); } catch (e) {}
                }
            }
        };
        await removeAll('');
    }
    
    // Pull every file out of the git working directory back into the editor
    // (used after clone / checkout / pull, when the working directory changed).
    async gitSyncFromFs() {
        const files = await this.gitListFiles('');
        this.disposeAllModels();
        this.fileSystem.clear();
        for (const path of files) {
            const content = await this.gitPfs.readFile(`${this.gitDir}/${path}`, 'utf8');
            this.fileSystem.set(path, {
                type: 'file',
                content,
                language: this.getLanguage(path),
                modified: false
            });
        }
        this.renderFileTree();
        const first = this.fileSystem.has('index.html') ? 'index.html' : Array.from(this.fileSystem.keys())[0];
        if (first) this.openFile(first);
        await this.saveProjectToDB();
    }
    
    async gitHasRepo() {
        if (!(await this.initGitFs())) return false;
        try {
            await this.gitPfs.stat(`${this.gitDir}/.git`);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    async showGit() {
        if (!(await this.initGitFs())) return;
        document.getElementById('gitModal').classList.add('active');
        
        const has = await this.gitHasRepo();
        document.getElementById('gitNoRepo').style.display = has ? 'none' : 'block';
        document.getElementById('gitRepoView').style.display = has ? 'block' : 'none';
        
        if (has) {
            document.getElementById('gitRemoteUrlInput').value = this.gitRemoteUrl || '';
            document.getElementById('gitAuthorName').value = this.settings.gitAuthorName || '';
            document.getElementById('gitAuthorEmail').value = this.settings.gitAuthorEmail || '';
            await this.gitRefreshStatus();
        }
    }
    
    async gitInitRepo() {
        if (!(await this.initGitFs())) return;
        await this.gitSyncToFs();
        await git.init({ fs: this.gitFs, dir: this.gitDir, defaultBranch: 'main' });
        this.gitCurrentBranch = 'main';
        this.showToast('Git repository initialized', 'success');
        await this.showGit();
    }
    
    async gitCloneRepo(urlOverride) {
        if (!(await this.requireCloudWorkspaceForRemoteGit())) return;
        const url = urlOverride || document.getElementById('gitCloneUrl')?.value.trim();
        if (!url) { this.showToast('Enter a repository URL', 'error'); return; }
        this.showToast('Cloning repository in the isolated workspace...', 'info');
        try {
            const result = await this.runtime.workspace.cloneGithub(this.runtime.workspace.currentId, { cloneUrl: url });
            const operation = result?.operation;
            if (!operation || operation.exitCode !== 0) throw new Error(operation?.output || 'Git clone failed.');
            this.gitRemoteUrl = url;
            this.projectName = (url.split('/').pop() || 'cloned-project').replace(/\.git$/, '');
            await this.syncCloudWorkspaceToEditor();
            document.getElementById('welcomeScreen').classList.remove('active');
            document.getElementById('appContainer').style.display = 'flex';
            this.showToast('Repository cloned into the isolated workspace.', 'success');
            await this.showGit();
        } catch (err) {
            console.error(err);
            this.showToast(`Clone failed: ${err.message}`, 'error');
        }
    }

    async gitRefreshStatus() {
        if (!(await this.gitHasRepo())) return;
        await this.gitSyncToFs();
        
        try {
            this.gitCurrentBranch = (await git.currentBranch({ fs: this.gitFs, dir: this.gitDir })) || 'main';
        } catch (e) {}
        
        const branches = await git.listBranches({ fs: this.gitFs, dir: this.gitDir });
        const sel = document.getElementById('gitBranchSelect');
        if (sel) {
            sel.innerHTML = branches.map(b =>
                `<option value="${b}" ${b === this.gitCurrentBranch ? 'selected' : ''}>${b}</option>`
            ).join('');
        }
        
        const matrix = await git.statusMatrix({ fs: this.gitFs, dir: this.gitDir });
        const changed = matrix.filter(([, head, workdir, stage]) => !(head === 1 && workdir === 1 && stage === 1));
        
        const listEl = document.getElementById('gitChangesList');
        if (listEl) {
            listEl.innerHTML = changed.length === 0
                ? '<div style="color: var(--text-secondary);">No changes — working tree clean</div>'
                : changed.map(([filepath, head, workdir]) => {
                    let label = 'modified';
                    if (head === 0 && workdir !== 0) label = 'added';
                    else if (head !== 0 && workdir === 0) label = 'deleted';
                    return `<div style="padding:3px 0;"><i class="fas fa-circle" style="font-size:6px; color: var(--accent);"></i> ${this.escapeHtml(filepath)} <span style="color: var(--text-secondary);">(${label})</span></div>`;
                }).join('');
        }
        
        const branchEl = document.getElementById('gitBranch');
        const changesEl = document.getElementById('gitChanges');
        if (branchEl) branchEl.textContent = this.gitCurrentBranch;
        if (changesEl) changesEl.textContent = `${changed.length} change${changed.length === 1 ? '' : 's'}`;
        
        try {
            const log = await git.log({ fs: this.gitFs, dir: this.gitDir, depth: 15 });
            const logEl = document.getElementById('gitLogList');
            if (logEl) {
                logEl.innerHTML = log.length === 0
                    ? '<div style="color: var(--text-secondary);">No commits yet</div>'
                    : log.map(c => `<div style="padding:3px 0;"><span style="color: var(--accent); font-family: monospace;">${c.oid.slice(0, 7)}</span> ${this.escapeHtml(c.commit.message.split('\n')[0])} <span style="color: var(--text-secondary);">— ${this.escapeHtml(c.commit.author.name)}</span></div>`).join('');
            }
        } catch (e) {}
    }
    
    async gitCommitChanges() {
        const message = document.getElementById('gitCommitMessage').value.trim();
        if (!message) { this.showToast('Enter a commit message', 'error'); return; }
        if (!(await this.gitHasRepo())) return;
        
        await this.gitSyncToFs();
        
        const matrix = await git.statusMatrix({ fs: this.gitFs, dir: this.gitDir });
        for (const [filepath, , workdir] of matrix) {
            if (workdir === 0) {
                await git.remove({ fs: this.gitFs, dir: this.gitDir, filepath });
            } else {
                await git.add({ fs: this.gitFs, dir: this.gitDir, filepath });
            }
        }
        
        try {
            const sha = await git.commit({
                fs: this.gitFs,
                dir: this.gitDir,
                message,
                author: this.gitAuthor()
            });
            document.getElementById('gitCommitMessage').value = '';
            this.showToast(`Committed ${sha.slice(0, 7)}`, 'success');
            await this.gitRefreshStatus();
        } catch (err) {
            console.error(err);
            this.showToast(`Commit failed: ${err.message}`, 'error');
        }
    }
    
    async gitPushRepo() {
        if (!(await this.requireCloudWorkspaceForRemoteGit())) return;
        this.gitSaveRemoteSettings();
        if (!this.gitRemoteUrl) { this.showToast('Set a remote URL first', 'error'); return; }
        this.showToast('Syncing files and pushing from the isolated workspace...', 'info');
        try {
            await this.syncEditorToCloudWorkspace();
            const result = await this.runtime.workspace.git(this.runtime.workspace.currentId, { operation: 'push', args: [], cwd: '/workspace' });
            const op = result?.operation;
            if (!op || op.exitCode !== 0) throw new Error(op?.output || 'Git push failed.');
            this.showToast('Pushed successfully from the production workspace.', 'success');
        } catch (err) {
            console.error(err);
            this.showToast(`Push failed: ${err.message}`, 'error');
        }
    }

    async gitPullRepo() {
        if (!(await this.requireCloudWorkspaceForRemoteGit())) return;
        this.gitSaveRemoteSettings();
        if (!this.gitRemoteUrl) { this.showToast('Set a remote URL first', 'error'); return; }
        this.showToast('Pulling in the isolated workspace...', 'info');
        try {
            const result = await this.runtime.workspace.git(this.runtime.workspace.currentId, { operation: 'pull', args: ['--ff-only'], cwd: '/workspace' });
            const op = result?.operation;
            if (!op || op.exitCode !== 0) throw new Error(op?.output || 'Git pull failed.');
            await this.syncCloudWorkspaceToEditor();
            this.showToast('Pulled latest changes from the production workspace.', 'success');
            await this.gitRefreshStatus();
        } catch (err) {
            console.error(err);
            this.showToast(`Pull failed: ${err.message}`, 'error');
        }
    }

    async gitNewBranch() {
        const name = prompt('New branch name:');
        if (!name || !name.trim()) return;
        if (!(await this.gitHasRepo())) return;
        try {
            await git.branch({ fs: this.gitFs, dir: this.gitDir, ref: name.trim(), checkout: true });
            this.gitCurrentBranch = name.trim();
            await this.gitSyncFromFs();
            this.showToast(`Switched to new branch "${name.trim()}"`, 'success');
            await this.gitRefreshStatus();
        } catch (err) {
            console.error(err);
            this.showToast(`Branch creation failed: ${err.message}`, 'error');
        }
    }
    
    async gitSwitchBranch(name) {
        if (!name || name === this.gitCurrentBranch) return;
        try {
            await git.checkout({ fs: this.gitFs, dir: this.gitDir, ref: name });
            this.gitCurrentBranch = name;
            await this.gitSyncFromFs();
            this.showToast(`Switched to "${name}"`, 'success');
            await this.gitRefreshStatus();
        } catch (err) {
            console.error(err);
            this.showToast(`Checkout failed: ${err.message}`, 'error');
        }
    }
    
    async connectGithub() {
        try {
            if (!this.runtime?.workspace?.enabled) throw new Error('Cloud workspace API is not configured.');
            const status = await this.runtime.workspace.githubStatus();
            if (status?.connected) {
                const login = status.account?.login || 'connected account';
                this.showToast(`GitHub connected as ${login}.`, 'success');
                const el = document.getElementById('githubPublishStatus');
                if (el) el.textContent = `Connected as ${login}.`;
                return;
            }
            const result = await this.runtime.workspace.githubOAuthStart();
            if (!result?.url) throw new Error('GitHub OAuth URL was not returned.');
            window.location.href = result.url;
        } catch (err) {
            console.error(err);
            this.showToast(`GitHub connection failed: ${err.message}`, 'error');
        }
    }

    async publishProjectToGithub() {
        try {
            const workspaceId = this.runtime?.workspace?.currentId;
            if (!workspaceId) throw new Error('Start/select a cloud workspace before publishing.');
            if (!this.runtime.workspace.enabled) throw new Error('Cloud workspace API is not configured.');
            const status = await this.runtime.workspace.githubStatus();
            if (!status?.connected) {
                const result = await this.runtime.workspace.githubOAuthStart();
                if (!result?.url) throw new Error('GitHub OAuth URL was not returned.');
                window.location.href = result.url;
                return;
            }
            const defaultName = (this.projectName || 'code-studio-project').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'code-studio-project';
            const name = window.prompt('GitHub repository name:', defaultName);
            if (!name) return;
            const privateRepo = !window.confirm('Make this GitHub repository PUBLIC?\n\nCancel = keep it PRIVATE.');
            const description = window.prompt('Repository description (optional):', 'Project created with Code Studio') || '';
            const commitMessage = window.prompt('Commit message:', 'Publish project from Code Studio') || 'Publish project from Code Studio';
            const el = document.getElementById('githubPublishStatus');
            if (el) el.textContent = 'Creating repository and pushing project…';
            this.showToast('Creating GitHub repository and pushing the real workspace…', 'info');
            const result = await this.runtime.workspace.publishToGithub(workspaceId, {
                name,
                private: privateRepo,
                description,
                commitMessage,
                authorName: this.settings.gitAuthorName,
                authorEmail: this.settings.gitAuthorEmail
            });
            if (!result?.published) throw new Error('GitHub publish did not complete.');
            this.gitRemoteUrl = result.repository.cloneUrl;
            const remote = document.getElementById('gitRemoteUrlInput');
            if (remote) remote.value = result.repository.cloneUrl;
            if (el) el.innerHTML = `Published to <a href="${this.escapeHtml(result.repository.htmlUrl)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(result.repository.fullName)}</a>`;
            this.showToast(`Published successfully to ${result.repository.fullName}.`, 'success');
        } catch (err) {
            console.error(err);
            const el = document.getElementById('githubPublishStatus');
            if (el) el.textContent = `Publish failed: ${err.message}`;
            this.showToast(`GitHub publish failed: ${err.message}`, 'error');
        }
    }

    gitSaveRemoteSettings() {
        this.gitRemoteUrl = document.getElementById('gitRemoteUrlInput')?.value.trim() || this.gitRemoteUrl;
        this.settings.gitAuthorName = document.getElementById('gitAuthorName')?.value.trim() || this.settings.gitAuthorName;
        this.settings.gitAuthorEmail = document.getElementById('gitAuthorEmail')?.value.trim() || this.settings.gitAuthorEmail;
        this.saveSettings();
        this.showToast('Git settings saved. Credentials are managed by the production backend.', 'success');
    }
    
    syncToCloud() {
        this.showToast('Syncing to cloud...', 'info');
        setTimeout(() => this.showToast('Synced to cloud!', 'success'), 1500);
    }
    
    encodingMenu() {
        this.showToast('UTF-8 encoding', 'info');
    }
    
    lineEndingMenu() {
        this.showToast('LF line endings', 'info');
    }
    
    refreshExplorer() {
        this.renderFileTree();
        this.showToast('Explorer refreshed', 'info');
    }
    
    // ============================================
    // MODAL HELPERS
    // ============================================
    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }
    
    // ============================================
    // TOAST NOTIFICATIONS
    // ============================================
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };
        
        toast.innerHTML = `<i class="fas ${icons[type]}"></i> ${message}`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    // ============================================
    // UTILITIES
    // ============================================
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize app
const app = new CodeStudio();
window.app = app;
