
function Animateable() { this.constructor.apply(this, arguments); }

Animateable.prototype = {
    _animateInStyle: 'fade-in',
    _animateOutStyle: 'fade-out',

    constructor: function() {
    },

    animateIn: function(target, style) {
        style = style || this._animateInStyle;
        this.node.addEventListener('animationend', onTransitionIn, false);
        target.appendChild(this.node);
        this.node.classList.add(style);
        this.node.classList.remove('hidden');
    },

    animateOut: function(style) {
        style = style || this._animateOutStyle;
        this.node.addEventListener('animationend', onTransitionOut)
        this.node.classList.add(style);
    },
}


function Screen() { this.constructor.apply(this, arguments); }

Screen.__super__ = Animateable.prototype;

Screen.prototype = {
    __proto__: Animateable.prototype,

    _template: document.querySelector('#screen-template'),

    constructor: function() {
        var node = document.importNode(this._template, true).content.firstElementChild;

        this.apps = [];

        this.node = node;
        this.timeDisplay = new TimeDisplay();
        this.header = node.querySelector('header');
        this.header.appendChild(this.timeDisplay.node);
        this.installedApps = node.querySelector('.installed-app-icons');
        this.notificationList = node.querySelector('.notification-list');
        this.title = node.querySelector('.screen-title');
    },

    render: function(state) {
        this.apps.forEach(function(app) {
            if (app._rendered) { return; }
            this.installedApps.appendChild(app.node);
            app._rendered = true;
        }, this);

        if (state.time) {
            this.timeDisplay.render(state.time);
        }
    },

    installApp: function(app) {
        System.touch();
        var appView = new InstalledApp();
        appView.render(app);
        appView._rendered = true;
        this.apps.push(appView);
        appView.animateIn(this.installedApps);
        app._installedAppView = appView;
        appView._app = app;
    },
};




function Notification() { this.constructor.apply(this, arguments); }

Notification.__super__ = Animateable.prototype;

Notification.prototype = {
    __proto__: Animateable.prototype,

    _template: document.querySelector('#notification-template'),
    
    _animateInStyle: 'slide-down',
    _animateOutStyle: 'slide-up',

    dismissed: false,
    wasManuallyDismissed: false,

    constructor: function() {
        this.initializeNodes();
        this.delegateEvents();
    },

    initializeNodes: function() {
        var node = document.importNode(this._template, true).content.firstElementChild;
        var timeModel = new TimeDisplay();
        node.querySelector('header > h3').appendChild(timeModel.node);

        this.node = node;
        this.name = node.querySelector('.notification-name');
        this.description = node.querySelector('.notification-description');
        this.icon = node.querySelector('.notification-icon');
        this.timeModel = timeModel;
    },

    delegateEvents: function() {
        this.node.addEventListener(eventName, this.dismiss.bind(this), false);
    },

    render: function(state) {
        this.name.textContent = state.name;
        this.description.textContent = state.description;
        this.timeModel.render(state.timeState);
        if (state.icon) {
            this.icon.style.backgroundImage = 'url(' + state.icon + ')';
            this.icon.style.display = 'block';
        }
    },

    animateIn: function(target, style) {
        style = style || this._animateInStyle;
        this.node.addEventListener('animationend', function(e) {
            onTransitionIn(e);
        }.bind(this), false);

        this.node.style.visibility = 'none';
        target.insertBefore(this.node, target.firstElementChild);
        var rect = this.node.getBoundingClientRect();
        this.node.style.visibility = 'visible';    
        this.node.classList.add(style);
        this.node.classList.remove('hidden');
        setTimeout(function() {
            this.node.style.height = rect.height + 'px';
        }.bind(this))
    },

    dismiss: function(e) {
        if (this.dismissed) { return; }
        this.dismissed = true;
        
        e && e.stopImmediatePropagation();
        e && e.stopPropagation();
        e && e.preventDefault();

        // automatic dismissals will not have an event passed
        this.wasManuallyDismissed = !!e;
        if (this.wasManuallyDismissed) {
            System.touch();
        }
        var event = this._getDismissEvent();
        
        this.node.dispatchEvent(event, { bubbles: false });
        if (!event.defaultPrevented) {
            this.animateOut();
        }
    },

    _getDismissEvent: function() {
        return new CustomEvent('dismiss', {
            detail: {
                idled: !this.wasManuallyDismissed,
                dismissed: this.wasManuallyDismissed,
            },
        });
    },
};



function PromptNotification() { this.constructor.apply(this, arguments); }

PromptNotification.__super__ = Notification.prototype;

PromptNotification.prototype = {
    __proto__: Notification.prototype,

    _template: document.querySelector('#prompt-template'),

    wasCompleted: false,
    isOpen: false,

    initializeNodes: function() {
        PromptNotification.__super__.initializeNodes.apply(this, arguments);
        this.completeButton = this.node.querySelector('button[data-action=complete]');
        this.dismissButton = this.node.querySelector('button[data-action=dismiss]');
    },

    delegateEvents: function() {
        this.node.addEventListener(eventName, this.toggle.bind(this));
        this.completeButton.addEventListener(eventName, this.complete.bind(this));
        this.dismissButton.addEventListener(eventName, this.dismiss.bind(this))
    },

    toggle: function(e) {
        System.touch();
        e && e.stopPropagation();
        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            this.node.classList.add('expanded');
        } else {
            this.node.classList.remove('expanded');
        }
    },

    _getDismissEvent: function() {
        return new CustomEvent('dismiss', {
            detail: {
                idled: !this.wasCompleted && !this.wasManuallyDismissed,
                dismissed: !this.wasCompleted && this.wasManuallyDismissed,
                completed: this.wasCompleted,
            },
        });
    },

    complete: function(e) {
        System.touch();
        e && e.stopPropagation();
        this.wasCompleted = true;
        this.dismiss(e);
    },

    render: function(state) {
        PromptNotification.__super__.render.apply(this, arguments);
        if (state.dismissText) {
            this.dismissButton.textContent = state.dismissText;
        }
        if (state.completeText) {
            this.completeButton.textContent = state.completeText;
        }
    },
};



function InstalledApp() { this.constructor.apply(this, arguments); }

InstalledApp.__super__ = Animateable.prototype;

InstalledApp.prototype = {
    __proto__: Animateable.prototype,

    _template: document.querySelector('#installed-app-template'),

    constructor: function() {
        var node = document.importNode(this._template, true).content.firstElementChild;

        this.node = node;
        this.icon = node.querySelector('.icon');
        this.node.addEventListener(eventName, function(e) {
            if (this._app) {
                this._app.launch();
            }
        }.bind(this));
    },

    render: function(app) {
        this.icon.style.backgroundImage = 'url(' + (app.iconInstall || app.icon) + ')';
    },
};



function TimeDisplay() { this.constructor.apply(this, arguments); }

TimeDisplay.prototype = {
    _template: document.querySelector('#time-display-template'),

    constructor: function() {
        var node = document.importNode(this._template, true).content.firstElementChild;

        this.node = node;
        this.timeNode = node.querySelector('time');
        this.displayNode = node.querySelector('.display');
    },

    render: function(state) {
        this.timeNode.textContent = state.hours + ":" + state.minutes;
        this.displayNode.textContent = state.whichM;
    },
};
