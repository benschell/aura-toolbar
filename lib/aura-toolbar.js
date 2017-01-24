'use babel';

import AuraFooterView from './aura-footer-view';
import { CompositeDisposable, File } from 'atom';

export default {
    
  subscriptions: null,
  toolbarView: null,
  panel: null,

  activate(state) {
    this.toolbarView = new AuraFooterView(this);

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'aura-toolbar:open-markup': () => this.openMarkup(),
      'aura-toolbar:open-css': () => this.openCss(),
      'aura-toolbar:open-controller': () => this.openController(),
      'aura-toolbar:open-helper': () => this.openHelper(),
      'aura-toolbar:open-renderer': () => this.openRenderer(),
      'aura-toolbar:open-test': () => this.openTest()
    }));
    
    this.panel = atom.workspace.addBottomPanel({item: this.toolbarView, visible: false});
    
    this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem(this._didChangeActivePaneItem.bind(this)));
    this._didChangeActivePaneItem(atom.workspace.getActivePaneItem());
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  serialize() {
    return {
      toolbarView: this.toolbarView.serialize()
    };
  },
  
  _didChangeActivePaneItem(paneItem) {
    if (!paneItem || !paneItem.getPath) {
      this.panel.hide();
      return;
    }

    var filePath = paneItem.getPath();
    var currentType = this._getCurrentType(filePath);
    if (currentType) {
      this.panel.show();
      
      // Highlight the right tab
      this.toolbarView.highlight(currentType);
      
      // Hide unavailable tabs
      var markupWasFound = false;
      ['.cmp', '.app', '.evt', '.lib', '.css', 'Controller.js', 'Helper.js', 'Renderer.js', 'Test.js'].forEach(function(type) {
        var newPath = this._getFileOfType(filePath, type);
        if (type === '.cmp' || type === '.app' || type === '.evt' || type === '.lib') {
          if (newPath) {
            markupWasFound = true;
          }
          return;
        }

        if (newPath) {
          // Make sure this tab is shown
          this.toolbarView.show(type);
        } else {
          // Make sure this tab is hidden
          this.toolbarView.hide(type);
        }
      }.bind(this));
      if (markupWasFound) {
        this.toolbarView.show('Markup');
      } else {
        this.toolbarView.hide('Markup');
      }
    } else {
      this.panel.hide();
    }
  },
  
  _getCurrentType(currentPath) {
    var currentType = null;
    if (currentPath.indexOf('.cmp') === currentPath.length - 4) {
      currentType = '.cmp';
    } else if (currentPath.indexOf('.app') === currentPath.length - 4) {
      currentType = '.app';
    } else if (currentPath.indexOf('.evt') === currentPath.length - 4) {
      currentType = '.evt';
    } else if (currentPath.indexOf('.lib') === currentPath.length - 4) {
      currentType = '.lib';
    } else if (currentPath.indexOf('.css') === currentPath.length - 4) {
      currentType = '.css';
    } else if (currentPath.indexOf('Controller.js') !== -1) {
      currentType = 'Controller.js';
    } else if (currentPath.indexOf('Helper.js') !== -1) {
      currentType = 'Helper.js';
    } else if (currentPath.indexOf('Renderer.js') !== -1) {
      currentType = 'Renderer.js';
    } else if (currentPath.indexOf('Test.js') !== -1) {
      currentType = 'Test.js';
    }
    return currentType;
  },
  
  _getFileOfType(currentPath, type) {
    var currentType = this._getCurrentType(currentPath);

    if (currentType) {
      // Try to see if this is actually a component with peer files
      // TODO: Better path delimiter!
      var pathPieces = currentPath.split('/');
      var toLookFor = pathPieces[pathPieces.length - 1];
      if (currentType) {
        var newPath = currentPath.replace(currentType, type);
        var newFile = new File(newPath);
        if (newFile.existsSync()) {
          return newPath;
        }
      }
    }
    return false;
  },
  
  _openFile(type) {
    var paneItem = atom.workspace.getActivePaneItem();
    if (!paneItem || !paneItem.getPath) {
      return;
    }

    var filePath = paneItem.getPath();
    var path = this._getFileOfType(filePath, type);
    if (path) {
      atom.workspace.open(path);
      return true;
    } else {
    //   console.log('Would not open', type, 'either we\'re already in the type or there isn\'t a file of that type!');
    }
    return false;
  },

  openMarkup() {
    this._openFile('.cmp') || this._openFile('.app') || this._openFile('.evt') || this._openFile('.lib');
  },
  openCss() {
    this._openFile('.css');
  },
  openController() {
    this._openFile('Controller.js');
  },
  openHelper() {
    this._openFile('Helper.js');
  },
  openRenderer() {
    this._openFile('Renderer.js');
  },
  openTest() {
    this._openFile('Test.js');
  }

};
