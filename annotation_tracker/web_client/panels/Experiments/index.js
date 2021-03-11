import _ from 'underscore';

import Panel from '@girder/slicer_cli_web/views/Panel';
import FolderModel from '@girder/core/models/FolderModel';

import experiments from './experiments.pug';
import activityLogger from '../../utility/activityLogger';

import '../../styleSheets/panels/Experiments/experiments.styl';

const Experiments = Panel.extend({
    events: _.extend(Panel.prototype.events, {
        'click .h-toggle-task': 'toggleTask',
        'click .h-stop-experiment': 'stopExperiment',
        'click .h-task-item': 'setCurrentTask',
        'click .experiment-section-list-header': '_toggleSectionList'

    }),

    initialize() {
        this.running = false;
        this.current_experiment  = 0;
        this.current_task = 0;
        this.experiment = 'Loading...';
        this.task = null;
        this.complete = false;
        this.experiments = null;
        this.taskExpanded = false;
        this.sectionExpanded = {
            'task': false,
            'description': false,
            'input': false
        };
    },

    setFolderId(folderId) {
        //fetch the metadata from the FolderID
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
            this.current_experiment  = 0;
            this.taskIndex = 0;    
            this.experiments =  metadata.experiments;
            this.experiment = this.experiments[this.current_experiment];
            this.task = this.experiment.tasks[this.taskIndex];
            this.complete = false;
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
                tasks: this.experiments[this.current_experiment].tasks || [],
                complete: this.complete,
                sectionExpanded: this.sectionExpanded
            }));
        }
        return this;
    },

    setCurrentTask(evt) {
        if (this.running) {
            this.running = !this.running;
            activityLogger.log('task', {running: this.running, task: this.task, experiment: this.experiment.name, 'taskAction': 'toggle'});
        }
        const index = $(evt.currentTarget).data('task-index')
        if (index < this.experiment.tasks.length){
            this.task = this.experiment.tasks[index];
            this.taskIndex = index;
            this.render();
        }
    },
    toggleTask(evt) {
        this.running = !this.running;
        activityLogger.log('task', {running: this.running, task: this.task, experiment: this.experiment.name, 'taskAction': 'toggle'});
        this.render();
    },
    stopExperiment(evt) {
        if (this.taskIndex !== -1){
            this.running = false;
            activityLogger.log('task', {running: this.running, task: this.task, experiment: this.experiment.name, 'taskAction': 'toggle'});
            this.taskIndex = -1;
            this.task = null;
            this.render();    
        }
    },
    _toggleSectionList(evt) {
        const target = $(evt.currentTarget).data('target');
        console.log(`Target ${target}`);
        if (this.sectionExpanded[target] !== undefined) {
            this.sectionExpanded[target] = !this.sectionExpanded[target]
        }
        this.render();
    }
});

export default Experiments;
