# Anenji Wall Panel

A standalone Home Assistant dashboard card designed for a 1024×600 landscape wall tablet.

It combines:

- Anenji 11 kW energy flow
- Combined grid power (`Grid to Battery + Grid to Load`)
- Solar, home load, battery charge/discharge power, cutoff, and ETA
- Four outlet controls
- Bambu Lab P1S status and controls in a tabbed panel
- ESPHome Wi-Fi Radio station, playback, and volume controls

## HACS installation

1. In HACS open the three-dot menu and select **Custom repositories**.
2. Paste this repository URL and choose **Dashboard** as the type.
3. Install **Anenji Wall Panel**.
4. Confirm that the resource `/hacsfiles/anenji-wall-panel/anenji-wall-panel.js` was added as a JavaScript module.
5. Open a dashboard, select **Add card**, and choose **Anenji Wall Panel**.
6. Select the required entities in the visual editor. YAML is not required.

The editor uses one setting per row so it remains readable inside Home Assistant's narrow card-editor panel. Battery flow and ETA use the common power balance `Solar + Combined Grid − Home`; the optional `Battery Power` entity is only a fallback when one of those readings is unavailable. Battery ETA uses the configured capacity and grid-switch percentage. `Grid flow threshold (W)` affects only the visual grid arrow; the complete grid reading is always retained in the ETA calculation.

For Bambu P1S, select only the printer's `Print Status` sensor. The card derives the matching task, progress, layers, remaining time, nozzle and bed temperatures, speed selector, chamber light, pause/resume, and stop entities from the same entity prefix. Stop requires a deliberate 0.9-second hold.

`dashboard.example.yaml` remains available as an optional advanced example.

## Manual installation

Copy `anenji-wall-panel.js` to `/config/www/`, register `/local/anenji-wall-panel.js` as a JavaScript module, then use `dashboard.example.yaml` in a Manual card.

## Responsive layouts

- **Wall tablet (901–1199 px):** tuned for a Samsung P3113 in 1024×600 landscape orientation, with a fixed one-screen layout.
- **Desktop (1200 px and wider):** taller centered dashboard with a maximum content width so the energy map does not stretch excessively.
- **Phone (up to 900 px):** full vertical dashboard with a compact cross-shaped energy map, directional flow arrows, summaries, outlets/P1S, and radio; normal page scrolling is enabled.

## Appearance

The visual editor provides **Auto (Home Assistant)**, **Dark**, and **Light** theme modes. Auto follows the active Home Assistant theme, while Dark and Light can be used to force the card appearance independently. The top-bar theme button cycles through all three modes and remembers the choice separately on each device.
