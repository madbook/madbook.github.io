/*
Ludum Dare 34
Growing, Two Button Controls
by u/madlee
no judgement
 */

var DEBUG = false;
var SKIP_INTRO = false;

var mainEl = document.querySelector('main');
var screenTemplate = document.querySelector('#screen-template');

// var eventName = 'ontouchstart' in window ? 'touchstart' : 'mousedown';
var eventName = 'click';

var titleScreen = mainEl.firstElementChild;
var currScreen = titleScreen;
var time = 7000;
var _t = {}

var colors = {
    dawn: '#FFB74D',
    morning: '#64B5F6',
    afternoon: '#1E88E5',
    evening: '#F57F17',
    dusk: '#9C27B0',
    night: '#311B92',
    midnight: '#263238',
};

var curColor;



var ScheduledEvent = function() { this.constructor.apply(this, arguments); }

ScheduledEvent.prototype = {
    constructor: function(app, time, fn) {
        this.app = app;
        this.time = time;
        this.fn = fn;
    },
}



var System = {
    name: 'System',

    mainEl: mainEl,
    screen: new Screen(),

    installed: true,
    icon: 'mascot.png',

    idle: false,
    idleAfter: 2000,
    idleTime: 0,

    tick: function(clock) {
        this.idleTime += TimeData.TICK;
        if (!this.idle && this.idleTime >= this.idleAfter) {
            this.idle = true;
            this.mainEl.classList.add('system-idle');
        }
    },

    touch: function() {
        if (this.idle) {
            this.idle = false;
            this.mainEl.classList.remove('system-idle');
            
            if (!UserProfiler.isAwake) {
                UserProfiler.sleepDisturbed += 1;
            }
        }
        this.idleTime = 0;
    },
}

System.mainEl.addEventListener(eventName, function(e) {
    System.touch();
});


var App = {
    name: 'Application',

    tick: function() {},

    launch: function() {},

    setInstallIcon: function(icon) {
        this.iconInstall = icon;
        if (this._installedAppView) {
            this._installedAppView.render(this);
        }
    },

    setDefaultIcon: function(icon) {
        this.iconDefault = icon;
    },

    setIcons: function(icon) {
        this.setInstallIcon(icon);
        this.setDefaultIcon(icon);
    },
};


var NotificationScheduler = {
    __proto__: App,

    name: 'Notifications',

    icon: 'toast.png',
    iconAlert: 'toast-alert.png',
    iconPrompt: 'toast-prompt.png',
    iconDebug: 'toast-debug.png',

    defaultOptions: {},
    installed: true,
    queue: [],

    tick: function(t) {
        var time = t.rawTime;
        this.queue.slice().forEach(function(event) {
            if (event.time === time) {
                this.unschedule(event);
                if (event.type !== "silent") {
                    var notif = this.notify(event);
                } else if (event.fn) {
                    event.fn(notif);
                }
            }
        }, this);
    },

    cancelAll: function(app) {
        this.queue.slice().forEach(function(event) {
            if (event.app === app) {
                this.unschedule(event);
            }
        }, this);
    },

    createNotification: function(app, options) {
        var name = options.name || app.name || NotificationScheduler.name;
        var type = options.type || 'notification';
        var description = options.description || '';
        var icon = options.icon || app.iconDefault || app.icon;
        var notif;
        if (type === 'prompt') {
            notif = new PromptNotification();
            System.touch();
        } else {
            notif = new Notification();
        }
        var state = NotificationData(name, description, icon, time);
        if (options.dismissText) {
            state.dismissText = options.dismissText;
        }
        if (options.completeText) {
            state.completeText = options.completeText;
        }
        notif.render(state);
        notif.animateIn(currScreen.notificationList);
        return notif;
    },

    notify: function(options, supressFn) {
        app = options.app || NotificationScheduler;
        options = options || app.defaultOptions || NotificationScheduler.defaultOptions;
        var notif = this.createNotification(app, options);

        if (options.fn && !supressFn) {
            options.fn(notif);
        }

        if (options.ttl) {
            var event = {
                app: NotificationScheduler,
                type: 'silent',
                icon: this.iconDebug,
                description: 'Scheduling <' + app.name + '> auto-dismiss for notification with TTL=' + options.ttl,
                time: TimeData.addTime(time, options.ttl),
                ttl: options.ttl || 1000,
                fn: function() {
                    notif.dismiss();
                },
            };

            notif.node.addEventListener('dismiss', function(e) {
                NotificationScheduler.unschedule(event);
            });
            NotificationScheduler.schedule(event);

            if (DEBUG && app !== NotificationScheduler) {
                NotificationScheduler.notify(event, true);
            }
        }

        return notif;
    },

    schedule: function(event) {
        this.queue.push(event);
    },

    unschedule: function(event) {
        var i = this.queue.indexOf(event);
        if (i >= 0) {
            this.queue.splice(i, 1);
            return true;
        }
    },

    callEvent: function(event) {
        if (this.unschedule(event)) {
            event.fn(event.app);
        }
    },
};



var AppManager = {
    __proto__: App,

    name: 'System',
    installed: true,

    icon: 'mascot.png',
    iconHappy: 'mascot-happy.png',
    iconShocked: 'mascot-shocked.png',

    queue: [],

    tick: function(clock) {
        this.queue.slice().forEach(function(app) {
            app.tick(clock);
        });
    },

    runDailyCron: function() {
        this.queue.slice().forEach(function(app) {
            if (app.dailyCron) {
                app.dailyCron();
            }
        });
    },

    runWeeklyCron: function() {
        this.queue.slice().forEach(function(app) {
            if (app.weeklyCron) {
                app.weeklyCron();
            }
        });
    },

    install: function(app, silent) {
        var i = this.queue.indexOf(app);
        if (i >= 0) { return; }
        this.queue.push(app);
        app.installed = true;
        if (!app.invisible) {
            currScreen.installApp(app);
        }
        if (!silent) {
            NotificationScheduler.notify({
                app: this,
                icon: this.iconHappy,
                description: 'Installed ' + app.name + '.',
                // ttl: 1000,
            });
        }
        if (app.install instanceof Function) {
            app.install();
        }
    },

    uninstall: function(app, silent) {
        var i = this.queue.indexOf(app);
        if (i < 0) { return; }
        this.queue.splice(i, 1);
        app.installed = false;
        if (!silent) {
            NotificationScheduler.notify({
                app: this,
                icon: this.iconShocked,
                description: 'Uninstalled ' + app.name + '.',
                // ttl: 1000,
            });
        }
        if (app.uninstall instanceof Function) {
            app.uninstall();
        }
    },
};



var SetupApp = {
    __proto__: App,

    name: 'Setup Assistant',
    icon: 'mascot.png',
    iconHappy: 'mascot-happy.png',
    installed: true,
    
    isReady: true,
    index: 0,

    tick: function(clock) {
        if (!this.isReady) { return; }

        this.isReady = false;
        var i = 0;

        switch (this.index) {
            case i++:
                return this.scheduleNext(500)
            case i++:
                this.setIcons(this.icon);
                this.notify('Welcome to your new oDroid phone!', 1500);
                this.notify('I\'ll help you get started.', 1500, 1000);
                return this.notifyNext('Tap on notifications to dismiss them.', 1500, 2000);
            case i++:
                this.setIcons(this.icon);
                return this.notifyNext('Some notifications will prompt you for input. Try tapping on this one!', 0, 500, 'prompt');
            case i++:
                this.notify('Good job!', 500, 500);
                this.notify('First, I\'ll install the Messager app.', 1000, 1000);
                this.notifyNext('Tap here to continue', 0, 2000);
                return;
            case i++:
                this.setIcons(this.iconHappy);
                AppManager.install(MessageApp);
                return this.scheduleNext(1000);
            case i++:
                this.setIcons(this.icon);
                this.notify('You can use the message app to stay in touch with friends and family!', 2000, 500);
                this.notify('I\'ll install the Alarm app to help manage your sleep schedule.', 1500, 1500);
                this.notifyNext('Tap here to continue.', 0, 2000);
                return;
            case i++:
                this.setIcons(this.iconHappy);
                AppManager.install(AlarmApp);
                return this.scheduleNext(500);
            case i++:
                this.setIcons(this.icon);
                this.notify('Tap the Alarm app\'s icon in the app tray to set an alarm.', 1500, 500);
                this.notify('I\'ll also install the Sleep Monitor app to help track your sleep habits.', 0, 1500);
                this.notifyNext('Tap here to continue', 0, 2000);
                return;
            case i++:
                this.setIcons(this.iconHappy);
                AppManager.install(SleepApp);
                return this.scheduleNext(500);
            case i++:
                this.setIcons(this.icon);
                this.notify('The Sleep Monitor keeps track of your sleeping activities.', 0, 500);
                this.notify('Getting a good night\'s sleep is important for your health.', 0, 1500);
                this.notify('Next, I\'ll install the Health app.  It monitors your overall well-being!', 0, 2500);
                this.notifyNext('Tap here to continue', 0, 2500);
                return;
            case i++:
                this.setIcons(this.iconHappy);
                AppManager.install(HealthApp);
                return this.scheduleNext(500);
            case i++:
                this.setIcons(this.icon);
                this.notify('The Health app tracks your fitness and overall well-being.', 0, 500);
                this.notify('Next, I\'ll install the Mood Ring app.  It will let you know if you\'re too stressed out!', 0, 1500);
                this.notifyNext('Tap here to continue', 0, 2000);
                return;
            case i++:
                this.setIcons(this.iconHappy);
                AppManager.install(MoodApp);
                return this.scheduleNext(500);
            case i++:
                this.setIcons(this.icon);
                this.notify('Finally, I\'ll install the Friends app. Keep up to date on what all of your friends are doing!', 0, 1000);
                this.notifyNext('Tap here to continue', 0, 2000);
                return;
            case i++:
                this.setIcons(this.iconHappy);
                AppManager.install(FriendsApp);
                return;
            default:
                AppManager.uninstall(this, true);
        }
    },

    next: function() {
        this.index = this.index + 1;
        this.isReady = true;
    },

    scheduleNext: function(delay) {
        NotificationScheduler.schedule({
            time: TimeData.addTime(time, delay),
            type: 'silent',
            fn: function() {
                this.next();
            }.bind(this),
        });
    },

    _notify: function(event, delay) {
        if (delay) {
            event.time = TimeData.addTime(time, delay);
            NotificationScheduler.schedule(event);
        } else {
            NotificationScheduler.notify(event);
        }
    },

    _notifyEvent: function(description, ttl, delay, type, completeText, dismissText) {
        return {
            app: this,
            type: type,
            description: description,
            // ttl: ttl,
            completeText: completeText,
            dismissText: dismissText,
        };
    },

    notify: function(description, ttl, delay, type, completeText, dismissText) {
        var event = this._notifyEvent.apply(this, arguments);
        return this._notify(event, delay);
    },

    notifyNext: function(description, ttl, delay, type, completeText, dismissText) {
        var event = this._notifyEvent.apply(this, arguments);
        event.fn = function(notif) {
            notif.node.addEventListener('dismiss', function(e) {
                this.next();
            }.bind(this));
        }.bind(this);
        return this._notify(event, delay);
    },
};



var CalendarApp = {
    name: 'Calendar',

    installed: false,

    dayNum: 0,
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    currDay: 'Sunday',

    tick: function(clock) {
        if (!clock.rawTime) {
            this.dayNum = this.dayNum + 1;
            this.currDay = this.days[this.dayNum % this.days.length];
            System.screen.title.textContent = this.currDay;
            AppManager.runDailyCron();
            if (this.currDay === 'Sunday') {
                AppManager.runWeeklyCron();
            }
        }
    },
}



var RelationshipManager = {
    __proto__: App,

    invisible: true,
    name: 'Jen',

    firstNames: ['Matt', 'Mark', 'Luke', 'John', 'Mat', 'Marc', 'Luc', 'Jon',
                 'Elizabeth', 'Liz', 'Beth', 'Sarah', 'Sara', 'Victoria', 'Vickie',
                 'Vicky', 'Vic', 'Tony', 'Toni', 'Anthony', 'Andy', 'Andrew',
                 'Andi', 'Drew', 'Bob', 'Robert', 'Bobby', 'Bobbi', 'Roberta',
                 'Carl', 'Karl', 'Carrie', 'Caroline', 'Debby', 'Debbi', 'Deborah',
                 'Deb', 'Charlie', 'Charles', 'Pam', 'Pamela', 'Pat', 'Patrick',
                 'Patricia', 'Don', 'Dawn', 'Spring', 'April', 'Autumn', 'Summer',
                 'Forest', 'Winter', 'River', 'Phoebe', 'Howard', 'Bruce'],

    queue: [],

    install: function() {
        // some family relationships
        this.createRelationship('Mom', true, 'close', 70, 75);
        this.createRelationship('Dad', true, 'close', 20, 40);
        this.createRelationship('Bro', true, 'close', 45, 90);
        this.createRelationship('Sis', true, 'friend', 25, 50);

        // some non-family relationships
        this.createRelationship(this.popName(), false, 'close', 50, 90);
        this.createRelationship(this.popName(), false, 'close', 35, 80);
        this.createRelationship(this.popName(), false, 'friend', 30, 85);
        this.createRelationship(this.popName(), false, 'friend', 15, 40);
    },

    popName: function() {
        var i = Math.floor(Math.random() * this.firstNames.length);
        var name = this.firstNames[i];
        this.firstNames.splice(i, 1);
        return name;
    },

    debuffPerson: function(person, c, r) {
        if (person.type === 'close') {
            person.connected -= 0.5 * c;
            person.relationship -= 0.5 * r;
            if (person.connected <= 33) {
                person.connected -= 3 * c;
                UserProfiler.update({ connected: -3 });
                person.type === 'friend';
            }
        } else if (person.type === 'friend') {
            person.connected -= 0.5 * c;
            person.relationship -= r;
            if (person.connected <= 10) {
                person.connected -= 2 * c;
                UserProfiler.update({ connected: -2 });
                person.type = 'acquaintance';
            }
        } else if (person.type === 'acquaintance') {
            person.connected -= 0.25;
            person.relationship -= 2 * r;
            if (person.connected <= 1) {
                person.connected = 1;
                UserProfiler.update({ connected: -1 });
                person.type = 'forgotten';
            }
        }
    },

    buffPerson: function(person) {
        if (person.type === 'forgotten') {
            person.connected += 1;
            UserProfiler.update({ connected: 2 });
            person.type = 'acquaintance';
        } else if (person.type === 'acquaintance') {
            person.connected += 0.5;
            if (person.connected > 10) {
                UserProfiler.update({ connected: 4 });
                person.connected += 2;
            }
        } else if (person.type === 'friend') {
            person.connected += 1;
            if (persson.connected > 33) {
                person.connected += 3;
                UserProfiler.update({ connected: 6 });
            }
        } else if (person.type === 'close') {
            person.connected += 1;
            person.connected = Math.min(100, person.connected);
        }
    },

    dailyCron: function() {
        this.queue.slice().forEach(function(person) {
            if (!MessageApp.installed || Math.random() > person.connected / 100) {
                return this.debuffPerson(person, 1, 0);
            }

            var randTime = 10000 + (Math.random() * 10000);
            randTime = Math.round(randTime / TimeData.TICK) * TimeData.TICK;
            if (person.isFamily) { randTime -= 2000; }
            else if (person.type === 'close') { randTime += 2000; }

            var ttl = 4000;
            if (person.type === 'close') { ttl -= 1000; }
            if (person.isFamily) { ttl -= 1000; }

            NotificationScheduler.schedule({
                app: MessageApp,
                description: 'Message from ' + person.name,
                type: 'prompt',
                time: randTime,
                ttl: ttl,
                completeText: 'Reply',
                dismissText: 'Ignore',
                fn: function(notif) {
                    if (person.name === 'Mom' || person.name === 'Dad') {
                        UserProfiler.update({ relaxed: -2 });
                    }

                    notif.node.addEventListener(function(e) {
                        if (e.detail.completed) {
                            this.buffPerson(person, 1, 1);
                        } else {
                            this.debuffPerson(person, 1, 1);
                        }
                    }.bind(this));
                }.bind(this),
            })
        }, this);
    },

    createRelationship: function(name, isFamily, type, connection, relationship) {
        this.queue.push({
            name: name,
            isFamily: !!isFamily,
            connected: connection,
            relationship: relationship,
            type: type,
        });
    },
};


var UserProfiler = {
    __proto__: App,

    name: 'Account',

    installed: false,
    isAwake: true,
    awakeTime: 0,
    sleepTime: 0,
    sleepDisturbed: 0,
    maxSleepDisturbances: 4,
    wakeUpSignal: false,

    idealAwakeTime: 16000,
    idealSleepTime: 8000,
    minAwakeTime: 12000,
    minSleepTime: 6000,
    maxAwakeTime: 20000,
    maxSleepTime: 10000,

    cannotSleepBefore: 20000, // cannot go to sleep before
    mustSleepAfter: 4000, // fall asleep if after
    mustWakeUpAfter: 13000, // wake up if after
    cannotWakeUpBefore: 4000, // cannot wake up before

    stats: {
        // tracked via mood app
        relaxed: 50, // re stress, stressed -> relaxed
        // happy: 50, // re happiness, sad -> happy
        
        // tracked via health app
        healthy: 50, // re fitness, unhealthy -> healthy
        // rested: 50, // re sleep, tired -> rested
        
        // tracked via friends app
        connected: 50, // re family, disconnected -> connected
        // popular: 50, // re friends, unpopular -> popular

        // tracked via work app
        // productive: 50, // unproductive -> productive

        // tracked via bank app
        // funds: 100, // absolute amount
    },

    tick: function(clock) {
        if (this.isAwake) {
            this.awakeTime += TimeData.TICK;

            var test = this.canSleep(clock.rawTime);

            if (test[0]) {
                if (test[1] === 'random') {
                    // TODO
                } else {
                    this.goToSleep(test[1]);
                }
            }
        } else {
            this.sleepTime += TimeData.TICK;

            var test = this.canWakeUp(clock.rawTime);

            if (test[0]) {
                if (test[1] === 'random') {
                    // TODO
                } else {
                    this.wakeUp(test[1])
                }
            }
        }
    },

    canWakeUp: function(time) {
        if (this.isAwake) {
            return [false, 'already awake'];
        } if (this.sleepTime >= this.maxSleepTime) {
            return [true, 'slept too long'];
        } else if (this.sleepTime <= this.minSleepTime) {
            return [false, 'not slept enough'];
        } else if (time >= this.mustWakeUpAfter) {
            return [true, 'slept too late'];
        } else if (time < this.cannotWakeUpBefore) {
            return [false, 'too early'];
        } else if (this.sleepDisturbed >= this.maxSleepDisturbances) {
            return [true, 'sleep too disturbed'];
        } else if (this.wakeUpSignal) {
            return [true, 'wake up signaled'];
        } else {
            return [true, 'random'];
        }
    },

    canSleep: function(time) {
        if (!this.isAwake) {
            return [false, 'already asleep'];
        } else if (this.awakeTime >= this.maxAwakeTime) {
            return [true, 'awake too long'];
        } else if (this.awakeTime <= this.minAwakeTime) {
            return [false, 'not awake long enough'];
        } else if (time >= this.mustSleepAfter && time < this.mustWakeUpAfter) {
            return [true, 'awake too late'];
        } else if (time < this.cannotSleepBefore) {
            return [false, 'not late enough'];
        } else if (System.idle) {
            return [true, 'idle'];
        } else {
            return [true, 'random']
        }
    },

    update: function(stats) {
        for (var key in stats) {
            if (key in this.stats) {
                this.stats[key] += stats[key];
            }
        }
    },

    goToSleep: function(reason) {
        if (SleepApp.installed) {
            SleepApp.setAsleep(reason, this.awakeTime);
        }

        this.isAwake = false;
        this.sleepTime = 0;
        this.sleepDisturbed = 0;
        this.wakeUpSignal = false;
    },

    wakeUp: function(reason) {
        if (SleepApp.installed) {
            SleepApp.setAwake(reason, this.sleepTime);
        }

        var ratio = this.sleepTime / this.awakeTime;
        var sum = this.sleepTime + this.awakeTime;
        
        var buff = 2;
        
        if (ratio < 0.4) {
            buff -= 1;
        } if (ratio > 0.6) {
            buff -= 1;
        }
        
        if (sum > 25000 || sum < 23000) {
            buff -= 1;
        }

        // these should be adjusted to somewhere in between min / ideal / max
        if (this.sleepTime <= this.minSleepTime || this.awakeTime >= this.maxAwakeTime) {
            buff -= 2;
        }
        if (this.awakeTime <= this.minAwakeTime || this.sleepTime >= this.maxSleepTime) {
            buff -= 1;
        }
        if (this.sleepDisturbed) {
            buff -= this.sleepDisturbed * 2;
        }

        this.update({
            healthy: buff,
            relaxed: buff,
        });

        this.isAwake = true;
        this.awakeTime = 0;
    },
};



var AlarmApp = {
    __proto__: App,

    name: 'Alarm',

    icon: 'alarm.png',
    iconPrompt: 'alarm-prompt.png',
    iconSnooze: 'alarm-snooze.png',
    iconIdle: 'alarm-waiting.png',

    introSeen: false,
    isAlarmSet: false,
    isPromptUp: false,

    snoozes: 0,
    maxSnoozes: 3,
    alarmTime: 7000,

    launch: function() {
        if (!this.introSeen) {
            this.introSeen = true;

            NotificationScheduler.notify({
                app: this,
                description: 'Alarm app will help you maintain a healthy sleep schedule',
                time: TimeData.addTime(time, 2000),
                // ttl: 1000,
            });
        }

        if (this.isAlarmSet) {
            this.notifyAlarmSet(this.alarmTime);
        } else if (!this.isPromptUp) {
            this.setIcons(this.iconPrompt);
            this.promptSetAlarm(this.alarmTime);
        }
    },

    notifyAlarmSet: function(time) {
        return NotificationScheduler.notify({
            app: this,
            icon: this.icon,
            description: 'Alarm set for ' + TimeData.formatTime(time),
            // ttl: 1000,
        });
    },

    promptSetAlarm: function(alarmTime) {
        this.isPromptUp = true;
        return NotificationScheduler.notify({
            app: this,
            type: 'prompt',
            icon: this.iconPrompt,
            description: 'Set alarm for ' + TimeData.formatTime(alarmTime) + '?',
            completeText: 'Set alarm',
            dismissText: 'Cancel',
            fn: function(notif) {
                notif.node.addEventListener('dismiss', function(e) {
                    this.isPromptUp = false;
                    if (e.detail.completed) {
                        this.isAlarmSet = true;
                        this.setIcons(this.iconIdle);
                        this.scheduleWakeEvent(alarmTime);
                        this.notifyAlarmSet(alarmTime);
                    } else {
                        this.setIcons(this.icon);
                    }
                }.bind(this));
            }.bind(this),
        });
    },

    scheduleWakeEvent: function(t) {
        return NotificationScheduler.schedule({
            app: this,
            type: 'prompt',
            icon: this.icon,
            time: t,
            description: 'Wake up!',
            ttl: 750,
            completeText: 'Turn off',
            dismissText: 'Snooze',
            fn: function(notif) {
                this.setInstallIcon(this.iconIdle);

                notif.node.addEventListener('dismiss', function(e) {
                    if (!e.detail.completed) {
                        if (!UserProfiler.isAwake) {
                            UserProfiler.sleepDisturbed += 1;
                            UserProfiler.wakeUpSignal = 1;
                        }

                        // snooze
                        this.snoozes = this.snoozes + 1;
                        if (this.snoozes >= this.maxSnoozes) {
                            this.isReady = true;
                            this.snoozes = 0;
                            this.setInstallIcon(this.icon);
                            this.isAlarmSet = false;
                        } else {
                            this.scheduleWakeEvent(TimeData.addTime(time, 500));
                            this.setInstallIcon(this.iconSnooze);
                        }
                    } else {
                        this.isAlarmSet = false;
                        UserProfiler.sleepDisturbed += 1;
                        this.setInstallIcon(this.icon);
                    }
                }.bind(this));
            }.bind(this),
        });
    },

    scheduleReadyEvent: function(time) {
        return NotificationScheduler.schedule({
            app: this,
            time: time,
            type: 'silent',
            fn: function() {
                this.isReady = true;
                this.setInstallIcon(this.icon);
            }.bind(this),
        });
    },
};



var MessageApp = {
    __proto__: App,

    name: 'Messager',

    icon: 'messages.png',
    iconTyping: 'messages-typing.png',
    iconPrompt: 'messages-prompt.png',

    contactsImported: false,

    tick: function(clock) {
    },

    install: function() {
        NotificationScheduler.schedule({
            app: this,
            icon: this.iconTyping,
            time: TimeData.addTime(time, 250),
            // ttl: 500,
            description: RelationshipManager.queue.length + ' contacts have been imported.',
            fn: function(notif) {
                notif.node.addEventListener('dismiss', function(e) {
                    this.contactsImported = true;
                }.bind(this));
            }.bind(this),
        });
    },
};



var HealthApp = {
    __proto__: App,

    name: 'Health',

    icon: 'health.png',
    iconUp: 'health-plus.png',
    iconDown: 'health-minus.png',

    currentState: 'normal',

    tick: function(clock) {
    },

    launch: function() {
        NotificationScheduler.notify({
            app: this,
            description: 'Current health status: ' + (this.currentState === 'up' ? 'good' : this.currentState === 'down' ? 'bad' : 'normal'),
            // ttl: 1000,
        });
    },

    dailyCron: function() {
        var health = UserProfiler.stats.healthy;
        var state = health < 40 ? 'down' : health > 60 ? 'up' : 'normal';
        if (state !== this.currentState) {
            this.currentState = state;
            this.setInstallIcon(state === 'down' ? this.iconDown : state === 'up' ? this.iconUp : this.icon);
        }
    },
};



var FriendsApp = {
    __proto__: App,

    name: 'Friends',

    icon: 'friends.png',
    iconUp: 'friends-plus.png',
    iconDown: 'friends-minus.png',
    iconPrompt: 'friends-prompt.png',

    currentState: 'normal',

    tick: function(clock) {
    },

    launch: function() {
        NotificationScheduler.notify({
            app: this,
            description: 'You have ' + RelationshipManager.queue.length + ' friends',
            // ttl: 1000,
        });
    },

    dailyCron: function() {
        var health = UserProfiler.stats.connected;
        var state = health < 40 ? 'down' : health > 60 ? 'up' : 'normal';
        if (state !== this.currentState) {
            this.currentState = state;
            this.setInstallIcon(state === 'down' ? this.iconDown : state === 'up' ? this.iconUp : this.icon);
        }
    },
};



var MoodApp = {
    __proto__: App,

    name: 'Mood Ring',

    icon: 'mood.png',
    iconUp: 'mood-relaxed.png',
    iconDown: 'mood-stressed.png',

    currentState: 'normal',

    launch: function() {
        NotificationScheduler.notify({
            app: this,
            description: 'Current mood: ' + (this.currentState === 'up' ? 'relaxed' : this.currentState === 'down' ? 'stressed' : 'calm'),
            // ttl: 1000,
        });
    },

    dailyCron: function() {
        var health = UserProfiler.stats.relaxed;
        var state = health < 40 ? 'down' : health > 60 ? 'up' : 'normal';
        if (state !== this.currentState) {
            this.currentState = state;
            this.setInstallIcon(state === 'down' ? this.iconDown : state === 'up' ? this.iconUp : this.icon);
        }
    },
};



var SleepApp = {
    __proto__: App,
    name: 'Sleep Monitor',

    icon: 'sleep.png',
    iconIdle: 'sleep-idle.png',

    install: function() {
        if (UserProfiler.isAwake) {
            this.setIcons(this.iconIdle);
        } else {
            this.setIcons(this.icon);
        }
    },

    launch: function() {
        NotificationScheduler.notify({
            app: this,
            description: 'User is ' + (UserProfiler.isAwake ? 'awake' : 'asleep'),
            // ttl: 1000,
        });
    },

    setAsleep: function(reason, awakeTime) {
        this.setIcons(this.icon);
        var t = TimeData(awakeTime);
        var timeStr = t.rawHours + 'h ' + t.rawMinutes + 'm';
        NotificationScheduler.notify({
            app: this,
            description: 'Goodnight! You were awake for ' + timeStr,// + ' (' + reason + ')',
            // ttl: 1000,
        });
    },

    setAwake: function(reason, sleepTime) {
        this.setIcons(this.iconIdle);
        var t = TimeData(sleepTime);
        var timeStr = t.rawHours + 'h ' + t.rawMinutes + 'm';
        NotificationScheduler.notify({
            app: this,
            description: 'Goodmorning! You slept for ' + timeStr,// + ' (' + reason + ')',
            // ttl: 1000,
        });
    },
};



function TimeData(time) {
    return TimeData.updateTimeData(time, {});
}

TimeData.__proto__ = {
    __proto__: Function.__proto__,

    BASE: 1000,
    TICK: 5,

    addTime: function(base, add) {
        return (base + add) % (24 * TimeData.BASE);
    },

    formatTime: function(time) {
        var data = TimeData(time);
        return data.hours + ':' + data.minutes + data.whichM;   
    },

    updateTimeData: function(time, data) {
        var rawMinutes = Math.floor((time % TimeData.BASE) * 60 / TimeData.BASE);
        var minutes = (100 + rawMinutes).toString().slice(1);
        var hours = Math.floor(time / TimeData.BASE);
        var whichM = hours >= 11 ? 'PM' : 'AM';
        data.rawTime = time;
        data.rawHours = hours;
        data.rawMinutes = rawMinutes;
        hours = hours % 12;
        hours = hours || 12;
        data.hours = hours;
        data.minutes = minutes;
        data.whichM = whichM;
        return data;
    },
};



function NotificationData(name, description, icon, time) {
    return {
        name: name,
        description: description,
        icon: icon,
        timeState: TimeData(time),
    };
}



currScreen.addEventListener(eventName, transitionToGameScreen);

function transitionToGameScreen() {
    var nextScreen = System.screen;

    currScreen.addEventListener('animationend', onTransitionOut, false);
    currScreen.classList.add('fade-out');
    currScreen.classList.remove('active');
    
    nextScreen.animateIn(mainEl);
    currScreen = nextScreen;

    AppManager.install(RelationshipManager, 'silent');
    
    if (SKIP_INTRO) {
        AppManager.install(MessageApp, 'silent');
        AppManager.install(AlarmApp, 'silent');
        AppManager.install(SleepApp, 'silent');
        AppManager.install(HealthApp, 'silent');
        AppManager.install(MoodApp, 'silent');
        AppManager.install(FriendsApp, 'silent');
    } else {
        AppManager.install(SetupApp, 'silent');
    }

    requestAnimationFrame(gameLoop);
}

function onTransitionOut(e) {
    e.target.removeEventListener('animationend', arguments.callee);
    e.target.parentElement.removeChild(e.target);
}

function onTransitionIn(e) {
    e.target.removeEventListener('animationend', arguments.callee);
    e.target.classList.remove('fade-in');
    e.target.classList.remove('slide-down');
    e.target.classList.add('active');
}

function getColor(timeData) {
    var h = timeData.rawHours;

    if (h < 3 ) { return "midnight" }
    if (h < 6 ) { return "night" }
    if (h < 12) { return "morning" }
    if (h < 18 ) { return "afternoon" }
    if (h < 19 ) { return "dusk" }
    if (h < 23 ) { return "night" }
    else { return "midnight" }
}

function gameLoop() {
    time = TimeData.addTime(time, TimeData.TICK);
    var color = getColor(_t);
    if (color !== curColor) {
        curColor = color;
        mainEl.style.backgroundColor = colors[curColor];
    }
    TimeData.updateTimeData(time, _t);
    
    currScreen.render({
        time: _t,
    });
    
    System.tick(_t);
    NotificationScheduler.tick(_t);
    
    if (!UserProfiler.installed) {
        UserProfiler.tick(_t);
    }
    if (!CalendarApp.installed) {
        CalendarApp.tick(_t);
    }

    AppManager.tick(_t);

    requestAnimationFrame(gameLoop);
}
