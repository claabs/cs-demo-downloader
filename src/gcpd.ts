import axios, { type AxiosResponse } from 'axios';
import { JSDOM } from 'jsdom';
import PQueue from 'p-queue';
import { loginSteam } from './steam';
import { getStoreValue } from './store';
import type { User } from './config';

export interface GcpdMatch {
  date: Date;
  url: string;
  matchId: bigint;
  type?: string;
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

const tabToType = (tab: string): string | undefined => {
  const convertMap: Record<string, string> = {
    matchhistorycompetitive: 'ranked',
    matchhistorypremier: 'premier',
    matchhistoryscrimmage: 'unranked',
    matchhistorywingman: 'wingman',
  };
  return convertMap[tab];
};

const parseCsgoMatchList = (
  html: string,
  type?: string,
  minMatchIdBound?: bigint,
): ParseListResult => {
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
    const matchIdStr = urlMatch.at(1);
    if (!matchIdStr) break;
    const matchId = BigInt(matchIdStr);
    if (minMatchIdBound && matchId <= minMatchIdBound) {
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
    matches.push({ date, url, matchId, type });
  }
  return { newMatches: matches, finished };
};

export const getTabMatches = async (
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

  const continueTokenMatch = initResp.data.match(/g_sGcContinueToken = '(\d+)'/);
  if (!continueTokenMatch) throw new Error('Could not get document continue token');
  let continueToken = continueTokenMatch.at(1);

  const sessionIdMatch = initResp.data.match(/g_sessionID = "([0-9a-f]{24})"/);
  if (!sessionIdMatch) throw new Error('Could not get document session ID');
  const sessionId = sessionIdMatch.at(1);
  if (!sessionId) throw new Error('Could not get document session ID match group');

  const type = tabToType(tab);
  const initParseResult = parseCsgoMatchList(initResp.data, type, minContinueToken);
  let { finished } = initParseResult;
  const parsedMatches = initParseResult.newMatches;

  while (
    !finished &&
    continueToken &&
    !(minContinueToken && BigInt(continueToken) < minContinueToken)
  ) {
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

    const continueParseResult = parseCsgoMatchList(continueResp.data.html, type, minContinueToken);
    finished = continueParseResult.finished;
    parsedMatches.push(...continueParseResult.newMatches);
  }
  return parsedMatches;
};

export const getMatches = async (userLogin: User): Promise<GcpdMatch[]> => {
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
        queue.add(() => getTabMatches(cookies, tab, minContinueToken), { throwOnTimeout: true }),
      ),
    )
  ).flat();

  return newDemos;
};
