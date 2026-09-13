# Opening the backend port to the LAN/internet

The backend (`:5249`, see `BACKEND.md` → Deployment) binds to all interfaces (`http://0.0.0.0:5249`
in the `http` and `public` launch profiles in `Properties/launchSettings.json`), but Windows Firewall may still silently block inbound connections to
it from other devices. These commands need an **elevated** PowerShell (Run as Administrator) —
a regular session can't even read firewall rules, let alone add one.

## Check for an existing rule

```powershell
Get-NetFirewallRule -DisplayName '*TaskOTron*','*dotnet*' -ErrorAction SilentlyContinue |
  Select-Object DisplayName, Direction, Action, Enabled
```

## Add an inbound allow rule for port 5249 (if none shows up above)

```powershell
New-NetFirewallRule -DisplayName "TaskOTron backend (5249)" -Direction Inbound -Protocol TCP -LocalPort 5249 -Action Allow
```

## Also worth checking

The first time the backend bound a new listening port, Windows may have shown a one-time
"Windows Defender Firewall has blocked some features of this app" popup on the machine's screen
instead of silently allowing or blocking it — since the process was started headless/in the
background, that dialog could still be sitting there unclicked. Worth checking for it directly
on the machine if the rule above doesn't fix things on its own.

## Then

Point the router's port-forward at this machine's LAN IP on port `5249` (not `4200` — see
`BACKEND.md` → Auth for why that distinction matters) and retest from outside the network.
