import ImageView from '@girder/histomicsui/views/body/ImageView';
import { wrap } from '@girder/core/utilities/PluginUtils';
import _ from 'underscore';

import Experiments from '../../panels/Experiments';

wrap(ImageView, 'initialize', function (initialize) {
  this.experiments = new Experiments({
    parentView: this,
  });

  initialize.apply(this, _.rest(arguments));
});

wrap(ImageView, 'render', function (render) {
  render.call(this);

  this.$('.h-control-panel-container')
    .removeClass('hidden')
    .append('<div id="h-experiment-panel" class="h-experiment-widget s-panel"></div>');

  this.experiments
    .setElement('.h-experiment-widget')
    .render();
});

export default ImageView;
