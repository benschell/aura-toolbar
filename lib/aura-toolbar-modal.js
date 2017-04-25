'use babel';

import { SelectListView } from 'atom-space-pen-views';

export default class AuraToolbarModal extends SelectListView {
    
    constructor(auraToolbar) {
        super();
        this.toolbar = auraToolbar;
    }
    
    getEmptyMessage(itemCount, filteredItemCount) {
        if (itemCount === 0) {
            return 'No references to this cmp.';
        }

        return super.getEmptyMessage(itemCount, filteredItemCount);
    }

    viewForItem(item) {
        return "<li>" + item.name + "</li>";
    }
    
    getFilterKey() {
        return "name";
    }

    confirmed(item) {
        this.toolbar.modal.hide();
        atom.workspace.open(item.path, {
            pending: true
        });
    }

    cancel() {
        this.toolbar.modal.hide();
    }
}
