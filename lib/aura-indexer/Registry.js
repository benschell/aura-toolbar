'use babel';

import Component from './Component';
import Library from './Library';
import { Emitter } from 'atom';

export default class Indexer extends Emitter {
    
    constructor() {
        super();

        this.start = Date.now();
        this.cmps = {};
        this.componentsByPath = {};
        this.reindex();
    }

    reindex() {
        this.findFiles()
            .then(this.buildComponentMap.bind(this))
            .then(function() {
                this.emit('build-component-map-complete');
                console.log(this.componentsByPath, Object.keys(this.cmps).length, Object.keys(this.componentsByPath).length);
                console.log('Got References?!', ((Date.now() - this.start) / 1000) + 's');
            }.bind(this))
            .then(this.generateReferences.bind(this))
            .then(function() {
                console.log('Generated References', ((Date.now() - this.start) / 1000) + 's');
            }.bind(this))
            .then(this.resolveReferences.bind(this))
            .then(function() {
                console.log('Resolved References', ((Date.now() - this.start) / 1000) + 's');
            }.bind(this));
    }
    
    getCmpByPath(path) {
        return this.componentsByPath[path];
    }
    
    getCmpWithNameAndType(name, type) {
        if (!this.cmps[name]) {
            var cmp = new Component(null, this);
            cmp.name = name;
            cmp.type = type;

            this.cmps[name] = cmp;
        }

        if (type && this.cmps[name].type !== type) {
            console.error(
                'Found component wasn\'t of the expected type?! ' + 
                this.cmps[name].name + ' :: ' + this.cmps[name].type + ' vs. ' + type
            );
        }

        return this.cmps[name];
    }
    
    generateReferences() {
        var keys = Object.keys(this.cmps);
        var doNext = function(index) {
            if (index >= keys.length) {
                return;
            }

            var key = keys[index];
            return this.cmps[key].generateReferences()
                .then(doNext.bind(this, index+1));
        }.bind(this);
        return doNext(0);
    }
    
    resolveReferences() {
        console.debug('TODO: resolve references between components');
    }
    
    buildComponentMap() {
        Object.keys(this.cmps).forEach(this._buildComponentMapForComponent.bind(this));
    }
    
    _buildComponentMapForComponent(cmpName) {
        var cmp = this.cmps[cmpName];
        var refs = cmp.getFiles();
        for (var key in refs) {
            this.componentsByPath[refs[key]] = cmp;
        }
    }

    findFiles() {
        var t = this;
        return new Promise(function(resolve, reject) {
            var projectDirectories = atom.project.getDirectories();
            var cmps = {};
            var toInspect = projectDirectories.length;
            var done = function() {
                if ((--toInspect) === 0) {
                    t.cmps = cmps;
                    console.log('Got Files?!', Object.keys(cmps).length, ((Date.now() - t.start) / 1000) + 's');
                    resolve();
                }
            };
            var handleEntries = function(error, entries) {
                if (error) {
                    console.error('Got an error while getting entries!', error);
                    return done();
                }

                entries.forEach(function(entry) {
                    var path;
                    if(entry.isDirectory()) {
                        // Directory
                        path = entry.getPath();
                        // Folders to ignore!
                        if (
                            path.indexOf('node_modules') === -1 && // No node_modules folders
                            path.indexOf('target/classes') === -1 // No target/classes folders
                        ) {
                            toInspect++;
                            entry.getEntries(handleEntries);
                        }
                    } else {
                        // File
                        path = entry.getPath();
                        var cmp;
                        if (path.indexOf('.cmp') === path.length - 4) {
                            // CMP
                            cmp = new Component(entry, t);
                        } else if (path.indexOf('.app') === path.length - 4) {
                            // APP
                            cmp = new Component(entry, t);
                        } else if (path.indexOf('.evt') === path.length - 4) {
                            // EVT
                            cmp = new Component(entry, t);
                        } else if (path.indexOf('.lib') === path.length - 4) {
                            // LIB
                            cmp = new Library(entry, t);
                        } else {
                            // console.log('Not an Aura file');
                        }

                        if (cmp) {
                            cmps[cmp.getFullName()] = cmp;
                        }
                    }
                });
                return done();
            };
            projectDirectories.forEach(function(dir) {
                console.log('Got dir?', dir.getPath());
                dir.getEntries(handleEntries);
            });
        });
    }
}
