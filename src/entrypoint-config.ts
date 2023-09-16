import { outputJSONSync } from 'fs-extra/esm';
import { config } from './config.js';
import L from './logger.js';

try {
  const output = {
    runOnStartup: config.runOnStartup ?? true,
    runOnce: config.runOnce ?? false,
    cronSchedule: config.cronSchedule ?? '0 * * * *',
    timezone: config.timezone ?? process.env.TZ ?? 'UTC',
  };
  outputJSONSync('/tmp/config.json', output);
} catch (err) {
  L.error(err);
}
