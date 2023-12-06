# cs-demo-downloader

Automatically download Counter-Strike demos of ranked, unranked, and wingman matches.
Downloads the demo and updates the modified date file metadata to the timestamp the match was played.
Can use two strategies:

- Logs into your Steam account and scrapes the [GCPD page](https://steamcommunity.com/my/gcpd/730) for any new demos.
- Uses any Steam account and downloads the demos using a user's authorization code (like Leetify does).

## Config

You can omit the auth code or GCPD-related fields to not use their respective download strategy.

### `config.json`

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
        "secret": "base64encodedsteamguardsecret="
    },
    "steamApiKey": "AAAABBBBCCCCDDDD1111222233334444",

    "gcpdLogins": [
        {
            "username": "steamusername",
            "password": "steampassword",
            "secret": "base64encodedsteamguardsecret="
        }
    ],

    "logLevel": "trace",
    "runOnStartup": false,
    "cronSchedule": "* * * * *"
}
```

## Docker

### Image

`ghcr.io/claabs/cs-demo-downloader:latest`

### Volumes

- `/config`: Where the config file is stored, and where the "database" store is written
- `/demos`: Where the decompressed demos are stored
