import PQueue from 'p-queue';
import { downloadSaveDemo } from './download.js';
import { getMatches } from './gcpd.js';
import type { LoginCredential } from './config.js';
import { config } from './config.js';
import { setStoreValue } from './store.js';
import logger from './logger.js';
import { appendDemoLog } from './demo-log.js';
import { getAllUsersMatches } from './steam-gc.js';

const handleGcpdUser = async (user: LoginCredential, gcpdQueue: PQueue, downloadQueue: PQueue) => {
  const L = logger.child({ username: user.username });
  const matches = await gcpdQueue.add(() => getMatches(user), { throwOnTimeout: true });
  if (!matches.length) {
    L.info('No new GCPD matches found');
    return;
  }

  const demoUrls = matches.map((match) => match.url);
  L.info({ matchCount: matches.length, demoUrls }, 'New GCPD matches found');
  L.trace({ matches }, 'New GCPD match details');
  await appendDemoLog(matches);
  const downloadResults = await Promise.all(
    matches.map((match) =>
      downloadQueue.add(() => downloadSaveDemo(match), { throwOnTimeout: true }),
    ),
  );
  const failedDownloads = downloadResults.filter((id): id is bigint => id !== null).sort();
  const firstFailedMatch = failedDownloads.at(0);
  // Set the latest match ID for a future run
  const greatestMatchId = matches.reduce((greatestId, match) => {
    // If is the greatest ID found, and is not greater than the earliest failed ID
    if (
      !greatestId ||
      (match.matchId > greatestId && !(firstFailedMatch && match.matchId >= firstFailedMatch))
    ) {
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

  if (config.gcpdLogins?.length) {
    await Promise.all(
      config.gcpdLogins.map((user) => handleGcpdUser(user, gcpdQueue, downloadQueue)),
    );
  }

  if (config.authCodeLogin && config.steamApiKey && config.authCodes?.length) {
    await getAllUsersMatches(config.authCodes, downloadQueue);
  }
};

main().catch((err) => {
  logger.error(err);
});
