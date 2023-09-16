import PQueue from 'p-queue';
import { downloadSaveGcpdDemo } from './download.js';
import { getMatches } from './gcpd.js';
import type { User } from './config.js';
import { config } from './config.js';
import { setStoreValue } from './store.js';
import logger from './logger.js';

const handleGcpdUser = async (user: User, gcpdQueue: PQueue, downloadQueue: PQueue) => {
  const L = logger.child({ username: user.username });
  const matches = await gcpdQueue.add(() => getMatches(user), { throwOnTimeout: true });
  if (!matches.length) {
    L.info('No new GCPD matches found');
    return;
  }

  const demoUrls = matches.map((match) => match.url);
  L.info({ matchCount: matches.length, demoUrls }, 'New GCPD matches found');
  L.trace({ matches }, 'New GCPD match details');
  await Promise.all(
    matches.map((match) =>
      downloadQueue.add(() => downloadSaveGcpdDemo(match), { throwOnTimeout: true }),
    ),
  );
  // Set the latest match ID for a future run
  const greatestMatchId = matches.reduce((greatestId, match) => {
    if (!greatestId || match.matchId > greatestId) {
      return match.matchId;
    }
    return greatestId;
  }, BigInt(0));
  if (greatestMatchId) {
    setStoreValue('lastContinueToken', user.username, greatestMatchId.toString());
  }
};

const main = async () => {
  logger.debug({ config }, 'Starting cs-demo-downloader');
  const gcpdQueue = new PQueue({ concurrency: 1, throwOnTimeout: true });
  const downloadQueue = new PQueue({ concurrency: 5, throwOnTimeout: true });

  return Promise.all(config.users.map((user) => handleGcpdUser(user, gcpdQueue, downloadQueue)));
};

main().catch((err) => {
  logger.error(err);
});
