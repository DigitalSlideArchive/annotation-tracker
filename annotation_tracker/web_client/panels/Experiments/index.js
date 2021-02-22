import _ from 'underscore';

import Panel from '@girder/slicer_cli_web/views/Panel';
import FolderModel from '@girder/core/models/FolderModel';

import experiments from './experiments.pug';
import activityLogger from '../../utility/activityLogger';

const Experiments = Panel.extend({
    events: _.extend(Panel.prototype.events, {
        'click .h-toggle-experiment': 'toggleExperiment',
        'click .h-advance-task': 'advanceTask'
    }),

    initialize(spec) {
        this.running = false;
        this.current_experiment  = 0;
        this.current_task = 0;
        this.experiment = 0;
        this.task = 0;
        this.complete = false;
        this.meta = {}

    

    },
    setFolderId(folderId) {
        //fetch the metadata from the FolderID
        const folderModel = new FolderModel();
        folderModel.set({
            _id: folderId
        }).on('g:fetched', () => {
            this.meta = folderModel.get('meta');
            //Now we can process the metadata for tasks
            this.processMetadata(this.meta);

        }).on('g:error', () => {
            console.log('error getting folder data');
        }, this).fetch();
    },
    processMetadata(metadata) {
        if (metadata["Experiments"]) {
            this.experiments =  metadata["Experiments"];
            this.experiment = this.experiments[this.current_experiment].name;
            this.task = this.experiments[this.current_experiment].tasks[this.current_task];
            this.complete = false;
            this.render();
        }
    },
    render() {

        this.$el.html(experiments({
            id: 'experiments-panel',
            running: this.running,
            experiment: this.experiment,
            task: this.task,
            complete: this.complete
        }));

        return this;
    },

    toggleExperiment(evt) {
        this.running = !this.running;
        activityLogger.log('experiment', {running: this.running, task: this.task, experiment: this.experiment, 'experimentAction': 'toggle'});
        this.render();
    },

    advanceTask(evt) {
        this.current_task += 1;
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
