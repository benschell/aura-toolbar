'use babel';

export default class AuraFooterView {

  constructor(auraToolbar) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('aura-footer-view');
    // this.element.classList.add('inline-block');
    
    const label = document.createElement('span');
    label.classList.add('label');
    label.textContent = 'Open: ';
    this.element.appendChild(label);

    // Create message element
    this.tabs = [];
    this._addTab('Markup', ['Markup', '.cmp', '.app', '.evt', '.lib'], auraToolbar, 'Ctrl-Alt-a');
    this._addTab('CSS', '.css', auraToolbar, 'Ctrl-Alt-s');
    this._addTab('Controller', 'Controller.js', auraToolbar, 'Ctrl-Alt-z');
    this._addTab('Helper', 'Helper.js', auraToolbar, 'Ctrl-Alt-x');
    this._addTab('Renderer', 'Renderer.js', auraToolbar, 'Ctrl-Alt-c');
    this._addTab('Test', 'Test.js', auraToolbar, 'Ctrl-Alt-v');
    
    // const trigger = document.createElement('span');
    // trigger.classList.add('tab');
    // trigger.classList.add('float-right');
    // trigger.classList.add('shown');
    // trigger.textContent = 'Referenced By';
    // trigger.addEventListener('click', function() {
    //   auraToolbar.showReferencedBy();
    // });
    // this.element.appendChild(trigger);
  }
  
  _addTab(text, classes, auraToolbar, keyboardShortcut) {
    const markup = document.createElement('a');
    markup.title = text+' ('+keyboardShortcut+')';
    markup.textContent = text;
    markup.classList.add('tab');
    var isMarkup = false;
    if (classes instanceof Array) {
      isMarkup = true;
      classes.forEach(function(cls) {
        markup.classList.add(cls);
      });
    } else {
      markup.classList.add(classes);
    }

    markup.addEventListener('click', function() {
      if (this.classList.value.indexOf('active') === -1) {
        // Open this counterpart!
        if (isMarkup) {
          auraToolbar._openFile('.cmp') || auraToolbar._openFile('.app') || auraToolbar._openFile('.evt') || auraToolbar._openFile('.lib');
        } else {
          auraToolbar._openFile(classes);
        }
      } else {
        // Do nothing!
        // console.debug('Clicks on active tab are ignored.');
      }
    });
    
    this.element.appendChild(markup);
    this.tabs.push(markup);
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }
  
  highlight(type) {
    this.tabs.forEach(function(tab) {
      if (tab.classList.value.indexOf(type) !== -1) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }
  
  hide(type) {
    this.tabs.forEach(function(tab) {
      if (tab.classList.value.indexOf(type) !== -1) {
        // This is the tab
        tab.classList.remove('shown');
      }
    });
  }
  
  show(type) {
    this.tabs.forEach(function(tab) {
      if (tab.classList.value.indexOf(type) !== -1) {
        // This is the tab
        tab.classList.add('shown');
      }
    });
  }

}
