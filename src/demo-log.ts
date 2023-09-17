import fsx from 'fs-extra/esm';
import path from 'node:path';
import L from './logger.js';
import { GcpdMatch } from './gcpd.js';

const configDir = process.env['CONFIG_DIR'] || 'config';
const logFile = path.join(configDir, 'demo-log.csv');

// eslint-disable-next-line import/prefer-default-export
export const appendDemoLog = async (matches: GcpdMatch[]): Promise<void> => {
  L.trace({ matchesLength: matches.length, logFile }, 'Writing matches to demo log');
  const logLines = matches.reduce(
    (lines, match) => `${lines}${match.date.toISOString()}\t${match.type || ''}\t${match.url}\n`,
    '',
  );
  try {
    await fsx.outputFile(logFile, logLines, { encoding: 'utf-8', flag: 'a' });
  } catch (err) {
    L.error({ err }, 'Error writing to demo log');
  }
};
