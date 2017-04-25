'use babel';

import { CompositeDisposable, File } from 'atom';
import Component from './Component';

export default class Library extends Component {
    constructor(componentMarkupFile) {
        super(componentMarkupFile);
        
        // Find all library files
        this.libraryFiles = [];
        var t = this;
        var dir = componentMarkupFile.getParent();
        var entries = dir.getEntriesSync();
        if (entries && entries.length > 0) {
            entries.forEach(function(entry) {
                if(entry.isFile() && entry.getPath() !== componentMarkupFile.getPath()) {
                    t.libraryFiles.push(entry);
                }
            });
        }
    }
    
    getReferences() {
        var ret = super.getReferences();
        this.libraryFiles.forEach(function(file) {
            var name = file.getPath().split('/');
            name = name[name.length - 1];
            name = name.split('.')[0];
            ret[name] = file.getPath();
        });
        return ret;
    }
}
