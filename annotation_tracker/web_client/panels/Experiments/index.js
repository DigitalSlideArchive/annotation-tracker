import _ from 'underscore';

import Panel from '@girder/slicer_cli_web/views/Panel';

import experiments from './experiments.pug';
import activityLogger from '../../utility/activityLogger';

const Experiments = Panel.extend({
    events: _.extend(Panel.prototype.events, {
        'click .h-toggle-experiment': 'toggleExperiment',
        'click .h-advance-task': 'advanceTask'
    }),

    initialize() {
        console.log('Experiments.initialize()');

        this.running = false;
        this.experiment = 0;
        this.task = 0;
    },

    render() {
        this.$el.html(experiments({
            id: 'experiments-panel',
            running: this.running,
            experiment: this.experiment,
            task: this.task
        }));

        return this;
    },

    toggleExperiment(evt) {
        this.running = !this.running;
        activityLogger.log('experiment', {running: this.running, task: this.task, experiment: this.experiment, 'experimentAction': 'toggle'});
        this.render();
    },

    advanceTask(evt) {
        this.task += 1;
        if (this.task > 3) {
            this.experiment += 1;
            this.task = 0;
        }

        activityLogger.log('experiment', {running: this.running, task: this.task, experiment: this.experiment, 'experimentAction': 'advanceTask'});
        this.render();
    }
});

export default Experiments;
