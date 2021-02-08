import { registerPluginNamespace } from '@girder/core/pluginUtils';

// Import modules for side effects.
import './views/ImageView';
import './utility/activityLogger';

// Expose symbols under girder.plugins.
import * as annotationTracker from './index';
registerPluginNamespace('annotation_tracker', annotationTracker);
