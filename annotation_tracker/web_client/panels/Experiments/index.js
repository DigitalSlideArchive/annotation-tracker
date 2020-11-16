import { View } from 'backbone';
import Panel from '@girder/slicer_cli_web/views/Panel';
import experiments from './experiments.pug';

const Experiments = Panel.extend({
  initialize() {
    console.log('Experiments.initialize()');
  },

  render() {
    this.$el.html(experiments({
      id: 'experiments-panel',
    }));

    return this;
  },
});

export default Experiments;
