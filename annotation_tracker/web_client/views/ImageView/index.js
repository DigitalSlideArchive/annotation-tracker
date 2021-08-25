import ImageView from '@girder/histomicsui/views/body/ImageView';
import { wrap } from '@girder/core/utilities/PluginUtils';
import _ from 'underscore';
import events from '@girder/histomicsui/events';

import Experiments from '../../panels/Experiments';
import activityLogger from '../../utility/activityLogger';
wrap(ImageView, 'initialize', function (initialize) {
    this.experiments = new Experiments({
        parentView: this
    });

    initialize.apply(this, _.rest(arguments));
    // Fetch folderID to use for looking for experiments metadata
    this.listenTo(this.model, 'g:fetched', () => {
        const folderId = this.model.get('folderId');
        if (folderId !== undefined) {
            this.experiments.setFolderId(folderId);
        } else {
            console.warn(`ResourceId: ${this.model.get('_id')} doesn't have a folderId and can't be checked for experiments`);
        }
    });
});

wrap(ImageView, 'render', function (render) {
    render.call(this);

    activityLogger.start(this);
    // Stop Session recording on Image change
    this.listenTo(events, 'h:imageOpened', () => this.experiments.stopSession());

    if (!this.$('.h-experiment-widget').length) {
        this.$('.h-control-panel-container')
            .removeClass('hidden')
            .append('<div id="h-experiment-panel" class="h-experiment-widget s-panel"></div>');
    }

    this.experiments
        .setElement('.h-experiment-widget')
        .render();
});

export default ImageView;
