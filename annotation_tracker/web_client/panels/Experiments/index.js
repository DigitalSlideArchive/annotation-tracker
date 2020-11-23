import { View } from 'backbone';
import Panel from '@girder/slicer_cli_web/views/Panel';
import experiments from './experiments.pug';

const Experiments = Panel.extend({
  events: _.extend(Panel.prototype.events, {
    'click .h-toggle-experiment': 'toggleExperiment',
    'click .h-advance-task': 'advanceTask',
  }),

  initialize() {
    console.log('Experiments.initialize()');

    this.running = false;
    this.task = 0;
  },

  render() {
    this.$el.html(experiments({
      id: 'experiments-panel',
      running: this.running,
      task: this.task,
    }));

    return this;
  },

  toggleExperiment(evt) {
    this.running = !this.running;
    this.render();
  },

  advanceTask(evt) {
    this.task += 1;
    this.render();
  },
});

export default Experiments;
