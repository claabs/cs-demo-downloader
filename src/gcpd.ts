import axios, { type AxiosResponse } from 'axios';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import PQueue from 'p-queue';
import type { Config, User } from '.';
import { loginSteam } from './steam';
import { getStoreValue, setStoreValue } from './store';

export interface GcpdMatch {
  date: Date;
  url: string;
  matchId: bigint;
}

export interface ParseListResult {
  newMatches: GcpdMatch[];
  finished: boolean;
}

export interface ContinueResponse {
  success: boolean;
  html: string;
  continue_token?: string;
  continue_text?: string;
}

const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';

const parseCsgoMatchList = (html: string, minMatchIdBound?: bigint): ParseListResult => {
  const dom = new JSDOM(html).window;
  // inspired by https://github.com/leetify/leetify-gcpd-upload/blob/main/src/offscreen/dom-parser.ts
  const cells = dom.document.querySelectorAll('td.val_left');

  const matches: GcpdMatch[] = [];
  let finished = false;
  // eslint-disable-next-line no-restricted-syntax
  for (const matchCell of cells) {
    const urlElement = matchCell.querySelector(
      'table.csgo_scoreboard_inner_left tbody tr td a',
    ) as HTMLLinkElement;
    if (!urlElement) {
      // when a match does not have a download url, all later matches will most likely not have one either
      finished = true;
      break;
    }

    const url = urlElement.getAttribute('href');
    const urlMatch = url?.match(/^https?:\/\/replay\d+\.valve\.net\/730\/(\d+)_\d+\.dem\.bz2$/);
    if (!url || !urlMatch) break; // something is weird if this happens
    const matchIdStr = urlMatch.at(0);
    if (!matchIdStr) break;
    const matchId = BigInt(matchIdStr);
    if (minMatchIdBound && matchId < minMatchIdBound) {
      // if this match is older or as old as the latest match we've found previously, we don't need to upload it (or any following matches)
      finished = true;
      break;
    }

    const dateElement = matchCell.querySelector(
      'table.csgo_scoreboard_inner_left tbody tr:nth-child(2) td',
    ) as HTMLTableCellElement;
    const dateText = dateElement?.innerHTML?.trim();
    if (!dateText?.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} GMT$/)) break; // something is weird if this happens
    const date = new Date(dateText);
    matches.push({ date, url, matchId });
  }
  return { newMatches: matches, finished };
};

export const getTabDemos = async (
  cookies: string[],
  tab: string,
  minContinueToken?: bigint,
  gameId = 730,
): Promise<GcpdMatch[]> => {
  const initResp = await axios.get<string>(`https://steamcommunity.com/my/gcpd/${gameId}`, {
    params: {
      tab,
    },
    responseType: 'document',
    headers: {
      Cookie: cookies,
      'User-Agent': userAgent,
    },
  });

  const continueTokenMatch = initResp.data.match(/g_sGcContinueToken = '([0-9]+)'/g);
  if (!continueTokenMatch) throw new Error('Could not get document continue token');
  let continueToken = continueTokenMatch.at(0);
  if (!continueToken) throw new Error('Could not get document continue token match group');

  const sessionIdMatch = initResp.data.match(/g_sessionID = "([0-9a-f]{24})"/g);
  if (!sessionIdMatch) throw new Error('Could not get document session ID');
  const sessionId = sessionIdMatch.at(0);
  if (!sessionId) throw new Error('Could not get document session ID match group');

  const initParseResult = parseCsgoMatchList(initResp.data, minContinueToken);
  let { finished } = initParseResult;
  const parsedMatches = initParseResult.newMatches;

  while (!finished && continueToken) {
    // fix with some async iterator??
    // eslint-disable-next-line no-await-in-loop
    const continueResp = (await axios.get<ContinueResponse>(
      `https://steamcommunity.com/my/gcpd/${gameId}`,
      {
        params: {
          tab,
          continue_token: continueToken,
          sessionid: sessionId,
          ajax: 1,
        },
        responseType: 'json',
        headers: {
          Cookie: cookies,
          'User-Agent': userAgent,
        },
      },
    )) as AxiosResponse<ContinueResponse>;

    continueToken = continueResp.data.continue_token;

    const continueParseResult = parseCsgoMatchList(continueResp.data.html, minContinueToken);
    finished = continueParseResult.finished;
    parsedMatches.push(...continueParseResult.newMatches);

    if (!continueToken || (minContinueToken && BigInt(continueToken) < minContinueToken)) {
      finished = true;
    }
  }
  return parsedMatches;
};

export const getDemos = async (userLogin: User): Promise<GcpdMatch[]> => {
  const cookies = await loginSteam(userLogin);
  const minContinueTokenStr = await getStoreValue('lastContinueToken', userLogin.username);
  const minContinueToken = minContinueTokenStr ? BigInt(minContinueTokenStr) : undefined;

  const tabs = [
    'matchhistorycompetitive',
    'matchhistorypremier',
    'matchhistoryscrimmage',
    'matchhistorywingman',
  ];
  const queue = new PQueue({ concurrency: 1 });
  const newDemos = (
    await Promise.all(
      tabs.map((tab) =>
        queue.add(() => getTabDemos(cookies, tab, minContinueToken), { throwOnTimeout: true }),
      ),
    )
  ).flat();

  // Set the latest match ID for a future run
  const greatestMatchId = newDemos.reduce((greatestId, match) => {
    if (!greatestId || match.matchId > greatestId) {
      return match.matchId;
    }
    return greatestId;
  }, minContinueToken);
  if (greatestMatchId) {
    setStoreValue('lastContinueToken', userLogin.username, greatestMatchId.toString());
  }

  return newDemos;
};

export const getAllGcpdDemos = async () => {
  const config = JSON.parse(fs.readFileSync('config/config.json', 'utf-8')) as Config;
  const queue = new PQueue({ concurrency: 1 });
  await Promise.all(config.users.map((user) => queue.add(() => getDemos(user))));
};