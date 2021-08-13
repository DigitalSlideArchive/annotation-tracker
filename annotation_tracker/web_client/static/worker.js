/* A web worker to lazily send logs to the server. */

const timeGap = 10000; /* minimum ms between log transmissions */

let api, token;
let logsToSend = [];
let sendLogTimeout;
let sendLogs;

/**
 * The worker is started when it receives a message.
 *
 * @param {object} evt The event with posted data for the worker.
 * @param {object} evt.data Data for the worker.
 * @param {object} evt.data.api The Girder API url.
 * @param {object} evt.data.token The Girder access token.
 * @param {object} evt.data.log The list of logs to send.
 */
onmessage = function (evt) {
    sendLogs = function () {
        sendLogTimeout = null;
        const logs = logsToSend.slice(0, logsToSend.length);
        if (!logs.length || !api) {
            return;
        }
        sendLogTimeout = 'sending';
        fetch(api + '/annotation_tracker/log', {
            method: 'POST',
            cache: 'no-cache',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Girder-Token': token
            },
            body: JSON.stringify(logs)
        }).then((result) => {
            if (result.ok) {
                return result.json();
            }
            sendLogTimeout = setTimeout(sendLogs, timeGap);
            return null;
        }, () => {
            sendLogTimeout = setTimeout(sendLogs, timeGap);
            return null;
        }).then((result) => {
            sendLogTimeout = null;
            if (result && Object.keys(result).length) {
                logsToSend.splice(0, logs.length);
            }
            sendLogTimeout = setTimeout(sendLogs, timeGap);
            return null;
        }, () => {
            sendLogTimeout = setTimeout(sendLogs, timeGap);
            return null;
        });
    };

    api = evt.data.api || api;
    token = evt.data.token || token;
    evt.data.log.forEach((logentry) => {
        logsToSend.push(logentry);
    });
    if (!sendLogTimeout && logsToSend.length) {
        sendLogs();
    }
};
