import ImageView from '@girder/histomicsui/views/body/ImageView';
import { wrap } from '@girder/core/utilities/PluginUtils';
import _ from 'underscore';

wrap(ImageView, 'initialize', function (initialize) {
  initialize.apply(this, _.rest(arguments));

  console.log('custom initialize logic');
});

wrap(ImageView, 'render', function (render) {
  render.call(this);

  console.log('custom render logic');
});

export default ImageView;
