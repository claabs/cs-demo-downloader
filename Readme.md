# cs-demo-downloader

Automatically download Counter-Strike demos of ranked, unranked, and wingman matches.
Logs into your steam account and scrapes the [GCPD page](https://steamcommunity.com/my/gcpd/730) for any new demos.
Downloads the demo and updates the modified date file metadata to the timestamp the match was played.

## Config

```json5
{
    "users": [
        {
            "username": "mysteamusername",
            "password": "steampassword1234",
            "secret": "base64encodedsteamguardsecret"
        }
    ]
}
```
