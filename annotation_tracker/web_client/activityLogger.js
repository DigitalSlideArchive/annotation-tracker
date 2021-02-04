/* global geo */

import { v4 as uuidv4 } from 'uuid';
import { getCurrentToken, getCurrentUser } from '@girder/core/auth';
import { getApiRoot } from '@girder/core/rest';
import events from '@girder/histomicsui/events';

let activityLogger = {
    worker: new Worker('/static/built/plugins/annotation_tracker/worker.js'),
    sessionId: sessionStorage.getItem('annotation_tracker.sessionId') || uuidv4(),
    sequenceId: parseInt(sessionStorage.getItem('annotation_tracker.sequenceId') || 0, 10),

    start: function (view) {
        if (this._view === view) {
            return;
        }
        this._view = view;
        this._map = null;
        view.listenTo(events, 'h:imageOpened', (image) => {
            this.session('imageOpened');
            if (this._view.viewerWidget && this._view.viewerWidget.viewer && this._view.viewerWidget.viewer !== this._map) {
                this._map = this._view.viewerWidget.viewer;
                this._map.geoOn(geo.event.pan, () => this.session('pan'));
            }
        });
        sessionStorage.setItem('annotation_tracker.sessionId', this.sessionId);
        console.log('Started annotation_tracter activityLogger', this.sessionId, this.sequenceId);
    },

    session: function (reason) {
        let entry = {
            session: this.sessionId,
            sequenceId: (this.sequenceId += 1),
            epochms: Date.now(),
            activity: 'session',
            subactivity: reason,
            currentImage: this._view.model.id,
            userId: (getCurrentUser() || {}).id
            // :param hasFocus: boolean.  true if the tab has focus.
        };
        if (this._map) {
            let mapsize = this._map.size();
            entry.visibleArea = {
                tl: this._map.displayToGcs({x: 0, y: 0}),
                tr: this._map.displayToGcs({x: mapsize.width, y: 0}),
                bl: this._map.displayToGcs({x: 0, y: mapsize.height}),
                br: this._map.displayToGcs({x: mapsize.width, y: mapsize.height})
            };
            entry.imagePosition = {
                width: mapsize.width,
                height: mapsize.height,
                top: this._map.node().offset().top,
                left: this._map.node().offset().left
            };
            entry.rotation = this._map.rotation();
        }
        this.worker.postMessage({
            api: '/' + getApiRoot(),
            token: getCurrentToken(),
            log: [entry]
        });
        sessionStorage.setItem('annotation_tracker.sequenceId', this.sequenceId);
    },

    log: function (activity, properties) {
        console.log('log', activity, properties);
        this.worker.postMessage({
            log: [{
                session: this.sessionId,
                sequenceId: (this.sequenceId += 1),
                epochms: Date.now(),
                activity: activity // ,
                // ...properties
            }]
        });
        sessionStorage.setItem('annotation_tracker.sequenceId', this.sequenceId);
    }
};

export default activityLogger;
