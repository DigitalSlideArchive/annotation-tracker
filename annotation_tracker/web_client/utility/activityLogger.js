/* global geo */

import $ from 'jquery';
import { v4 as uuidv4 } from 'uuid';

import { getCurrentToken, getCurrentUser } from '@girder/core/auth';
import { getApiRoot } from '@girder/core/rest';
import events from '@girder/histomicsui/events';

/**
 * Given an HTML or jquery element, construct a selector that will identify it.
 *
 * @param elem: an HTML or jquery element.
 * @returns: a selector string.
 */
function targetSelector(elem) {
    elem = $(elem);
    let classList = [...elem[0].classList];
    let selector = elem.prop('nodeName').toLowerCase() + (
        elem.attr('id') ? '#' + elem.attr('id') : '') + (
        classList.length ? '.' + classList.join('.') : '');
    let parent = elem.parent();
    let siblings = parent.children(selector);
    if (siblings.length > 1) {
        let position = siblings.index(elem);
        selector += `:nth-child(${position + 1})`;
    }
    if (!parent.prop('nodeName')) {
        selector = '<no longer present> ' + selector;
    } else if (parent.prop('nodeName').toLowerCase() !== 'html') {
        selector = targetSelector(parent) + '>' + selector;
    }
    return selector;
}

let nameKey = 'annotation_tracker:';
let sessionId = uuidv4();
if (window.name && window.name.startsWith(nameKey)) {
    sessionId = window.name.substr(nameKey.length);
} else {
    window.name = nameKey + sessionId;
}

let activityLogger = {
    _debug: false,

    worker: new Worker('/static/built/plugins/annotation_tracker/worker.js'),
    sequenceId: parseInt(sessionStorage.getItem('annotation_tracker.sequenceId.' + sessionId) || 0, 10),

    start: function (view) {
        if (this._view === view) {
            return;
        }
        if (!window.name) {
            window.name = 'annotation_tracker';
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
        if (!this._started) {
            console.log(`Started annotation_tracker activityLogger, session ${sessionId}, sequenceId ${this.sequenceId}.`);
            console.log('Call window.activityLogger.debug set debugging');
            window.activityLogger = this;
            const oldonfocus = window.onfocus;
            const oldonblur = window.onblur;
            window.onfocus = () => {
                this.session('focus');
                if (oldonfocus) {
                    oldonfocus();
                }
            };
            window.onblur = () => {
                this.session('blur');
                if (oldonblur) {
                    oldonblur();
                }
            };
            $(document).on('visibilitychange', () => {
                this.session('visibilityState');
            });
            ['mousemove', 'mousedown', 'mouseup', 'keydown', 'keyup', 'click'].forEach((key) => {
                $(document).on(key, (evt) => {
                    this.eventTarget(evt, key);
                });
            });
            this._started = true;
        }
    },

    /**
     * Turn on or off debugging.
     *
     * @param val: false to disable debugging, true to log every activity to
     *      console, or a number to only log activities once per activity type
     *      per the specified value in milliseconds.
     */
    debug: function (val) {
        this._debug = val;
    },

    debug_log: function (entry) {
        if (!this._debug) {
            return;
        }
        if (!this._debug_records) {
            this._debug_records = {};
        }
        if (!this._debug_records[entry.activity]) {
            this._debug_records[entry.activity] = {last: 0, skipped: 0};
        }
        if (this._debug === true || Date.now() - this._debug_records[entry.activity].last > this._debug) {
            console.log(entry.activity, entry, this._debug_records[entry.activity]);
            this._debug_records[entry.activity] = {last: Date.now(), skipped: 0};
        } else {
            this._debug_records[entry.activity].skipped += 1;
        }
    },

    session: function (activity, properties) {
        let entry = {
            session: sessionId,
            sequenceId: (this.sequenceId += 1),
            epochms: Date.now(),
            activity: activity,
            currentImage: this._view.model.id,
            userId: (getCurrentUser() || {}).id,
            hasFocus: document.hasFocus(),
            visibilityState: document.visibilityState
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
        this.debug_log(entry);
        this.worker.postMessage({
            api: '/' + getApiRoot(),
            token: getCurrentToken(),
            log: [entry]
        });
        sessionStorage.setItem('annotation_tracker.sequenceId.' + sessionId, this.sequenceId);
    },

    eventTarget: function (evt, activity, properties) {
        let entry = Object.assign({}, {
            session: sessionId,
            sequenceId: (this.sequenceId += 1),
            epochms: Date.now(),
            activity: activity,
            target: targetSelector(evt.target),
            mouse: {x: evt.clientX, y: evt.clientY},
            page: {x: evt.pageX, y: evt.pageY},
            offset: {x: evt.offsetX, y: evt.offsetY}
        }, properties || {});
        ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'button', 'buttons', 'char', 'charCode', 'key', 'keyCode', 'which'].forEach((key) => {
            if (evt[key] !== undefined && evt[key] !== false && evt[key] !== 0) {
                entry[key] = evt[key];
            }
        });
        if ($(evt.target).closest('.h-image-view-container.geojs-map').length && this._map) {
            try {
                entry.image = this._map.displayToGcs(entry.offset);
            } catch (e) {
            }
        }
        this.debug_log(entry);
        this.worker.postMessage({
            log: [entry]
        });
        sessionStorage.setItem('annotation_tracker.sequenceId.' + sessionId, this.sequenceId);
    },

    log: function (activity, properties) {
        let entry = Object.assign({}, {
            session: sessionId,
            sequenceId: (this.sequenceId += 1),
            epochms: Date.now(),
            activity: activity
        }, properties || {});
        this.debug_log(entry);
        this.worker.postMessage({
            log: [entry]
        });
        sessionStorage.setItem('annotation_tracker.sequenceId.' + sessionId, this.sequenceId);
    }
};

export default activityLogger;
