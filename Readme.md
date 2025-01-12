# cs-demo-downloader

Automatically download Counter-Strike demos of Premier, competitive, and wingman matches.
Downloads the demo and updates the modified date file metadata to the timestamp the match was played.
Can use two strategies:

- Logs into your Steam account and scrapes the [GCPD page](https://steamcommunity.com/my/gcpd/730) for any new demos.
- Uses any Steam account and downloads the demos using a user's authorization code (like Leetify does).

## Config

The config is written in a `config.json` file in the `/config` volume.

### Shared Properties

- `logLevel`: `trace`, `debug`, `info`, `warn`, `error` - defaults to `info`
- `cronSchedule`: a standard 5 digit cron expressions - defaults to `0 * * * *` (hourly)
- `runOnStartup`: whether to run the job immedately on startup - defaults to `true`

### GCPD mode

This is the easiest approach for a single user downloading their own demos. Multiple users can be put in the `gcpdLogins` array.

- `gcpdLogins[].username`: your Steam login username
- `gcpdLogins[].password`: your Steam login password
- `gcpdLogins[].secret`: if applicable, your Steam Guard secret, as a base64 (28 characters) or hex string. This is labeled as `shared_secret` in a [Steam Desktop Authenticator](https://github.com/Jessecar96/SteamDesktopAuthenticator) `.maFile`

```json
{
    "gcpdLogins": [
        {
            "username": "steamusername",
            "password": "steampassword",
            "secret": "yeBrc0jD9Ff0kjKOx8+hnckVojg="
        }
    ],

    "logLevel": "info",
    "runOnStartup": false,
    "cronSchedule": "0 * * * *"
}
```

### Auth Code Mode

This approach is best if you want to download demos for yourself and others that won't give you their login details. It requires an account to briefly "launch" CS2 and fetch match data from the Game Coordinator, so you should have a secondary bot account for this approach.

- `authCodeLogin.username`: your bot account's Steam login username
- `authCodeLogin.password`: your bot account's Steam login password
- `authCodeLogin.secret`: if applicable, your Steam Guard secret, as a base64 (28 characters) or hex string. This is labeled as `shared_secret` in a [Steam Desktop Authenticator](https://github.com/Jessecar96/SteamDesktopAuthenticator) `.maFile`
- `steamApiKey`: the [Steam API Key](https://steamcommunity.com/dev/apikey) of your bot account
- `authCodes[].authCode`: the [match history authentication code](https://help.steampowered.com/en/wizard/HelpWithGameIssue/?appid=730&issueid=128) for a user
- `authCodes[].steamId64`: the SteamID64 for the user, as a string
- `authCodes[].oldestShareCode`: the oldest match share code available in the user's match history

```json
{
    "authCodes": [
        {
            "authCode": "ABCD-1234-WXYZ",
            "steamId64": "70000000000000000",
            "oldestShareCode": "CSGO-aBcdE-aBcdE-aBcdE-aBcdE-aBcdE"
        }
    ],
    "authCodeLogin": {
        "username": "steamusername",
        "password": "steampassword",
        "secret": "yeBrc0jD9Ff0kjKOx8+hnckVojg="
    },
    "steamApiKey": "AAAABBBBCCCCDDDD1111222233334444",

    "logLevel": "info",
    "runOnStartup": false,
    "cronSchedule": "0 * * * *"
}
```

## Docker

### Image

`ghcr.io/claabs/cs-demo-downloader:latest`

### Volumes

- `/config`: Where the config file is stored, and where the "database" store is written
- `/demos`: Where the decompressed demos are stored
