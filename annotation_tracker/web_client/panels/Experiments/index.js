import { View } from 'backbone';
import experiments from './experiments.pug';

const Experiments = View.extend({
  initialize() {
    console.log('Experiments.initialize()');
  },

  render() {
    this.$el.html(experiments({
      id: 'experiments-panel',
    }));

    this.$('.s-panel-content')
      .collapse({
        toggle: false
      });

    return this;
  },
});

export default Experiments;
