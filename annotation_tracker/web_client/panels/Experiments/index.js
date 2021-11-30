import _ from 'underscore';
import $ from 'jquery';

import Panel from '@girder/slicer_cli_web/views/Panel';
import FolderModel from '@girder/core/models/FolderModel';

import experiments from './experiments.pug';
import activityLogger from '../../utility/activityLogger';

import '../../styleSheets/panels/Experiments/experiments.styl';

const Experiments = Panel.extend({
    events: _.extend(Panel.prototype.events, {
        'click .h-toggle-task': 'toggleTask',
        'click .h-task-item': 'setCurrentTask',
        'click .h-next-task': 'nextTask',
        'click .experiment-section-list-header': '_toggleSectionList',
        'click .experiment-session-button': 'toggleSession',
        'input .experiment-user-input.experiment-section-list input': 'updateUserInput',
        'change .experiment-user-input.experiment-section-list input': 'updateUserInput',
        'blur .experiment-user-input.experiment-section-list input': 'updateUserInput'
    }),

    initialize() {
        this.running = false; // bool - current task running or stopped
        this.experimentIndex = 0; // int - index of current experiment
        this.experiment = null; //
        this.taskIndex = -1; // current indesk into task
        this.task = null; // task
        this.experiments = null; // List of experiments if we have more than one
        this.notify = ''; // nofitication button
        this.sectionExpanded = {
            'task': false,
            'description': false,
            'input': false
        }; // Utilized for toggling the different sections in the experiments panel
        this.sessionStarted = false;
        this.resizeObservers = []; // [observer, element]
    },
    observePanels() {
        this.resizeObservers = [];
        $('.s-panel').each((_index, element) => {
            const observer = new ResizeObserver((data) => {
                activityLogger.logPanelPositions();        
            });
            observer.observe(element);
            this.resizeObservers.push([observer, element]);
        });
    },
    unobservePanels() {
        this.resizeObservers.forEach(([observer, element]) => {
            observer.unobserve(element);
        })
    },
    setFolderId(folderId) {
        // fetch the metadata from the FolderID
        const folderModel = new FolderModel();
        folderModel.set({
            _id: folderId
        }).on('g:fetched', () => {
            this.meta = folderModel.get('meta');
            this.processMetadata(this.meta);
        }).on('g:error', () => {
            console.warn(`Error fetching metadata for folder: ${folderId}`);
        }, this).fetch();
    },

    processMetadata(metadata) {
        if (metadata.experiments !== undefined) {
            // TODO: JSON Schema validation at some point to ensure we have all necessary data
            this.experimentIndex = 0;
            this.experiments = metadata.experiments;
            this.experiment = this.experiments[this.experimentIndex];
            this.setKeyboardShortcuts();
            this.render();
        }
    },
    setKeyboardShortcuts() {
        const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        $(document).on('keydown', (evt) => {
            if (evt.key === 'Escape') {
                this.stopSession();
                evt.preventDefault();
            } else if (evt.key === ' ' || evt.key === 'Spacebar') {
                this.toggleTask();
                evt.preventDefault();
            } else if (evt.key === 'Enter') {
                this.nextTask();
                evt.preventDefault();
            } else if (numbers.includes(evt.key)) {
                const index = parseInt(evt.key, 10) - 1;
                if (index < this.experiment.tasks.length) {
                    if (this.sessionStarted) {
                        evt.preventDefault();
                        if (this.task !== this.experiment.tasks[index]) {
                            if (this.running) {
                                activityLogger.log('task', { running: this.running, task: this.task, experiment: this.experiment.name, taskAction: 'switch' });
                            }
                            this.task = this.experiment.tasks[index];
                            this.taskIndex = index;
                            activityLogger.log('task', { running: this.running, task: this.task, experiment: this.experiment.name, taskAction: 'set' });
                        }
                        this.render();
                    } else {
                        // Flash session button if trying to access a task when a session isn't started.
                        this.notify = 'experiment-session-button';
                        this.render();
                    }
                }
            }
        });
    },
    render() {
        // Lets not render until we have metadata or we have a future loading state?
        if (this.experiments) {
            this.$el.html(experiments({
                id: 'experiments-panel',
                running: this.running,
                experiment: this.experiment.name,
                taskIndex: this.taskIndex,
                currentTask: this.task,
                tasks: this.experiment.tasks || [],
                sectionExpanded: this.sectionExpanded,
                sessionStarted: this.sessionStarted,
                notify: this.notify
            }));
            this.notify = '';
        }
        return this;
    },
    setCurrentTask(evt) {
        if (this.sessionStarted) {
            const index = this.$(evt.currentTarget).data('task-index');
            if (index < this.experiment.tasks.length && this.task !== this.experiment.tasks[index]) {
                if (this.running) {
                    activityLogger.log('task', { running: this.running, task: this.task, experiment: this.experiment.name, taskAction: 'switch' });
                }
                this.task = this.experiment.tasks[index];
                this.taskIndex = index;
                activityLogger.log('task', { running: this.running, task: this.task, experiment: this.experiment.name, taskAction: 'set' });
                this.render();
            }
        } else {
            this.notify = 'experiment-session-button';
            this.render();
        }
    },
    toggleTask(evt) {
        if (this.sessionStarted) {
            this.running = !this.running;
            activityLogger.log('task', { running: this.running, task: this.task, experiment: this.experiment.name, taskAction: 'toggle' });
            this.render();
        }
    },
    nextTask() {
        if (this.sessionStarted) {
            if (this.taskIndex < this.experiment.tasks.length - 1) {
                if (this.running) {
                    activityLogger.log('task', { running: this.running, task: this.task, experiment: this.experiment.name, taskAction: 'switch' });
                }
                this.taskIndex += 1;
                this.task = this.experiment.tasks[this.taskIndex];
                activityLogger.log('task', { running: this.running, task: this.task, experiment: this.experiment.name, taskAction: 'set' });
                this.render();
            } else {
                this.stopTask();
                this.task = null;
                this.render();
            }
        } else {
            this.notify = 'experiment-session-button';
            this.render();
        }
    },
    stopTask(evt) {
        if (this.taskIndex !== -1) {
            this.running = false;
            activityLogger.log('task', { running: this.running, task: this.task, experiment: this.experiment.name, taskAction: 'stop' });
            this.taskIndex = -1;
            this.task = null;
            this.render();
        }
    },
    toggleSession(evt) {
        if (!this.sessionStarted) {
            this.startSession();
        } else {
            this.stopSession();
        }
    },
    startSession() {
        activityLogger.startSession({ experiment: this.experiment.name });
        this.taskIndex = 0;
        this.task = this.experiment.tasks[this.taskIndex];
        this.sessionStarted = true;
        this.sectionExpanded['task'] = true;
        this.observePanels();
        this.render();
    },
    stopSession() {
        activityLogger.stopSession({ experiment: (this.experiment || {}).name });
        this.sessionStarted = false;
        this.running = false;
        this.taskIndex = -1; // current indesk into task
        this.task = null; // task
        this.unobservePanels();
        this.render();
    },
    _toggleSectionList(evt) {
        const target = this.$(evt.currentTarget).data('target');
        if (this.sectionExpanded[target] !== undefined) {
            this.sectionExpanded[target] = !this.sectionExpanded[target];
        }
        this.render();
    },
    updateUserInput(evt) {
        const target = $(evt.target);
        const parent = target.closest('label[input_index]');
        const idx = parseInt(parent.attr('input_index'), 10);
        if (!this.task.userInput || !this.task.userInput[idx]) {
            return;
        }
        const record = this.task.userInput[idx];
        if (record.label !== parent.attr('name')) {
            return;
        }
        let val = target.is('[type="checkbox"]') ? target.is(':checked') : target.val();
        if (val !== record.value) {
            record.value = val;
            activityLogger.log('task', { running: this.running, task: this.task, experiment: this.experiment.name, taskAction: 'userInput' });
        }
    }
});

export default Experiments;
