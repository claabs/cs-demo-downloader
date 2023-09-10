/* eslint-disable import/prefer-default-export */
import { LoginSession, EAuthTokenPlatformType } from 'steam-session';
import SteamTotp from 'steam-totp';
import type { User } from '.';
import { getStoreValue, setStoreValue } from './store';

export const loginSteam = async (user: User): Promise<string[]> => {
  const session = new LoginSession(EAuthTokenPlatformType.WebBrowser);
  const refreshToken = await getStoreValue('refreshToken', user.username);

  if (refreshToken) {
    try {
      session.refreshToken = refreshToken;
      //   session.renewRefreshToken() // This probably won't work, so we'll just let the refresh token expire
    } catch (err) {
      console.error(err);
    }
  } else {
    const authCode = SteamTotp.getAuthCode(user.secret);

    const waitForAuthentication = new Promise<void>((resolve) => {
      session.once('authenticated', () => {
        resolve();
      });
    });

    await session.startWithCredentials({
      accountName: user.username,
      password: user.password,
      steamGuardCode: authCode,
    });
    await waitForAuthentication;
  }
  const cookies = await session.getWebCookies();
  await setStoreValue('refreshToken', user.username, session.refreshToken);
  return cookies;
};
