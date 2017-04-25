'use babel';

import AuraFooterView from './aura-footer-view';
import AuraToolbarModal from './aura-toolbar-modal';
import AuraRegistry from './aura-indexer/Registry';
import { CompositeDisposable, File } from 'atom';
// import db from './from_mega/db';

export default {

    config: {
        shouldAddCustomFileTypes: {
            type: 'boolean',
            default: true
        }
    },
    
    subscriptions: null,
    toolbarView: null,
    modalView: null,
    panel: null,
    modal: null,

    activate(state) {
        this.registry = new AuraRegistry();
        this.toolbarView = new AuraFooterView(this, this.registry);
        this.modalView = new AuraToolbarModal(this);
        
        this.registry.on('build-component-map-complete', this._didChangeActivePaneItem.bind(this));

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
        this.modal = atom.workspace.addModalPanel({item: this.modalView, visible: false});

        this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem(this._didChangeActivePaneItem.bind(this)));
        this._didChangeActivePaneItem(atom.workspace.getActivePaneItem());

        this.subscriptions.add(atom.config.observe("aura-toolbar.shouldAddCustomFileTypes", (newValue) => this.addCustomFileTypes(newValue)));
        this.addCustomFileTypes(atom.config.get("aura-toolbar.shouldAddCustomFileTypes"));
    },

    deactivate() {
        this.subscriptions.dispose();
    },

    serialize() {
        return {
            toolbarView: this.toolbarView.serialize()
        };
    },

    addCustomFileTypes(shouldAdd) {
        if (shouldAdd) {
            // Setup the custom file types for the user
            var currentConfig = atom.config.get("core.customFileTypes");
            if (!currentConfig) {
                currentConfig = {};
            }
            if (!currentConfig["text.html.basic"]) {
                currentConfig["text.html.basic"] = [];
            }
            if (currentConfig["text.html.basic"].indexOf('cmp') === -1) {
                currentConfig["text.html.basic"].push('cmp');
            }
            if (currentConfig["text.html.basic"].indexOf('app') === -1) {
                currentConfig["text.html.basic"].push('app');
            }
            if (currentConfig["text.html.basic"].indexOf('evt') === -1) {
                currentConfig["text.html.basic"].push('evt');
            }
            if (currentConfig["text.html.basic"].indexOf('lib') === -1) {
                currentConfig["text.html.basic"].push('lib');
            }
            atom.config.set("core.customFileType", currentConfig);
        }
    },

    _didChangeActivePaneItem() {
        var paneItem = atom.workspace.getActivePaneItem();
        if (!paneItem || !paneItem.getPath || !paneItem.getPath()) {
            this.panel.hide();
            return;
        }

        var filePath = paneItem.getPath();
        var cmp = this.registry.getCmpByPath(filePath);

        if (cmp) {
            var refs = cmp.getFiles();
            var currentType = null;
            for (var type in refs) {
                if (refs[type] === filePath) {
                    currentType = type;
                    break;
                }
            }

            if (currentType) {
                this.panel.show();

                // Highlight the right tab
                this.toolbarView.highlight(currentType);

                if (cmp) {
                    ['markup', 'css', 'controller', 'helper', 'renderer', 'test'].forEach(function(type) {
                        if (cmp[type]) {
                            this.toolbarView.show(type);
                        } else {
                            this.toolbarView.hide(type);
                        }
                    }.bind(this));
                }
                
                this.toolbarView.toggleReferencesButtons(cmp.type);
            } else {
                this.panel.hide();
            }
            
            // Print component references
            cmp.printReferences();
        }
    },
    
    _getActiveCmp() {
        var paneItem = atom.workspace.getActivePaneItem();
        if (!paneItem || !paneItem.getPath) {
            return;
        }

        var filePath = paneItem.getPath();
        return this.registry.getCmpByPath(filePath);
    },

    _openFile(type) {
        var cmp = this._getActiveCmp();
        if (cmp) {
            var refs = cmp.getFiles();
            var filePath = refs[type];
            if (filePath) {
                atom.workspace.open(filePath, {
                    pending: true
                });
            } else {
                // console.log('Would not open', type, 'either we\'re already in the type or there isn\'t a file of that type!');
            }
        }
        return false;
    },

    openMarkup() {
        this._openFile('markup');
    },
    openCss() {
        this._openFile('css');
    },
    openController() {
        this._openFile('controller');
    },
    openHelper() {
        this._openFile('helper');
    },
    openRenderer() {
        this._openFile('renderer');
    },
    openTest() {
        this._openFile('test');
    },
    
    showJSReferences() {
        this._showModal('jsreferencers', function(referencer) {
            return {
                name: referencer.name,
                path: referencer.markup.getPath(),
                cmp: referencer
            };
        });
    },
    showEventHandlers() {
        this._showModal('eventReferencers', function(handler) {
            if (handler.type === 'handler') {
                return {
                    name: handler.cmp.name,
                    path: handler.cmp.markup.getPath(),
                    cmp: handler.cmp
                };
            }
        });
    },
    showMarkupReferences() {
        this._showModal('referencers', function(referencer) {
            return {
                name: referencer.name,
                path: referencer.markup.getPath(),
                cmp: referencer
            };
        });
    },
    _showModal(cmpAttribute, itemFunc) {
        var cmp = this._getActiveCmp();
        if (cmp) {
            var items = [];
            cmp[cmpAttribute].forEach(function(handler) {
                var item = itemFunc(handler);
                if (item) {
                    items.push(item);
                }
            });
            this.modalView.setItems(items);
            this.modal.show();
            this.modalView.focusFilterEditor();
        }
    }

};
