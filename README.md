# Anenji Wall Panel

A standalone Home Assistant dashboard card designed for a 1024×600 landscape wall tablet.

It combines:

- Anenji 11 kW energy flow
- Combined grid power (`Grid to Battery + Grid to Load`)
- Solar, home load, battery charge/discharge power, cutoff, and ETA
- Four outlet controls
- ESPHome Wi-Fi Radio station, playback, and volume controls

## HACS installation

1. In HACS open the three-dot menu and select **Custom repositories**.
2. Paste this repository URL and choose **Dashboard** as the type.
3. Install **Anenji Wall Panel**.
4. Confirm that the resource `/hacsfiles/anenji-wall-panel/anenji-wall-panel.js` was added as a JavaScript module.
5. Open a dashboard, select **Add card**, and choose **Anenji Wall Panel**.
6. Select the required entities in the visual editor. YAML is not required.

The editor uses one setting per row so it remains readable inside Home Assistant's narrow card-editor panel. Select the inverter's `Battery Power` entity for the combined net battery flow, regardless of whether charging comes from solar, grid, or both. If it is unavailable, the card estimates battery power as `Solar + Grid − Home`. Battery ETA is shown in its own summary block using the configured capacity and grid-switch percentage.

`dashboard.example.yaml` remains available as an optional advanced example.

## Manual installation

Copy `anenji-wall-panel.js` to `/config/www/`, register `/local/anenji-wall-panel.js` as a JavaScript module, then use `dashboard.example.yaml` in a Manual card.

## Tablet target

The card is tuned for a Samsung P3113 in landscape orientation. Its maximum height is 500 px so the Home Assistant app bar and Lovelace spacing do not cause vertical scrolling.
