# Project Roadmap

## App Launcher Enhancements

- [ ] Track app launches, sort by usage on initial load `@src/components/app-launcher.tsx`
- [ ] Add ability to bookmark apps, still in app launcher

## Network Status Refactoring

Refactor from simple polling to hybrid approach for ~10x efficiency gain:

- [ ] Use `nmcli monitor` for connection change events (connect/disconnect/SSID changes)
- [ ] Use `/proc/net/wireless` polling for signal strength updates (~1ms vs ~11ms)
- [ ] Keep `nmcli` calls only for initial load and when monitor detects changes
- [ ] Add `createNetworkResource()` helper that combines both approaches
