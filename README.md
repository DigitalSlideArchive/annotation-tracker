# annotation-tracker
A Girder plugin for annotation activity tracking in HistomicsTK

## Build Instructions

1. Prepare and activate a virtual environment: `virtualenv --python python3 venv && source ./venv/bin/activate`.
2. Install the package in editable mode: `pip install -e .`.
3. Build the client: `girder build`.
4. Launch a Mongo server: `mongod`.
5. Run the client: `girder serve`.
6. Visit http://localhost:8080.

## Demo JSON

1. `examples/experiment.json` contains a demo JSON file
2. Add the JSON data onto the metadata for a Folder with the key value of `experiments`

## Logging

User actions and events are logged.  They are accessible via the `GET /annotation_tracker` endpoint.  A user is assigned an arbitrary session ID when they first open HistomicsUI and a new ID whenever they start a session via the user interface.

### Image change, session, and tab action activities

On all WSI image position changes (zoom, pan, window size change, rotate), an event is logged with a `pan` activity.  Additionally, when sessions are started or ended a `startSession` or `stopSession` activity is logged.  When the browser tab gains or loses focus, the `focus` or `blur` activity is logged.  When the browser window is hidden or becomes visible, a `visibilityState` activity is logged.

```
{
    session: <string: session id>,
    sequenceId: <integer: a monotonically increasing number for logged events in the current
                 session>,
    epochms: <integer: the current time in linux epoch milliseconds>,
    activity: <string: one of the events listed above>,
    currentImage: <string: girder image id>,
    userId: <string: girder user id, if a user is logged in>,
    hasFocus: <boolean: true if the browser tab has the focus>,
    visibilityState: <boolean: true if the browser tab is visible>,
    visableArea: {    // this is the part of the image visible in the window in WSI coordinates
      tl: { x: <number>, y: <number> },
      tr: { x: <number>, y: <number> },
      bl: { x: <number>, y: <number> },
      br: { x: <number>, y: <number> }
    },
    imagePosition: {
      width: <integer: width of the image display in screen pixels>,
      height: <integer: height of the image display in screen pixels>,
      top: <integer: position of the image display from the top of the browser tab's area in
            screen pixels>,
      left: <integer: position of the image display from the left of the browser tab's area in
             screen pixels>
    },
    rotation: <number: rotation in radians of the image>,
    zoom: <number: zoom level of the image: 0 is fully zoomed out, value is in powers of two>,
    panels: [    // a list of panels that cover part of the image view
      {
        title: <string: title of the panel>,
        width: <integer: width of the panel in screen pixels>,
        height: <integer: height of the panel in screen pixels>,
        top: <integer: position of the panel from the top of the browser tab's area in screen
              pixels>,
        left: <integer: position of the panel from the left of the browser tab's area in screen
               pixels>,
        coveredArea: {    // this is the area of the image covered by the panel in WSI coordinates
          tl: { x: <number>, y: <number> },
          tr: { x: <number>, y: <number> },
          bl: { x: <number>, y: <number> },
          br: { x: <number>, y: <number> }
        }
      },
      ...    // more panels
   ]
}
```

### General browser activities

Activities are logged on every `mousemove`, `mousedown`, `mouseup`, `keydown`, `keyup`, `click`.  These are only logged __if__ a session is started.

```
{
    session: <string: session id>,
    sequenceId: <integer: a monotonically increasing number for logged events in the current
                 session>,
    epochms: <integer: the current time in linux epoch milliseconds>,
    activity: <string: the activity being logged.  This is the web event (as listed above)>,
    target: <string: the css selector identifying where on the UI the mouse is currently located>,
    mouse: {
      x: <integer: the position of the mouse in pixels in the browser window (left is 0),
      y: <integer: the position of the mouse in pixels in the browser window (top is 0)
    },
    page: {
      x: <integer: the position of the mouse in pixels in the browser window (left is 0),
      y: <integer: the position of the mouse in pixels in the browser window (top is 0)
    },
    offset: {
      x: <integer: the position of the mouse in pixels in the containing element (left is 0),
      y: <integer: the position of the mouse in pixels in the containing element (top is 0)
    },
    image: {    // this is only present if the mouse is over the WSI
      x: <number: the position of the mouse in the whole slide image in image coordinates; the
          range depends on the size of the WSI and can be off the image>,
      y: <number: the position of the mouse in the whole slide image in image coordinates; the
          range depends on the size of the WSI and can be off the image>
    }
}
```

Events can also log `altKey`, `ctrlKey`, `metaKey`, `shiftKey`, `button`, `buttons`, `char`, `charCode`, `key`, `keyCode`, `which` values from the native web event.

### Task activities

Tasks generate `task` activity logs.  This includes:

```
{
    session: <string: session id>,
    sequenceId: <integer: a monotonically increasing number for logged events in the current
                 session>,
    epochms: <integer: the current time in linux epoch milliseconds>,
    activity: 'task',
    taskAction: <string: one of 'switch', 'set', 'toggle', 'stop'>
    experiment: <string: current experiment title>,
    running: <boolean: true if the experiment is running>,
    task: {    // data from the current task including any user input
      name: <string>,
      description: <string>,
      userInput: [
         ...
      ],
    }
}
```

### Annotation activities

When annotations are edited or deleted, the `annotation` activity is logged.  This includes:

```
{
    session: <string: session id>,
    sequenceId: <integer: a monotonically increasing number for logged events in the current
                 session>,
    epochms: <integer: the current time in linux epoch milliseconds>,
    activity: 'annotation',
    annotationAction: <string: one of 'edit', 'stopedit', 'delete', 'update'>
    annotation: <string: girder annotation id>,
    annotationVersion: <girder annotation version>
}
```

