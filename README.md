# Anenji Wall Panel

A standalone Home Assistant dashboard card designed for a 1024×600 landscape wall tablet.

It combines:

- Anenji 11 kW energy flow
- Combined grid power (`Grid to Battery + Grid to Load`)
- Solar, home load, and battery status
- Four outlet controls
- ESPHome Wi-Fi Radio station, playback, and volume controls

## HACS installation

1. In HACS open the three-dot menu and select **Custom repositories**.
2. Paste this repository URL and choose **Dashboard** as the type.
3. Install **Anenji Wall Panel**.
4. Confirm that the resource `/hacsfiles/anenji-wall-panel/anenji-wall-panel.js` was added as a JavaScript module.
5. Add a Manual card and paste `dashboard.example.yaml`.
6. Replace the four sample outlet entities with the real switches.

## Manual installation

Copy `anenji-wall-panel.js` to `/config/www/`, register `/local/anenji-wall-panel.js` as a JavaScript module, then use `dashboard.example.yaml` in a Manual card.

## Tablet target

The card is tuned for a Samsung P3113 in landscape orientation. Its maximum height is 500 px so the Home Assistant app bar and Lovelace spacing do not cause vertical scrolling.

