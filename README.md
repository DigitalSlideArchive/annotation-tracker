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