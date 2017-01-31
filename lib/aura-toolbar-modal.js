'use babel';

import { SelectListView } from 'atom-space-pen-views';

export default class AuraToolbarModal extends SelectListView {

  constructor(auraToolbar) {
    super();

    // // Create root element
    // this.element = document.createElement('div');
    // this.element.classList.add('aura-toolbar-modal');
    
    this.setItems(['Hello', 'World']);

    // // Create message element
    // this.tabs = [];
    // this._addTab('Markup', ['Markup', '.cmp', '.app', '.evt', '.lib'], auraToolbar, 'Ctrl-Alt-a');
    // this._addTab('CSS', '.css', auraToolbar, 'Ctrl-Alt-s');
    // this._addTab('Controller', 'Controller.js', auraToolbar, 'Ctrl-Alt-z');
    // this._addTab('Helper', 'Helper.js', auraToolbar, 'Ctrl-Alt-x');
    // this._addTab('Renderer', 'Renderer.js', auraToolbar, 'Ctrl-Alt-c');
    // this._addTab('Test', 'Test.js', auraToolbar, 'Ctrl-Alt-v');
  }

  // // Returns an object that can be retrieved when package is activated
  // serialize() {}
  // 
  // // Tear down any state and detach
  // destroy() {
  //   this.element.remove();
  // }
  // 
  // getElement() {
  //   return this.element;
  // }
  
  viewForItem(item) {
    return "<li>"+item+"</li>";
  }
  
  confirmed(item) {
    console.debug('Selected item:', item);
  }
}
