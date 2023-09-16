import axios from 'axios';
import bz2 from 'unbzip2-stream';
import fs from 'node:fs';
import fsp from 'fs/promises';
import fsx from 'fs-extra';
import util from 'node:util';
import stream from 'node:stream';
import path from 'node:path';
import type { GcpdMatch } from './gcpd';
import L from './logger';

const pipeline = util.promisify(stream.pipeline);

export const gcpdUrlToFilename = (url: string, suffix?: string): string => {
  // http://replay129.valve.net/730/003638895521671676017_1102521424.dem.bz2
  // match730_003617919461891244205_1406239579_129.dem

  const matchGroups = url.match(/^https?:\/\/replay(\d+)\.valve\.net\/(\d+)\/(\d+_\d+)\.dem\.bz2$/);
  if (!matchGroups) throw new Error(`Invalid GCPD URL: ${url}`);
  const [, regionId, gameId, matchId] = matchGroups;
  return `match${gameId}_${matchId}_${regionId}${suffix ? `_${suffix}` : ''}.dem`;
};

export const downloadSaveGcpdDemo = async (match: GcpdMatch): Promise<void> => {
  try {
    await fsx.mkdirp('demos');
    const filename = path.join('demos', gcpdUrlToFilename(match.url, match.type));
    const exists = await fsx.exists(filename);
    if (!exists) {
      L.trace({ url: match.url }, 'Downloading demo');
      const resp = await axios.get<stream.Duplex>(match.url, { responseType: 'stream' });
      L.trace({ url: match.url }, 'Demo download complete');
      await pipeline(resp.data, bz2(), fs.createWriteStream(filename, 'binary'));
      L.trace({ filename }, 'Demo saved to file');
      await fsp.utimes(filename, match.date, match.date);
      L.trace({ filename, date: match.date }, 'Update file modified date');
    } else {
      L.info({ filename }, 'File already exists, skipping download');
    }
  } catch (err) {
    L.error({ err }, 'Error downloading GCPD demo');
  }
};
