import GlobalOffensive from 'globaloffensive';
import PQueue from 'p-queue';
import { decodeMatchShareCode } from 'csgo-sharecode';
import { config, type AuthCodeUser } from './config.js';
import logger from './logger.js';
import { loginSteamClient } from './steam.js';
import { getAllNewMatchCodes } from './match-history.js';
import { getStoreValue, setStoreValue } from './store.js';
import { DownloadableMatch, downloadSaveDemo } from './download.js';
import { appendDemoLog } from './demo-log.js';

export interface MatchIdentifier {
  shareCode: string;
  matchId: bigint;
  steamId: string;
}

export interface MatchIdUrl {
  url: string;
  matchId: string;
}

type MatchRespFn = (match: GlobalOffensive.Match) => void;

export const promiseTimeout = <T>(
  timeoutMs: number,
  promise: Promise<T>,
  error?: Error,
): Promise<T> => {
  let timeout: NodeJS.Timeout;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(error || new Error(`Timed out after ${timeoutMs} ms`)),
      timeoutMs,
    );
  });

  return Promise.race([
    promise.then((res) => {
      // Cancel timeout to prevent open handles
      clearTimeout(timeout);
      return res;
    }),
    timeoutPromise,
  ]) as Promise<T>;
};

export const getUserShareCodes = async (
  user: AuthCodeUser,
  shareCodesQueue: PQueue,
): Promise<MatchIdentifier[]> => {
  const { steamId64, authCode } = user;
  const L = logger.child({ steamId: steamId64 });
  const lastShareCode = (await getStoreValue('lastShareCode', steamId64)) ?? user.oldestShareCode;
  L.debug({ lastShareCode }, 'Getting new share codes');
  const shareCodes = await getAllNewMatchCodes(steamId64, authCode, lastShareCode, shareCodesQueue);
  return shareCodes.map((shareCode) => {
    const { matchId } = decodeMatchShareCode(shareCode);
    return { shareCode, steamId: steamId64, matchId };
  });
};

export const getAllUsersMatches = async (
  users: AuthCodeUser[],
  downloadQueue: PQueue,
): Promise<void> => {
  if (!config.authCodeLogin) throw new Error('Missing auth code login credentials');
  const L = logger.child({ username: config.authCodeLogin.username });
  const shareCodesQueue = new PQueue({ concurrency: 1, interval: 300, intervalCap: 1 });
  const usersShareCodeIds = await Promise.all(
    users.map(async (user) => getUserShareCodes(user, shareCodesQueue)),
  );
  const shareCodes = Array.from(new Set(usersShareCodeIds.flat().map((id) => id.shareCode)));

  // Do nothing if no codes
  if (!shareCodes.length) return;

  const steamUser = await loginSteamClient(config.authCodeLogin);
  steamUser.on('error', (err) => {
    L.error(err);
  });
  const waitForGame = new Promise<void>((resolve) => {
    steamUser.once('appLaunched', (id) => {
      if (id === 730) {
        resolve();
      }
    });
  });
  steamUser.gamesPlayed(730, true);
  await waitForGame;
  const csgo = new GlobalOffensive(steamUser);

  // robust match response promise handler
  const pendingMatchResponses = new Map<string, MatchRespFn>();
  csgo.on('matchList', (matches) => {
    L.debug({ matchesLength: matches.length }, 'Recieved matchList event');
    matches.forEach((match) => {
      const cb = pendingMatchResponses.get(match.matchid);
      if (cb) {
        L.debug({ matchId: match.matchid }, 'Resolving match request');
        pendingMatchResponses.delete(match.matchid);
        cb(match);
      }
    });
  });

  L.info({ shareCodes }, 'Requesting games');
  const requestGameQueue = new PQueue({ concurrency: 1 });
  const resolvedMatches = await Promise.all(
    shareCodes.map((shareCode) =>
      requestGameQueue.add(
        async () => {
          const { matchId } = decodeMatchShareCode(shareCode);
          const [match] = await Promise.all([
            promiseTimeout(
              30000,
              new Promise<GlobalOffensive.Match>((resolve) => {
                pendingMatchResponses.set(matchId.toString(), resolve);
              }),
              new Error(`Error fetching match data for match ${shareCode}`),
            ),
            csgo.requestGame(shareCode),
          ]);
          return match;
        },
        { throwOnTimeout: true },
      ),
    ),
  );

  // Quit CS
  const waitForQuit = new Promise<void>((resolve) => {
    steamUser.once('appQuit', (id) => {
      if (id === 730) {
        resolve();
      }
    });
  });
  steamUser.gamesPlayed([], true);
  await waitForQuit;
  steamUser.logOff();

  // Convert demo download metadata
  const dlMatches: DownloadableMatch[] = resolvedMatches.map((match) => {
    const playerCount = match.roundstatsall[0]?.reservation.account_ids.filter((id) => id !== 0)
      .length;
    const isWingman = playerCount && playerCount <= 4;
    const isPremier = match.roundstatsall[0]?.b_switched_teams; // null for comp, true for premier
    let type: string;
    if (isWingman) {
      type = 'wingman';
    } else if (isPremier) {
      type = 'premier';
    } else {
      type = 'competitive';
    }
    return {
      matchId: BigInt(match.matchid),
      url: match.roundstatsall.at(-1)?.map as string | undefined,
      date: new Date((match.matchtime as number) * 1000),
      type,
    };
  });

  // Download the demos
  await appendDemoLog(dlMatches);
  const downloadResults = await Promise.all(
    dlMatches.map((match) =>
      downloadQueue.add(() => downloadSaveDemo(match), { throwOnTimeout: true }),
    ),
  );
  const failedDownloads = downloadResults.filter((id): id is bigint => id !== null).sort();

  // Use each user's MatchIdentifiers to set the last working shareCode in the store
  await Promise.all(
    usersShareCodeIds.map(async (userShareCodeIds): Promise<void> => {
      let lastWorkingIdentifier: MatchIdentifier | undefined;
      userShareCodeIds.some((matchIdentifier) => {
        if (
          resolvedMatches.some((match) => match.matchid === matchIdentifier.matchId.toString()) &&
          !failedDownloads.includes(matchIdentifier.matchId)
        ) {
          lastWorkingIdentifier = matchIdentifier;
          return false;
        }
        return true;
      }, undefined);
      if (lastWorkingIdentifier)
        await setStoreValue(
          'lastShareCode',
          lastWorkingIdentifier.steamId,
          lastWorkingIdentifier.shareCode,
        );
    }),
  );
};
