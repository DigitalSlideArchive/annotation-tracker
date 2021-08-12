import _ from 'underscore';

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
        'click .experiment-section-list-header': '_toggleSectionList'
    }),

    initialize() {
        this.running = false; // bool - current task running or stopped
        this.experimentIndex = 0; // int - index of current experiment
        this.experiment = null; //
        this.taskIndex = -1; // current indesk into task
        this.task = null; // task
        this.experiments = null; // List of experiments if we have more than one
        this.sectionExpanded = {
            'task': false,
            'description': false,
            'input': false
        }; // Utilized for toggling the different sections in the experiments panel
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
            this.taskIndex = 0;
            this.experiments = metadata.experiments;
            this.experiment = this.experiments[this.experimentIndex];
            this.task = this.experiment.tasks[this.taskIndex];
            this.render();
        }
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
                sectionExpanded: this.sectionExpanded
            }));
        }
        return this;
    },
    setCurrentTask(evt) {
        if (this.running) {
            activityLogger.log('task', { running: this.running, task: this.task, experiment: this.experiment.name, 'taskAction': 'toggle' });
        }
        const index = this.$(evt.currentTarget).data('task-index');
        if (index < this.experiment.tasks.length) {
            this.task = this.experiment.tasks[index];
            this.taskIndex = index;
            this.render();
        }
    },
    toggleTask(evt) {
        this.running = !this.running;
        activityLogger.log('task', { running: this.running, task: this.task, experiment: this.experiment.name, 'taskAction': 'toggle' });
        this.render();
    },
    nextTask() {
        if (this.taskIndex < this.experiment.tasks.length - 1) {
            if (this.running) {
                activityLogger.log('task', { running: this.running, task: this.task, experiment: this.experiment.name, 'taskAction': 'toggle' });
            }
            this.taskIndex += 1;
            this.task = this.experiment.tasks[this.taskIndex];
            this.render();
        } else {
            this.stopExperiment();
            this.task = null;
            this.render();
        }
    },
    stopExperiment(evt) {
        if (this.taskIndex !== -1) {
            this.running = false;
            activityLogger.log('task', { running: this.running, task: this.task, experiment: this.experiment.name, 'taskAction': 'toggle' });
            this.taskIndex = -1;
            this.task = null;
            this.render();
        }
    },
    _toggleSectionList(evt) {
        const target = this.$(evt.currentTarget).data('target');
        if (this.sectionExpanded[target] !== undefined) {
            this.sectionExpanded[target] = !this.sectionExpanded[target];
        }
        this.render();
    }
});

export default Experiments;
