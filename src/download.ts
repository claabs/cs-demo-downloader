import axios from 'axios';
import bz2 from 'unbzip2-stream';
import fs from 'node:fs';
import fsp from 'fs/promises';
import fsx from 'fs-extra';
import util from 'node:util';
import stream from 'node:stream';
import path from 'node:path';
import L from './logger.js';

export interface DownloadableMatch {
  date: Date;
  url?: string;
  matchId: bigint;
  type?: string;
}

const pipeline = util.promisify(stream.pipeline);
const demosDir = process.env['DEMOS_DIR'] || 'demos';
const tempDemosDir = path.join(demosDir, 'temp');
const completedDemosDir = path.join(demosDir, 'completed');

export const gcpdUrlToFilename = (url: string, suffix?: string): string => {
  // http://replay129.valve.net/730/003638895521671676017_1102521424.dem.bz2
  // match730_003617919461891244205_1406239579_129.dem

  const matchGroups = url.match(/^https?:\/\/replay(\d+)\.valve\.net\/(\d+)\/(\d+_\d+)\.dem\.bz2$/);
  if (!matchGroups) throw new Error(`Invalid GCPD URL: ${url}`);
  const [, regionId, gameId, matchId] = matchGroups;
  return `match${gameId}_${matchId}_${regionId}${suffix ? `_${suffix}` : ''}.dem`;
};

/**
 * Downloads, extracts, and updates modified date of demo
 * @param match Match metadata
 * @returns matchId if match failed
 */
export const downloadSaveDemo = async (match: DownloadableMatch): Promise<bigint | null> => {
  try {
    if (!match.url) throw new Error('Match download URL missing');

    await fsx.mkdirp(tempDemosDir);
    const tempFilename = path.join(tempDemosDir, gcpdUrlToFilename(match.url, match.type));

    await fsx.mkdirp(completedDemosDir);
    const completedFilename = path.join(completedDemosDir, gcpdUrlToFilename(match.url, match.type));

    const exists = await fsx.exists(completedFilename);
    if (!exists) {
      L.trace({ url: match.url }, 'Downloading demo');
      const resp = await axios.get<stream.Duplex>(match.url, { responseType: 'stream' });
      L.trace({ url: match.url }, 'Demo download complete');
      await pipeline(resp.data, bz2(), fs.createWriteStream(tempFilename, 'binary'));
      L.trace({ filename: tempFilename }, 'Demo saved to file');
      await fsp.rename(tempFilename, completedFilename);
      await fsp.utimes(completedFilename, match.date, match.date);
      L.info({ filename: completedFilename, date: match.date }, 'Demo save complete');
    } else {
      L.info({ filename: completedFilename }, 'File already exists, skipping download');
    }
    return null;
  } catch (err) {
    L.error({ err, match }, 'Error downloading GCPD demo');
    return match.matchId;
  }
};
