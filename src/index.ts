import PQueue from 'p-queue';
import { downloadSaveGcpdDemo } from './download';
import { getMatches } from './gcpd';
import type { User } from './config';
import { config } from './config';
import { setStoreValue } from './store';

const handleGcpdUser = async (user: User, gcpdQueue: PQueue, downloadQueue: PQueue) => {
  const matches = await gcpdQueue.add(() => getMatches(user), { throwOnTimeout: true });
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
  const gcpdQueue = new PQueue({ concurrency: 1, throwOnTimeout: true });
  const downloadQueue = new PQueue({ concurrency: 5, throwOnTimeout: true });

  return Promise.all(config.users.map((user) => handleGcpdUser(user, gcpdQueue, downloadQueue)));
};

main().catch((err) => {
  console.error(err);
});
