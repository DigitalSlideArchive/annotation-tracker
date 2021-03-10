import _ from 'underscore';

import Panel from '@girder/slicer_cli_web/views/Panel';
import FolderModel from '@girder/core/models/FolderModel';

import experiments from './experiments.pug';
import activityLogger from '../../utility/activityLogger';

const Experiments = Panel.extend({
    events: _.extend(Panel.prototype.events, {
        'click .h-toggle-task': 'toggleTask',
        'click .h-task-radio': 'setCurrentTask'
    }),

    initialize() {
        this.running = false;
        this.current_experiment  = 0;
        this.current_task = 0;
        this.experiment = 'Loading...';
        this.task = '';
        this.complete = false;
        this.experiments = null;
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
            this.current_task = 0;    
            this.experiments =  metadata.experiments;
            this.experiment = this.experiments[this.current_experiment];
            this.task = this.experiment.tasks[this.current_task];
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
                currentTask: this.task,
                tasks: this.experiments[this.current_experiment].tasks || [],
                complete: this.complete
            }));
        }
        return this;
    },

    setCurrentTask(evt) {
        if (this.running) {
            this.running = !this.running;
            activityLogger.log('task', {running: this.running, task: this.task, experiment: this.experiment.name, 'taskAction': 'toggle'});
        }
        this.task = this.experiment.tasks[evt.target.value];
        this.render();
    },
    toggleTask(evt) {
        this.running = !this.running;
        activityLogger.log('task', {running: this.running, task: this.task, experiment: this.experiment.name, 'taskAction': 'toggle'});
        this.render();
    },

    advanceTask(evt) {
        this.current_task += 1;
        // This is really simplistic and will mostlikely become more complicated in the future
        if (!this.complete) {
            if (this.current_task >= this.experiments[this.current_experiment].tasks.length) {
                this.current_experiment += 1;
                this.current_task = 0;
            }
            if (this.current_experiment >= this.experiments.length) {
                this.current_experiment = 0;
                this.current_task = 0;
                this.complete = true;
            } else {
            this.task = this.experiments[this.current_experiment].tasks[this.current_task];
            this.experiment = this.experiments[this.current_experiment].name;
            }
        }

        activityLogger.log('experiment', {running: this.running, task: this.task, experiment: this.experiment, 'experimentAction': 'advanceTask'});
        this.render();
    }
});

export default Experiments;
