import { initializeRuntimeSecrets } from './runtime.ts';

const directory = process.env.TASKBOARD_STATE_DIR;
if (!directory) throw new Error('TASKBOARD_STATE_DIR is required');
initializeRuntimeSecrets(directory);
console.log('Taskboard runtime secrets are ready. Existing values were preserved.');
