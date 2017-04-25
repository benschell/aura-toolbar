'use babel';

import { CompositeDisposable, File } from 'atom';
import xml2js from 'xml2js';

class Method {}
class Attribute {}
class EventRegistration {
    constructor() {
        this.type = 'registration';
    }
}
class EventHandler {
    constructor() {
        this.type = 'handler';
    }
}
class UsesLibrary {}
class Dependency {}
class JSReference {}

var Type = {
    COMPONENT: 'cmp',
    EVENT: 'evt',
    INTERFACE: 'intf',
    APP: 'app',
    LIBRARY: 'lib'
};

var toIgnore = [
    'aura:method',
    'aura:attribute',
    'aura:registerEvent',
    'aura:handler',
    'aura:import',
    'aura:dependency',
    
    'aura:set',
    'aura:locator'
];
var parseReferences = function(cmp, node) {
    if (typeof node !== 'object') {
        return;
    }

    Object.keys(node).forEach(function(nodeName) {
        if (nodeName === '$') { return; } // Ignore $ (attributes)
        if (toIgnore.indexOf(nodeName) !== -1) { return; } // Ignore known aura:* keywords
        
        // For all others:
        //  Add references for each
        //  Traverse within
        if (nodeName.indexOf(':') !== -1) { 
            cmp.addReference(nodeName);
        }
        
        if (Array.isArray(node[nodeName])) {
            node[nodeName].forEach(parseReferences.bind(null, cmp));
        }
    });
};

export default class Component {
    constructor(componentMarkupFile, registry) {
        this.registry = registry;
        
        if (componentMarkupFile) {
            var path = componentMarkupFile.getPath();
            var pathSplit = path.split('/');
            this.name = pathSplit[pathSplit.length - 3] + ':' + pathSplit[pathSplit.length - 2];
            this.type = pathSplit.pop().split('.').pop();
            this.markup = componentMarkupFile;

            // Get the component files
            [
                ['css', '.css'], 
                ['controller', 'Controller.js'], 
                ['helper', 'Helper.js'], 
                ['renderer', 'Renderer.js'], 
                ['test', 'Test.js']
            ].forEach(function(type) {
                var file = this._getFileOfType(path, type[1]);
                if (file) {
                    this[type[0]] = file;
                }
            }.bind(this));
        }
        
        // Event attrs
        this.eventType = null;
        
        // Component or Interface attrs
        this.methods = [];
        
        // All
        this.extends = [];
        this.extenders = [];
        this.implements = [];
        this.implementers = [];
        this.attrs = [];
        this.attrMap = {};
        this.eventRegistrations = [];
        this.eventHandlers = [];
        this.eventReferences = [];
        this.eventReferencers = [];
        this.libraryReferences = [];
        this.libraryReferencers = [];
        this.dependencies = [];
        this.dependers = [];
        this.references = [];
        this.referencers = [];
        
        // JS
        this.jsreferences = [];
        this.jsreferencers = [];
    }
    
    getFullName() {
        return this.name;
    }
    
    generateReferences() {
        return new Promise(function(resolve, reject) {
            // Parse the component markup file and each (relevant) JS file and figure out
            // where there are references to another component
            this.parseCmp()
                .then(resolve, reject);
        }.bind(this));
    }
    
    parseCmp() {
        var type = this.type;
        return this.markup.read()
            .then(function(contents) {
                return new Promise(function(resolve, reject) {
                    var parser = new xml2js.Parser();
                    parser.parseString(contents, function (err, result) {
                        if (err) {
                            return reject(err);
                        }

                        // Figure out the right element to provide
                        if (type === Type.COMPONENT) {
                            resolve(result['aura:component']);
                        } else if (type === Type.EVENT) {
                            resolve(result['aura:event']);
                        } else if (type === Type.INTERFACE) {
                            resolve(result['aura:interface']);
                        } else if (type === Type.APP) {
                            resolve(result['aura:application']);
                        } else if (type === Type.LIBRARY) {
                            resolve(result['aura:library']);
                        } else {
                            console.error('unknown component?', type, result);
                            reject('Unknown component type!');
                        }
                    });
                });
            })
            .then(function(root) {
                if (type === Type.EVENT) {
                    // Event Type
                    this.eventType = root.$ && root.$.type ? root.$.type : null;
                }

                if (type === Type.COMPONENT || type === Type.INTERFACE) {
                    // Find aura:methods
                    if (root['aura:method']) {
                        root['aura:method'].forEach(this.addMethod.bind(this));
                    }
                }

                if (type === Type.COMPONENT || type === Type.INTERFACE || type === Type.APP || type === Type.EVENT) {
                    // Does it extend anything?
                    if (root.$ && root.$.extends) {
                        var toExtend = root.$.extends.split(',');
                        toExtend.forEach(this.doesExtend.bind(this));
                    }
                    
                    // Does it implement anything?
                    if (root.$ && root.$.implements) {
                        var toImplement = root.$.implements.split(',');
                        toImplement.forEach(this.doesImplement.bind(this));
                    }
                    
                    if (root['aura:attribute']) {
                        // Attributes
                        root['aura:attribute'].forEach(this.addAttribute.bind(this));
                    }
                    
                    // Add v.body attr (?)
                    // root['aura:registerEvent'] :: Array
                    if (root['aura:registerEvent']) {
                        root['aura:registerEvent'].forEach(this.addRegisterEvent.bind(this));
                    }
                    // root['aura:handler'] :: Array
                    if (root['aura:handler']) {
                        root['aura:handler'].forEach(this.addHandler.bind(this));
                    }
                    // root['aura:import'] :: Array
                    if (root['aura:import']) {
                        root['aura:import'].forEach(this.addImport.bind(this));
                    }
                    // root['aura:dependency'] :: Array
                    if (root['aura:dependency']) {
                        root['aura:dependency'].forEach(this.addDependency.bind(this));
                    }
                    // All other elements -> References
                    parseReferences(this, root);

                }
            }.bind(this))
            .then(function() {
                // Parse controller & look for markup://<ns>:<name> references
                if (this.controller) {
                    return this.controller.read()
                        .then(function(contents) {
                            var matches = contents.match(/markup:\/\/[A-Za-z]*:[A-Za-z]*/g);
                            if (matches) {
                                matches.forEach(this.addJSReference.bind(this, this.controller));
                            }
                        }.bind(this));
                }
            }.bind(this));
    }
    
    addJSReference(file, referenceText) {
        var cmpName = referenceText.replace('markup://', '');
        var cmp = this.registry.getCmpWithNameAndType(cmpName);
        
        if (cmp) {
            var ref = new JSReference();
            ref.source = this;
            ref.file = file;
            ref.target = cmp;
            this.jsreferences.push(ref);
            cmp.addJSReferencer(ref);
        }
    }
    
    addJSReferencer(ref) {
        this.jsreferencers.push(ref);
    }
    
    doesExtend(cmpToExtend) {
        var targetType = Type.COMPONENT;
        if (this.type === Type.EVENT) {
            targetType = Type.EVENT;
        } else if (this.type === Type.INTERFACE) {
            targetType = Type.INTERFACE;
        }

        var cmp = this.registry.getCmpWithNameAndType(cmpToExtend, targetType);
        this.extends.push(cmp);
        cmp.addExtender(this);
    }
    
    addExtender(cmp) {
        this.extenders.push(cmp);
    }
    
    doesImplement(cmpToImplement) {
        var cmp = this.registry.getCmpWithNameAndType(cmpToImplement, Type.INTERFACE);
        if (cmp) {
            this.implements.push(cmp);
            cmp.addImplementer(this);
        }
    }
    
    addImplementer(cmp) {
        this.implementers.push(cmp);
    }
    
    addMethod(methodRoot) {
        // name, aura:attribute s, access, action, description
        var method = new Method();
        method.name = methodRoot.$.name;
        method.access = methodRoot.$.access;
        method.action = methodRoot.$.action;
        method.description = methodRoot.$.description;
        
        var attrs = [];
        if (methodRoot['aura:attribute']) {
            methodRoot['aura:attribute'].forEach(function(attribute) {
                var attr = new Attribute();
                attr.type = attribute.$.type || 'var';
                attr.name = attribute.$.name || 'unknown';
                attrs.push(attr);
            });
        }
        method.attributes = attrs;
        
        this.methods.push(method);
    }
    
    addAttribute(attributeRoot) {
        var attr = new Attribute();
        attr.name = attributeRoot.$.name;
        attr.type = attributeRoot.$.type;
        attr.required = attributeRoot.$.required;
        attr.desc = attributeRoot.$.description;
        attr.default = attributeRoot.$.default;
        attr.access = attributeRoot.$.access;

        this.attrs.push(attr);
        this.attrMap[attr.name] = attr;
    }

    addRegisterEvent(registerEventRoot) {
        // type, name, description
        var registration = new EventRegistration();
        registration.cmp = this;
        registration.event = this.registry.getCmpWithNameAndType(registerEventRoot.$.type, Type.EVENT);
        registration.name = registerEventRoot.$.name;
        registration.desc = registerEventRoot.$.description;
        
        this.eventRegistrations.push(registration);
        this.eventReferences.push(registration.event);
        registration.event.addEventReferencer(registration);
    }
    
    addEventReferencer(cmp) {
        this.eventReferencers.push(cmp);
    }

    addHandler(handlerRoot) {
        // event, name, action, value, description
        var handler = new EventHandler();
        handler.cmp = this;
        handler.event = this.registry.getCmpWithNameAndType(handlerRoot.$.event, Type.EVENT);
        handler.name = handlerRoot.$.name;
        handler.action = handlerRoot.$.action;
        handler.value = handlerRoot.$.value;
        handler.desc = handlerRoot.$.description;
        
        this.eventHandlers.push(handler);
        this.eventReferences.push(handler.event);
        handler.event.addEventReferencer(handler);
    }
    
    addImport(importRoot) {
        // library, property, description
        var lib = new UsesLibrary();
        lib.library = this.registry.getCmpWithNameAndType(importRoot.$.library, Type.LIBRARY);
        lib.property = importRoot.$.property;
        lib.description = importRoot.$.description;
        
        this.libraryReferences.push(lib);
        lib.library.addLibraryReferencer(lib);
    }
    
    addLibraryReferencer(cmp) {
        this.libraryReferencers.push(cmp);
    }
    
    addDependency(dependencyRoot) {
        // resource, type
        var name = dependencyRoot.$.resource;
        if (name.indexOf('markup://') === 0) {
            name = name.replace('markup://', '');
        }
        if (name.indexOf('*') !== -1) {
            // Do nothing with wildcard dependencies
            return;
        }

        var type = Type[dependencyRoot.$.type];
        if (!type) {
            type = Type.COMPONENT;
        }
        
        var dep = new Dependency();
        dep.target = this.registry.getCmpWithNameAndType(name, type);
        dep.source = this;
        
        this.dependencies.push(dep);
        dep.target.addDepender(dep);
    }
    
    addDepender(cmp) {
        this.dependers.push(cmp);
    }
    
    addReference(name) {
        var cmp = this.registry.getCmpWithNameAndType(name, Type.COMPONENT);
        this.references.push(cmp);
        cmp.addReferencer(this);
    }
    
    addReferencer(cmp) {
        this.referencers.push(cmp);
    }
    
    getFiles() {
        var ret = {};
        ret.markup = this.markup.getPath();
        if (this.css) { ret.css = this.css.getPath(); }
        if (this.controller) { ret.controller = this.controller.getPath(); }
        if (this.helper) { ret.helper = this.helper.getPath(); }
        if (this.renderer) { ret.renderer = this.renderer.getPath(); }
        if (this.test) { ret.test = this.test.getPath(); }
        return ret;
    }
    
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
    }

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
                    return newFile;
                }
            }
        }
        return false;
    }
    
    printReferences() {
        console.debug(this.name, this.type);
        
        if (this.extends.length) {
            console.info('\t Extends:');
            this.extends.forEach(function(doesExtend) {
                console.info('\t\t', doesExtend.name, doesExtend.type);
            });
        }
        if (this.extenders.length) {
            console.info('\t Extended By:');
            this.extenders.forEach(function(doesExtend) {
                console.info('\t\t', doesExtend.name, doesExtend.type);
            });
        }
        if (this.implements.length) {
            console.info('\t Implements:');
            this.implements.forEach(function(doesExtend) {
                console.info('\t\t', doesExtend.name, doesExtend.type);
            });
        }
        if (this.implementers.length) {
            console.info('\t Implemented By:');
            this.implementers.forEach(function(doesExtend) {
                console.info('\t\t', doesExtend.name, doesExtend.type);
            });
        }
        if (this.references.length) {
            console.info('\t Markup References:');
            this.references.forEach(function(doesExtend) {
                console.info('\t\t', doesExtend.name, doesExtend.type);
            });
        }
        if (this.referencers.length) {
            console.info('\t Referenced in Markup By:');
            this.referencers.forEach(function(doesExtend) {
                console.info('\t\t', doesExtend.name, doesExtend.type);
            });
        }
        if (this.eventReferences.length) {
            console.info('\t Event References:');
            this.eventReferences.forEach(function(doesExtend) {
                console.info('\t\t', doesExtend.name, doesExtend.type);
            });
        }
        if (this.eventReferencers.length) {
            console.info('\t Event Referenced in Markup By:');
            this.eventReferencers.forEach(function(doesExtend) {
                console.info('\t\t', doesExtend.name, doesExtend.type);
            });
        }
        if (this.libraryReferences.length) {
            console.info('\t Uses Libraries:');
            this.libraryReferences.forEach(function(doesExtend) {
                console.info('\t\t', doesExtend.library.name);
            });
        }
        if (this.libraryReferencers.length) {
            console.info('\t Library Used By:');
            this.libraryReferencers.forEach(function(doesExtend) {
                console.info('\t\t', doesExtend.name, doesExtend.type);
            });
        }
        if (this.dependencies.length) {
            console.info('\t Depends On:');
            this.dependencies.forEach(function(doesExtend) {
                console.info('\t\t', doesExtend.target.name, doesExtend.target.type);
            });
        }
        if (this.dependers.length) {
            console.info('\t Depended On By:');
            this.dependers.forEach(function(doesExtend) {
                console.info('\t\t', doesExtend.source.name, doesExtend.source.type);
            });
        }
    }
}
