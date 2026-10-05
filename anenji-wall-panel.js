/* Anenji Wall Panel — standalone Home Assistant Lovelace card */

class AnenjiWallPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._built = false;
    this._clockTimer = null;
  }

  static getConfigElement() {
    return document.createElement("anenji-wall-panel-editor");
  }

  static getStubConfig() {
    return {
      title: "ANENJI 11 kW",
      entities: {},
      outlets: [
        { name: "Desk", icon: "mdi:desk-lamp" },
        { name: "Printer", icon: "mdi:printer-3d" },
        { name: "Speaker", icon: "mdi:speaker" },
        { name: "Spare", icon: "mdi:power-socket-eu" },
      ],
      radio: {
        stations: [
          { name: "STATION 1", option: "" },
          { name: "STATION 2", option: "" },
          { name: "STATION 3", option: "" },
          { name: "STATION 4", option: "" },
        ],
      },
      battery_capacity_kwh: "",
      grid_cutoff_soc: 20,
      thresholds: { active_power: 20, battery_low: 20 },
    };
  }

  setConfig(config) {
    if (!config || !config.entities) {
      throw new Error("Anenji Wall Panel requires an entities section.");
    }

    this._config = {
      title: "ANENJI 11 kW",
      indoor_temperature: null,
      entities: {},
      outlets: [],
      radio: {},
      thresholds: {
        active_power: 20,
        battery_low: 20,
      },
      ...config,
      entities: { ...(config.entities || {}) },
      outlets: Array.isArray(config.outlets) ? config.outlets.slice(0, 4) : [],
      radio: { ...(config.radio || {}) },
      thresholds: {
        active_power: 20,
        battery_low: 20,
        ...(config.thresholds || {}),
      },
    };

    this._built = false;
    this._build();
    if (this._hass) this._update();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._config && !this._built) this._build();
    if (this._built) this._update();
  }

  getCardSize() {
    return 8;
  }

  connectedCallback() {
    this._startClock();
  }

  disconnectedCallback() {
    if (this._clockTimer) clearInterval(this._clockTimer);
    this._clockTimer = null;
  }

  _build() {
    if (!this._config) return;

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card>
        <div class="shell">
          <header class="topbar">
            <div class="datetime">
              <span id="clock">--:--</span>
              <span id="date">--</span>
            </div>
            <div class="status-strip">
              <ha-icon icon="mdi:wifi"></ha-icon>
              <span class="divider"></span>
              <ha-icon icon="mdi:home-thermometer-outline"></ha-icon>
              <span id="indoor-temp">--</span>
            </div>
          </header>

          <main class="dashboard">
            <section class="energy-panel panel">
              <div class="energy-map">
                ${this._energyNode("solar", "mdi:solar-panel-large", "SOLAR", "solar-value", "solar-unit")}
                ${this._energyNode("grid", "mdi:transmission-tower", "GRID", "grid-value", "grid-unit")}
                <button class="energy-node inverter" data-more="inverter">
                  <ha-icon icon="mdi:home-lightning-bolt-outline"></ha-icon>
                  <div class="inverter-copy">
                    <strong>${this._escape(this._config.title)}</strong>
                    <span>Load <b id="load-percent">--</b></span>
                    <span id="inverter-secondary">Online</span>
                  </div>
                </button>
                ${this._energyNode("home", "mdi:home-outline", "HOME", "home-value", "home-unit")}
                ${this._energyNode("battery", "mdi:battery-high", "BATTERY", "battery-value", "battery-unit")}

                <div id="solar-flow" class="flow vertical solar-flow"><span>›</span><span>›</span><span>›</span></div>
                <div id="grid-flow" class="flow horizontal grid-flow"><span>›</span><span>›</span><span>›</span></div>
                <div id="home-flow" class="flow horizontal home-flow"><span>›</span><span>›</span><span>›</span></div>
                <div id="battery-flow" class="flow vertical battery-flow"><span>›</span><span>›</span><span>›</span></div>
              </div>

              <div class="energy-summary">
                ${this._summaryItem("mdi:calendar-today-outline", "Today", "today-value", "--", "neutral")}
                ${this._summaryItem("mdi:battery-arrow-up-outline", "Charged", "charged-value", "--", "green")}
                ${this._summaryItem("mdi:battery-arrow-down-outline", "Discharged", "discharged-value", "--", "amber")}
              </div>
            </section>

            <aside class="side-column">
              <section class="outlets-panel panel">
                <h2>OUTLETS</h2>
                <div id="outlets" class="outlet-grid"></div>
              </section>

              <section class="radio-panel panel">
                <div class="radio-heading">
                  <h2>WI-FI RADIO</h2>
                  <span id="radio-state" class="status-pill">OFFLINE</span>
                </div>
                <div class="now-playing">
                  <strong id="station-name">WI-FI RADIO</strong>
                  <span id="track-name">Ready</span>
                </div>
                <div class="transport">
                  <button id="radio-prev" class="round secondary" aria-label="Previous station"><ha-icon icon="mdi:skip-previous"></ha-icon></button>
                  <button id="radio-play" class="round primary" aria-label="Play or pause"><ha-icon id="play-icon" icon="mdi:play"></ha-icon></button>
                  <button id="radio-next" class="round secondary" aria-label="Next station"><ha-icon icon="mdi:skip-next"></ha-icon></button>
                </div>
                <div class="volume-row">
                  <ha-icon icon="mdi:volume-high"></ha-icon>
                  <input id="radio-volume" type="range" min="0" max="100" step="1" value="0" />
                  <span id="volume-value">0%</span>
                </div>
                <div id="stations" class="station-grid"></div>
              </section>
            </aside>
          </main>
        </div>
      </ha-card>
    `;

    this._built = true;
    this._buildOutlets();
    this._buildStations();
    this._bindEvents();
    this._startClock();
  }

  _energyNode(position, icon, label, valueId, unitId) {
    return `
      <button class="energy-node ${position}" data-more="${position}">
        <ha-icon icon="${icon}"></ha-icon>
        <div>
          <span${position === "battery" ? ' id="battery-label"' : ""}>${label}</span>
          <strong><b id="${valueId}">--</b> <small id="${unitId}"></small></strong>
          ${position === "battery" ? '<em id="battery-meta" class="battery-meta">IDLE • GRID AT --%</em>' : ""}
        </div>
      </button>
    `;
  }

  _summaryItem(icon, label, id, value, tone) {
    return `
      <button class="summary-item ${tone}" data-summary="${id}">
        <ha-icon icon="${icon}"></ha-icon>
        <div><span>${label}</span><strong id="${id}">${value}</strong></div>
      </button>
    `;
  }

  _buildOutlets() {
    const root = this.$("outlets");
    const fallback = [
      { name: "Desk", icon: "mdi:desk-lamp" },
      { name: "Printer", icon: "mdi:printer-3d" },
      { name: "Speaker", icon: "mdi:speaker" },
      { name: "Spare", icon: "mdi:power-socket-eu" },
    ];
    const outlets = [...this._config.outlets];
    while (outlets.length < 4) outlets.push(fallback[outlets.length]);

    root.innerHTML = outlets.map((item, index) => `
      <button class="outlet" data-outlet-index="${index}" ${item.entity ? "" : "disabled"}>
        <ha-icon icon="${this._escape(item.icon || fallback[index].icon)}"></ha-icon>
        <span>${this._escape(item.name || fallback[index].name)}</span>
        <i class="toggle-dot"></i>
      </button>
    `).join("");
  }

  _buildStations() {
    const root = this.$("stations");
    const stations = Array.isArray(this._config.radio.stations)
      ? this._config.radio.stations.slice(0, 4)
      : [];

    root.innerHTML = stations.map((station, index) => `
      <button class="station" data-station-index="${index}">
        ${this._escape(station.name || `Station ${index + 1}`)}
      </button>
    `).join("");
  }

  _bindEvents() {
    this.shadowRoot.querySelectorAll("[data-outlet-index]").forEach((button) => {
      button.addEventListener("click", () => this._toggleOutlet(Number(button.dataset.outletIndex)));
    });

    this.shadowRoot.querySelectorAll("[data-station-index]").forEach((button) => {
      button.addEventListener("click", () => this._selectStation(Number(button.dataset.stationIndex)));
    });

    this.shadowRoot.querySelectorAll("[data-more]").forEach((button) => {
      button.addEventListener("click", () => this._openEnergyEntity(button.dataset.more));
    });

    this.shadowRoot.querySelectorAll("[data-summary]").forEach((button) => {
      button.addEventListener("click", () => this._openSummaryEntity(button.dataset.summary));
    });

    this.$("radio-play").addEventListener("click", () => this._playPause());
    this.$("radio-prev").addEventListener("click", () => this._transport("previous"));
    this.$("radio-next").addEventListener("click", () => this._transport("next"));
    this.$("radio-volume").addEventListener("change", (event) => this._setVolume(Number(event.target.value)));
  }

  _update() {
    const e = this._config.entities;
    const solar = this._number(e.solar_power);
    const grid = this._number(e.grid_power);
    const home = this._number(e.home_power);
    const battery = this._number(e.battery_soc);
    const directBatteryPower = this._number(e.battery_power);
    const chargePower = this._number(e.battery_charge_power);
    const dischargePower = this._number(e.battery_discharge_power);
    let batteryPower = NaN;
    if (Number.isFinite(chargePower) || Number.isFinite(dischargePower)) {
      batteryPower = (Number.isFinite(chargePower) ? Math.abs(this._powerToWatts(e.battery_charge_power, chargePower)) : 0)
        - (Number.isFinite(dischargePower) ? Math.abs(this._powerToWatts(e.battery_discharge_power, dischargePower)) : 0);
    } else if (Number.isFinite(directBatteryPower)) {
      batteryPower = this._powerToWatts(e.battery_power, directBatteryPower);
    } else if ([solar, grid, home].every(Number.isFinite)) {
      batteryPower = this._powerToWatts(e.solar_power, solar)
        + this._powerToWatts(e.grid_power, grid)
        - this._powerToWatts(e.home_power, home);
    }

    this._setPower("solar", solar, e.solar_power);
    this._setPower("grid", grid, e.grid_power, true);
    this._setPower("home", home, e.home_power);
    this._setBattery(battery);
    const batteryInfo = this._batteryInfo(battery, batteryPower);
    this._setText("battery-label", batteryInfo.label);
    this._setText("battery-meta", batteryInfo.meta);

    this._setText("load-percent", this._formatValue(e.load_percent, "%"));
    this._setText("inverter-secondary", this._inverterSecondary());
    this._setText("today-value", this._formatEnergy(e.grid_energy_today));
    this._setText("charged-value", this._formatEnergy(e.battery_charge_today));
    this._setText("discharged-value", this._formatEnergy(e.battery_discharge_today));
    this._setText("indoor-temp", this._formatTemperature(this._config.indoor_temperature));

    this._setFlow("solar-flow", solar > this._config.thresholds.active_power, false);
    this._setFlow("home-flow", home > this._config.thresholds.active_power, false);
    this._setFlow("grid-flow", Math.abs(grid) > this._config.thresholds.active_power, grid < 0);
    this._setFlow("battery-flow", Math.abs(batteryPower) > this._config.thresholds.active_power, batteryPower < 0);

    this._updateOutlets();
    this._updateRadio();
    this._updateClock();
  }

  _setPower(prefix, value, entityId, absolute = false) {
    const state = this._state(entityId);
    const rawUnit = state && state.attributes ? state.attributes.unit_of_measurement : null;
    const normalized = Number.isFinite(value) ? (absolute ? Math.abs(value) : value) : NaN;
    const formatted = this._humanPower(normalized, rawUnit);
    this._setText(`${prefix}-value`, formatted.value);
    this._setText(`${prefix}-unit`, formatted.unit);
    const node = this.shadowRoot.querySelector(`.${prefix}.energy-node`);
    if (node) node.classList.toggle("unavailable", !Number.isFinite(value));
  }

  _setBattery(value) {
    this._setText("battery-value", Number.isFinite(value) ? Math.round(value) : "--");
    this._setText("battery-unit", Number.isFinite(value) ? "%" : "");
    const node = this.shadowRoot.querySelector(".battery.energy-node");
    if (!node) return;
    node.classList.toggle("low", Number.isFinite(value) && value <= this._config.thresholds.battery_low);
    node.classList.toggle("unavailable", !Number.isFinite(value));
    const icon = node.querySelector("ha-icon");
    if (icon) icon.setAttribute("icon", this._batteryIcon(value));
  }

  _updateOutlets() {
    const items = this.shadowRoot.querySelectorAll("[data-outlet-index]");
    items.forEach((button) => {
      const item = this._config.outlets[Number(button.dataset.outletIndex)];
      const state = item && item.entity ? this._state(item.entity) : null;
      const isOn = state && ["on", "open", "playing", "active"].includes(state.state);
      button.classList.toggle("on", Boolean(isOn));
      button.classList.toggle("unavailable", Boolean(item && item.entity && (!state || state.state === "unavailable")));
    });
  }

  _updateRadio() {
    const radio = this._config.radio;
    const player = this._state(radio.media_player);
    const station = this._state(radio.current_station);
    const playbackStatus = this._state(radio.playback_status);
    const volumeEntity = this._state(radio.volume);
    const state = player ? player.state : "unavailable";
    const playbackState = playbackStatus && !["unknown", "unavailable", ""].includes(playbackStatus.state)
      ? playbackStatus.state
      : state;
    const playing = state === "playing" || String(playbackState).toLowerCase() === "playing";

    const rawStationName = station && !["unknown", "unavailable", ""].includes(station.state)
      ? station.state
      : (player && player.attributes.media_title) || "WI-FI RADIO";
    const configuredStations = Array.isArray(radio.stations) ? radio.stations : [];
    const normalizedStation = String(rawStationName).toLowerCase();
    const activeStation = configuredStations.find((item) => {
      const expected = item.option || item.match || item.name;
      return expected && normalizedStation === String(expected).toLowerCase();
    }) || configuredStations.find((item) => {
      const expected = item.option || item.match || item.name;
      return expected && normalizedStation.includes(String(expected).toLowerCase());
    });
    const stationName = activeStation && activeStation.name ? activeStation.name : rawStationName;
    const trackName = player && (player.attributes.media_artist || player.attributes.media_channel)
      ? (player.attributes.media_artist || player.attributes.media_channel)
      : (playbackState && playbackState !== "unavailable" ? playbackState : (playing ? "Now playing" : "Ready"));

    this._setText("station-name", stationName);
    this._setText("track-name", trackName);
    this._setText("radio-state", state === "unavailable" ? "OFFLINE" : String(playbackState).toUpperCase());
    this.$("radio-state").classList.toggle("active", playing);
    this.$("play-icon").setAttribute("icon", playing ? "mdi:pause" : "mdi:play");

    let volume = NaN;
    if (volumeEntity) volume = Number(volumeEntity.state);
    else if (player && Number.isFinite(Number(player.attributes.volume_level))) {
      volume = Number(player.attributes.volume_level) * 100;
    }
    if (!Number.isFinite(volume)) volume = 0;
    volume = Math.max(0, Math.min(100, volume));
    if (this.shadowRoot.activeElement !== this.$("radio-volume")) this.$("radio-volume").value = String(Math.round(volume));
    this.$("radio-volume").style.setProperty("--volume", `${volume}%`);
    this._setText("volume-value", `${Math.round(volume)}%`);

    const current = String(rawStationName).toLowerCase();
    this.shadowRoot.querySelectorAll("[data-station-index]").forEach((button) => {
      const item = radio.stations && radio.stations[Number(button.dataset.stationIndex)];
      const match = item && (item.option || item.match || item.name);
      button.classList.toggle("active", Boolean(match && current.includes(String(match).toLowerCase())));
    });
  }

  async _toggleOutlet(index) {
    const item = this._config.outlets[index];
    if (!item || !item.entity || !this._hass) return;
    await this._hass.callService("homeassistant", "toggle", { entity_id: item.entity });
  }

  async _selectStation(index) {
    const station = this._config.radio.stations && this._config.radio.stations[index];
    if (!station || !this._hass) return;
    if (this._config.radio.station_select && station.option) {
      await this._hass.callService("select", "select_option", {
        entity_id: this._config.radio.station_select,
        option: station.option,
      });
      if (this._config.radio.play_selected) {
        await this._hass.callService("button", "press", { entity_id: this._config.radio.play_selected });
      }
    } else if (station.entity) {
      await this._hass.callService("button", "press", { entity_id: station.entity });
    } else if (station.media_content_id && this._config.radio.media_player) {
      await this._hass.callService("media_player", "play_media", {
        entity_id: this._config.radio.media_player,
        media_content_id: station.media_content_id,
        media_content_type: station.media_content_type || "music",
      });
    }
  }

  async _playPause() {
    if (!this._hass) return;
    const radio = this._config.radio;
    if (radio.play_pause) {
      await this._hass.callService("button", "press", { entity_id: radio.play_pause });
    } else if (radio.media_player) {
      await this._hass.callService("media_player", "media_play_pause", { entity_id: radio.media_player });
    }
  }

  async _transport(direction) {
    if (!this._hass) return;
    const radio = this._config.radio;
    const configuredButton = direction === "previous" ? radio.previous : radio.next;
    if (configuredButton) {
      await this._hass.callService("button", "press", { entity_id: configuredButton });
    } else if (radio.media_player) {
      await this._hass.callService("media_player", direction === "previous" ? "media_previous_track" : "media_next_track", {
        entity_id: radio.media_player,
      });
    }
  }

  async _setVolume(value) {
    if (!this._hass) return;
    const radio = this._config.radio;
    if (radio.volume) {
      await this._hass.callService("number", "set_value", { entity_id: radio.volume, value });
    } else if (radio.media_player) {
      await this._hass.callService("media_player", "volume_set", {
        entity_id: radio.media_player,
        volume_level: value / 100,
      });
    }
  }

  _openEnergyEntity(kind) {
    const map = {
      solar: this._config.entities.solar_power,
      grid: this._config.entities.grid_power,
      home: this._config.entities.home_power,
      battery: this._config.entities.battery_soc,
      inverter: this._config.entities.load_percent || this._config.entities.home_power,
    };
    this._moreInfo(map[kind]);
  }

  _openSummaryEntity(id) {
    const map = {
      "today-value": this._config.entities.grid_energy_today,
      "charged-value": this._config.entities.battery_charge_today,
      "discharged-value": this._config.entities.battery_discharge_today,
    };
    this._moreInfo(map[id]);
  }

  _moreInfo(entityId) {
    if (!entityId) return;
    const event = new Event("hass-more-info", { bubbles: true, composed: true });
    event.detail = { entityId };
    this.dispatchEvent(event);
  }

  _inverterSecondary() {
    const e = this._config.entities;
    const voltage = this._number(e.battery_voltage);
    const temperature = this._number(e.inverter_temperature);
    if (Number.isFinite(voltage)) return `${voltage.toFixed(1)} V`;
    if (Number.isFinite(temperature)) return `${Math.round(temperature)} °C`;
    const home = this._state(e.home_power);
    return home && home.state !== "unavailable" ? "Online" : "Offline";
  }

  _batteryInfo(soc, batteryPowerWatts) {
    const cutoffEntity = this._config.grid_cutoff_soc_entity;
    const entityCutoff = this._number(cutoffEntity);
    const configuredCutoff = Number(this._config.grid_cutoff_soc);
    const cutoff = Number.isFinite(entityCutoff)
      ? entityCutoff
      : (Number.isFinite(configuredCutoff) ? configuredCutoff : NaN);
    const capacity = Number(this._config.battery_capacity_kwh);
    const cutoffText = Number.isFinite(cutoff) ? `GRID AT ${Math.round(cutoff)}%` : "GRID AT --%";
    const label = Number.isFinite(cutoff) ? `BATTERY · GRID ${Math.round(cutoff)}%` : "BATTERY";

    if (!Number.isFinite(batteryPowerWatts)) {
      return { label, meta: `${cutoffText} • ETA --` };
    }

    const powerText = this._humanPower(Math.abs(batteryPowerWatts), "W");
    const formattedPower = `${powerText.value} ${powerText.unit}`;
    const powerKw = batteryPowerWatts / 1000;
    if (Math.abs(powerKw) < 0.02) return { label, meta: `IDLE • ${cutoffText}` };

    if (!Number.isFinite(soc) || !Number.isFinite(capacity) || capacity <= 0) {
      return {
        label,
        meta: powerKw > 0 ? `CHARGE ${formattedPower} • ETA --` : `TO HOME ${formattedPower} • ETA --`,
      };
    }

    if (powerKw > 0) {
      const energyToFull = Math.max(0, (100 - soc) / 100 * capacity);
      return { label, meta: `CHARGE ${formattedPower} • FULL ${this._formatDuration(energyToFull / powerKw)}` };
    }

    const effectiveCutoff = Number.isFinite(cutoff) ? cutoff : 0;
    if (soc <= effectiveCutoff) return { label, meta: `TO HOME ${formattedPower} • GRID NOW` };
    const availableEnergy = Math.max(0, (soc - effectiveCutoff) / 100 * capacity);
    return { label, meta: `TO HOME ${formattedPower} • GRID ${this._formatDuration(availableEnergy / Math.abs(powerKw))}` };
  }

  _powerToWatts(entityId, value) {
    if (!Number.isFinite(value)) return NaN;
    const state = this._state(entityId);
    const unit = state && state.attributes && state.attributes.unit_of_measurement
      ? String(state.attributes.unit_of_measurement).toLowerCase()
      : "w";
    return unit === "kw" ? value * 1000 : value;
  }

  _formatDuration(hours) {
    if (!Number.isFinite(hours) || hours < 0 || hours > 240) return "--";
    const totalMinutes = Math.max(1, Math.round(hours * 60));
    const wholeHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (!wholeHours) return `${minutes}m`;
    return minutes ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
  }

  _setFlow(id, active, reverse) {
    const element = this.$(id);
    if (!element) return;
    element.classList.toggle("active", Boolean(active));
    element.classList.toggle("reverse", Boolean(reverse));
  }

  _state(entityId) {
    return entityId && this._hass && this._hass.states ? this._hass.states[entityId] : null;
  }

  _number(entityId) {
    const state = this._state(entityId);
    if (!state || ["unknown", "unavailable", "none", ""].includes(state.state)) return NaN;
    const value = Number(state.state);
    return Number.isFinite(value) ? value : NaN;
  }

  _humanPower(value, rawUnit) {
    if (!Number.isFinite(value)) return { value: "--", unit: "" };
    const unit = String(rawUnit || "W").toLowerCase();
    const watts = unit === "kw" ? value * 1000 : value;
    if (Math.abs(watts) >= 1000) return { value: (watts / 1000).toFixed(Math.abs(watts) >= 10000 ? 1 : 2), unit: "kW" };
    return { value: Math.round(watts).toString(), unit: "W" };
  }

  _formatValue(entityId, fallbackUnit = "") {
    const state = this._state(entityId);
    const value = this._number(entityId);
    if (!Number.isFinite(value)) return "--";
    const unit = (state && state.attributes.unit_of_measurement) || fallbackUnit;
    return `${Math.round(value)}${unit ? ` ${unit}` : ""}`;
  }

  _formatEnergy(entityId) {
    const state = this._state(entityId);
    const value = this._number(entityId);
    if (!Number.isFinite(value)) return "--";
    const unit = (state && state.attributes.unit_of_measurement) || "kWh";
    return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
  }

  _formatTemperature(entityId) {
    const value = this._number(entityId);
    return Number.isFinite(value) ? `${Math.round(value)}°` : "--";
  }

  _batteryIcon(value) {
    if (!Number.isFinite(value)) return "mdi:battery-unknown";
    if (value <= 10) return "mdi:battery-alert-variant-outline";
    const step = Math.min(100, Math.max(20, Math.round(value / 10) * 10));
    return step === 100 ? "mdi:battery" : `mdi:battery-${step}`;
  }

  _startClock() {
    if (this._clockTimer) clearInterval(this._clockTimer);
    this._updateClock();
    this._clockTimer = setInterval(() => this._updateClock(), 1000);
  }

  _updateClock() {
    if (!this._built) return;
    const now = new Date();
    this._setText("clock", now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }));
    this._setText("date", now.toLocaleDateString("en-GB", { day: "numeric", month: "long" }));
  }

  _setText(id, value) {
    const element = this.$(id);
    if (element && element.textContent !== String(value)) element.textContent = String(value);
  }

  $(id) {
    return this.shadowRoot.getElementById(id);
  }

  _escape(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  _styles() {
    return `
      :host {
        --panel: #111a23;
        --panel-soft: #16212c;
        --line: #344454;
        --text: #f4f7fa;
        --muted: #9cabbc;
        --blue: #17b9f2;
        --green: #3fea87;
        --amber: #ffbd2e;
        --red: #ff5964;
        display: block;
        color: var(--text);
        font-family: Roboto, system-ui, sans-serif;
      }
      * { box-sizing: border-box; }
      button { font: inherit; color: #f4f7fa !important; -webkit-tap-highlight-color: transparent; }
      ha-card {
        height: min(500px, calc(100vh - 92px));
        min-height: 460px;
        overflow: hidden;
        border: 0;
        border-radius: 0;
        background: radial-gradient(circle at 48% 42%, #162331 0, #0b1219 55%, #081017 100%);
        box-shadow: none;
        color: #f4f7fa !important;
        --primary-text-color: #f4f7fa;
        --secondary-text-color: #9cabbc;
      }
      .shell { height: 100%; padding: 8px 16px 10px; color: #f4f7fa; }
      .topbar { height: 42px; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; }
      .datetime { display: flex; align-items: baseline; gap: 20px; }
      #clock { color: #f4f7fa; font-size: 31px; font-weight: 800; letter-spacing: .02em; line-height: 1; }
      #date { color: var(--muted); font-size: 18px; font-weight: 600; }
      .status-strip { display: flex; align-items: center; gap: 10px; color: #d9e5ef; font-size: 19px; font-weight: 700; }
      .status-strip ha-icon { width: 25px; height: 25px; }
      .divider { width: 1px; height: 28px; background: var(--line); margin: 0 6px; }
      .dashboard { height: calc(100% - 42px); display: grid; grid-template-columns: minmax(0, 3fr) minmax(360px, 2fr); gap: 10px; }
      .panel { border: 1px solid #334353; border-radius: 14px; background: rgba(12, 20, 28, .72); }
      .energy-panel { display: grid; grid-template-rows: minmax(0, 1fr) 84px; min-width: 0; overflow: hidden; }
      .energy-map { position: relative; min-height: 0; }
      .energy-node {
        position: absolute; display: flex; align-items: center; gap: 13px; min-width: 0;
        border: 1px solid var(--line); border-radius: 12px; background: linear-gradient(145deg, #17222d, #101821);
        padding: 13px 16px; cursor: pointer; text-align: left; z-index: 2; overflow: hidden;
      }
      .energy-node:active, .summary-item:active, .outlet:active, .station:active, .round:active { transform: scale(.97); }
      .energy-node > ha-icon { position: absolute; left: 10px; width: 28px; height: 28px; }
      .energy-node > div { min-width: 0; width: 100%; text-align: center; }
      .energy-node span { display: block; color: var(--muted); font-size: 14px; font-weight: 800; letter-spacing: .03em; }
      .energy-node strong { display: block; color: #f4f7fa; margin-top: 4px; font-size: 25px; line-height: 1; white-space: nowrap; }
      .energy-node strong b { font: inherit; }
      .energy-node small { font-size: 16px; }
      .solar { width: 220px; height: 86px; top: 18px; left: 50%; transform: translateX(-50%); border-color: #b68c2d; }
      .solar ha-icon, .solar strong { color: var(--amber); }
      .grid { width: 160px; height: 96px; top: 50%; left: 18px; transform: translateY(-50%); border-color: #188cb7; }
      .grid ha-icon, .grid strong { color: var(--blue); }
      .home { width: 160px; height: 96px; top: 50%; right: 18px; transform: translateY(-50%); }
      .home ha-icon { color: #eaf3fb; }
      .home strong { color: #f4f7fa; }
      .battery { width: 205px; height: 92px; bottom: 18px; left: 50%; transform: translateX(-50%); border-color: #2ea963; }
      .battery ha-icon, .battery strong { color: var(--green); }
      .battery #battery-label { font-size: 10.5px; letter-spacing: .02em; }
      .battery.low { border-color: var(--red); }
      .battery.low ha-icon, .battery.low strong { color: var(--red); }
      .battery-meta { display: block; margin-top: 5px; color: #9cabbc; font-size: 10px; font-style: normal; font-weight: 700; line-height: 1; white-space: nowrap; }
      .inverter { width: 180px; height: 106px; top: 50%; left: 50%; transform: translate(-50%, -50%); justify-content: center; padding: 10px 12px; text-align: center; }
      .inverter > ha-icon { display: none; }
      .inverter-copy { display: grid; gap: 4px; width: 100%; text-align: center; }
      .inverter-copy strong { color: #f4f7fa; font-size: 15px; line-height: 1.15; margin: 0 0 2px; white-space: nowrap; }
      .inverter-copy span { font-size: 14px; font-weight: 600; }
      .inverter-copy b { color: var(--blue); font-size: 20px; }
      .energy-node.unavailable { opacity: .45; }
      .flow { position: absolute; z-index: 1; color: #637587; opacity: .32; overflow: hidden; display: flex; align-items: center; justify-content: space-around; font-size: 33px; font-weight: 900; }
      .flow span { display: block; line-height: 1; }
      .flow.active { opacity: 1; }
      .flow.active span { animation: pulse-arrow 1.1s infinite; }
      .flow.active span:nth-child(2) { animation-delay: .18s; }
      .flow.active span:nth-child(3) { animation-delay: .36s; }
      .flow.reverse { flex-direction: row-reverse; }
      .flow.horizontal.reverse span { transform: rotate(180deg); }
      .flow.vertical { flex-direction: column; }
      .flow.vertical span { transform: rotate(90deg); }
      .flow.vertical.reverse { flex-direction: column-reverse; }
      .flow.vertical.reverse span { transform: rotate(-90deg); }
      .solar-flow { color: var(--amber); width: 38px; height: calc(50% - 157px); top: 104px; left: calc(50% - 19px); }
      .grid-flow { color: var(--blue); height: 38px; width: calc(50% - 268px); top: calc(50% - 19px); left: 178px; }
      .home-flow { color: #eaf3fb; height: 38px; width: calc(50% - 268px); top: calc(50% - 19px); right: 178px; }
      .battery-flow { color: var(--green); width: 38px; height: calc(50% - 163px); bottom: 110px; left: calc(50% - 19px); }
      @keyframes pulse-arrow { 0%, 100% { opacity: .2; } 45% { opacity: 1; } }
      .energy-summary { border-top: 1px solid #2c3b49; display: grid; grid-template-columns: repeat(3, 1fr); padding: 10px 14px; }
      .summary-item { display: flex; align-items: center; gap: 12px; padding: 4px 12px; background: none; border: 0; text-align: left; cursor: pointer; min-width: 0; }
      .summary-item + .summary-item { border-left: 1px solid #344454; }
      .summary-item ha-icon { width: 32px; height: 32px; flex: 0 0 32px; }
      .summary-item span { color: var(--muted); font-size: 13px; font-weight: 700; }
      .summary-item strong { display: block; color: #f4f7fa; margin-top: 3px; font-size: 20px; white-space: nowrap; }
      .summary-item.green ha-icon { color: var(--green); }
      .summary-item.amber ha-icon { color: var(--amber); }
      .side-column { min-width: 0; display: grid; grid-template-rows: 184px minmax(0, 1fr); gap: 10px; }
      h2 { color: #f4f7fa; margin: 0; font-size: 20px; letter-spacing: .02em; }
      .outlets-panel { padding: 14px; }
      .outlet-grid { height: calc(100% - 36px); margin-top: 11px; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 8px; }
      .outlet { border: 1px solid #3a4a59; border-radius: 11px; background: #151f29; display: grid; grid-template-columns: 34px 1fr 29px; align-items: center; gap: 9px; padding: 9px 11px; cursor: pointer; text-align: left; }
      .outlet ha-icon { width: 31px; height: 31px; color: #c9d5e0; }
      .outlet span { color: #f4f7fa; overflow: hidden; text-overflow: ellipsis; font-size: 16px; font-weight: 700; white-space: nowrap; }
      .toggle-dot { width: 29px; height: 17px; border-radius: 12px; background: #34414e; position: relative; }
      .toggle-dot::after { content: ""; position: absolute; width: 13px; height: 13px; border-radius: 50%; top: 2px; left: 2px; background: #aeb9c5; transition: left .18s; }
      .outlet.on { border-color: var(--green); background: linear-gradient(145deg, rgba(28, 116, 67, .55), rgba(15, 48, 34, .72)); }
      .outlet.on ha-icon { color: var(--green); }
      .outlet.on .toggle-dot { background: var(--green); }
      .outlet.on .toggle-dot::after { left: 14px; background: white; }
      .outlet:disabled { opacity: .38; cursor: default; }
      .outlet.unavailable { opacity: .45; }
      .radio-panel { padding: 11px 14px 10px; display: grid; grid-template-rows: auto auto 58px 28px 1fr; row-gap: 4px; min-height: 0; }
      .radio-heading { display: flex; justify-content: space-between; align-items: center; }
      .status-pill { border: 1px solid #3d4d5c; border-radius: 999px; color: var(--muted); padding: 3px 8px; font-size: 10px; font-weight: 800; }
      .status-pill.active { color: var(--green); border-color: rgba(63, 234, 135, .55); }
      .now-playing { min-width: 0; text-align: center; display: grid; gap: 2px; }
      .now-playing strong { color: #f4f7fa; font-size: 20px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .now-playing span { color: var(--muted); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .transport { display: flex; align-items: center; justify-content: center; gap: 31px; }
      .round { display: grid; place-items: center; border-radius: 50%; cursor: pointer; }
      .round ha-icon { width: 31px; height: 31px; }
      .round.secondary { width: 43px; height: 43px; border: 1px solid #425263; background: #202b36; }
      .round.primary { width: 56px; height: 56px; border: 1px solid #52aef1; background: linear-gradient(145deg, #21a8f4, #0875df); box-shadow: 0 7px 20px rgba(0, 126, 235, .24); }
      .round.primary ha-icon { width: 38px; height: 38px; }
      .volume-row { display: grid; grid-template-columns: 24px 1fr 39px; align-items: center; gap: 9px; }
      .volume-row ha-icon { width: 23px; height: 23px; }
      .volume-row span { color: #d4deea; font-size: 14px; font-weight: 700; text-align: right; }
      input[type="range"] { --volume: 0%; appearance: none; height: 6px; border-radius: 5px; outline: none; background: linear-gradient(to right, #159ff0 0 var(--volume), #293542 var(--volume) 100%); }
      input[type="range"]::-webkit-slider-thumb { appearance: none; width: 17px; height: 17px; border-radius: 50%; background: #f3f8fc; box-shadow: 0 1px 5px #0008; }
      .station-grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 6px; min-height: 0; }
      .station { color: #f4f7fa !important; border: 1px solid #394957; border-radius: 9px; background: #151f29; font-size: 12px; font-weight: 800; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 3px 7px; }
      .station.active { border-color: #159ff0; background: linear-gradient(145deg, #148ee8, #0967c7); }
      @media (max-width: 900px) {
        .shell { padding-left: 8px; padding-right: 8px; }
        .dashboard { grid-template-columns: minmax(0, 1fr); }
        .energy-panel { display: none; }
      }
    `;
  }
}

class AnenjiWallPanelEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._openSections = new Set(["general", "energy"]);
  }

  set hass(hass) {
    this._hass = hass;
    this._hydratePickers();
  }

  setConfig(config) {
    const stub = AnenjiWallPanel.getStubConfig();
    const incoming = config || {};
    this._config = {
      ...stub,
      ...incoming,
      entities: { ...stub.entities, ...(incoming.entities || {}) },
      outlets: this._normaliseRows(incoming.outlets, stub.outlets, 4),
      radio: {
        ...stub.radio,
        ...(incoming.radio || {}),
        stations: this._normaliseRows(
          incoming.radio && incoming.radio.stations,
          stub.radio.stations,
          4
        ),
      },
      thresholds: { ...stub.thresholds, ...(incoming.thresholds || {}) },
    };
    this._render();
  }

  _normaliseRows(rows, fallback, count) {
    const source = Array.isArray(rows) ? rows : [];
    return Array.from({ length: count }, (_, index) => ({
      ...(fallback[index] || {}),
      ...(source[index] || {}),
    }));
  }

  _render() {
    if (!this._config) return;
    const stationOptions = this._stationOptions();
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; color: var(--primary-text-color); }
        .editor { display: grid; gap: 10px; padding: 4px 0 12px; }
        .intro { color: var(--secondary-text-color); font-size: 13px; line-height: 1.45; padding: 0 2px 4px; }
        details { border: 1px solid var(--divider-color); border-radius: 10px; overflow: hidden; background: var(--card-background-color); }
        summary { cursor: pointer; padding: 13px 14px; font-weight: 700; user-select: none; }
        .section { display: grid; gap: 12px; padding: 4px 14px 16px; }
        .grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .row-card { display: grid; grid-template-columns: 1fr; gap: 10px; padding: 10px; border: 1px solid var(--divider-color); border-radius: 9px; }
        .station-row { grid-template-columns: 1fr; }
        label { display: grid; gap: 6px; color: var(--secondary-text-color); font-size: 12px; }
        input, select { width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid var(--divider-color); border-radius: 8px; background: var(--input-fill-color, var(--card-background-color)); color: var(--primary-text-color); font: inherit; box-sizing: border-box; }
        ha-entity-picker { width: 100%; }
        .hint { color: var(--secondary-text-color); font-size: 12px; line-height: 1.35; }
      </style>
      <div class="editor">
        <div class="intro">Choose entities here. YAML is not required. Required fields are marked with an asterisk.</div>

        ${this._section("general", "General", `
          <div class="grid">
            ${this._textField("Panel title", "title")}
            ${this._entityField("Indoor temperature", "indoor_temperature", ["sensor"])}
            ${this._numberField("Battery capacity (kWh)", "battery_capacity_kwh", 0, 1000)}
            ${this._numberField("Switch to grid at (%)", "grid_cutoff_soc", 0, 100)}
            ${this._entityField("Switch-to-grid percentage entity", "grid_cutoff_soc_entity", ["sensor", "number", "input_number"])}
          </div>
          <div class="grid">
            ${this._numberField("Active flow threshold (W)", "thresholds.active_power", 0, 1000)}
            ${this._numberField("Low battery threshold (%)", "thresholds.battery_low", 0, 100)}
          </div>
        `)}

        ${this._section("energy", "Energy entities", `
          <div class="grid">
            ${this._entityField("Solar power *", "entities.solar_power", ["sensor"])}
            ${this._entityField("Combined grid power *", "entities.grid_power", ["sensor"])}
            ${this._entityField("Home load power *", "entities.home_power", ["sensor"])}
            ${this._entityField("Battery state of charge *", "entities.battery_soc", ["sensor"])}
            ${this._entityField("Signed battery power (+ charge / − discharge)", "entities.battery_power", ["sensor"])}
            ${this._entityField("Battery charging power", "entities.battery_charge_power", ["sensor"])}
            ${this._entityField("Battery discharging power", "entities.battery_discharge_power", ["sensor"])}
            ${this._entityField("Battery voltage", "entities.battery_voltage", ["sensor"])}
            ${this._entityField("Inverter load percent", "entities.load_percent", ["sensor"])}
            ${this._entityField("Inverter temperature", "entities.inverter_temperature", ["sensor"])}
            ${this._entityField("Grid import today", "entities.grid_energy_today", ["sensor"])}
            ${this._entityField("Battery charged today", "entities.battery_charge_today", ["sensor"])}
            ${this._entityField("Battery discharged today", "entities.battery_discharge_today", ["sensor"])}
          </div>
          <div class="hint">Combined grid power should contain Grid to Battery + Grid to Load. Use either one signed battery-power entity (positive = charging) or separate charging/discharging entities. If all are empty, battery flow is estimated as Solar + Grid − Home.</div>
        `)}

        ${this._section("outlets", "Outlets", this._config.outlets.map((item, index) => `
          <div class="row-card">
            ${this._textField("Name", `outlets.${index}.name`)}
            ${this._entityField("Entity", `outlets.${index}.entity`, ["switch", "input_boolean", "light"])}
            ${this._textField("Icon", `outlets.${index}.icon`)}
          </div>
        `).join(""))}

        ${this._section("radio", "Wi-Fi Radio", `
          <div class="grid">
            ${this._entityField("Media player", "radio.media_player", ["media_player"])}
            ${this._entityField("Current station", "radio.current_station", ["sensor"])}
            ${this._entityField("Playback status", "radio.playback_status", ["sensor"])}
            ${this._entityField("Volume", "radio.volume", ["number", "input_number"])}
            ${this._entityField("Play / Pause", "radio.play_pause", ["button", "script"])}
            ${this._entityField("Previous station", "radio.previous", ["button", "script"])}
            ${this._entityField("Next station", "radio.next", ["button", "script"])}
            ${this._entityField("Station selector", "radio.station_select", ["select", "input_select"])}
            ${this._entityField("Play selected", "radio.play_selected", ["button", "script"])}
          </div>
        `)}

        ${this._section("stations", "Station presets", `
          <datalist id="station-options">
            ${stationOptions.map((option) => `<option value="${this._escape(option)}"></option>`).join("")}
          </datalist>
          ${this._config.radio.stations.map((station, index) => `
            <div class="row-card station-row">
              ${this._textField("Button label", `radio.stations.${index}.name`)}
              ${this._textField("Station option", `radio.stations.${index}.option`, "station-options")}
            </div>
          `).join("")}
          <div class="hint">Station option must exactly match an option from the selected station entity.</div>
        `)}
      </div>
    `;

    this._bindEditorEvents();
    this._hydratePickers();
  }

  _section(id, title, content) {
    return `<details data-section="${id}" ${this._openSections.has(id) ? "open" : ""}>
      <summary>${title}</summary><div class="section">${content}</div>
    </details>`;
  }

  _entityField(label, path, domains) {
    return `<label>${label}<ha-entity-picker data-entity-path="${path}" data-domains="${domains.join(",")}"></ha-entity-picker></label>`;
  }

  _textField(label, path, listId = "") {
    const value = this._getPath(path);
    return `<label>${label}<input type="text" data-config-path="${path}" value="${this._escape(value || "")}" ${listId ? `list="${listId}"` : ""}></label>`;
  }

  _numberField(label, path, min, max) {
    const value = this._getPath(path);
    return `<label>${label}<input type="number" data-config-path="${path}" value="${this._escape(value == null ? "" : value)}" min="${min}" max="${max}"></label>`;
  }

  _bindEditorEvents() {
    this.shadowRoot.querySelectorAll("details[data-section]").forEach((details) => {
      details.addEventListener("toggle", () => {
        if (details.open) this._openSections.add(details.dataset.section);
        else this._openSections.delete(details.dataset.section);
      });
    });

    this.shadowRoot.querySelectorAll("[data-config-path]").forEach((input) => {
      input.addEventListener("change", () => {
        const value = input.type === "number" && input.value !== "" ? Number(input.value) : input.value;
        this._setPath(input.dataset.configPath, value);
      });
    });
  }

  _hydratePickers() {
    if (!this.shadowRoot || !this._config) return;
    this.shadowRoot.querySelectorAll("ha-entity-picker[data-entity-path]").forEach((picker) => {
      if (picker.dataset.bound !== "true") {
        picker.addEventListener("value-changed", (event) => {
          this._setPath(picker.dataset.entityPath, event.detail && event.detail.value ? event.detail.value : "");
        });
        picker.dataset.bound = "true";
      }
      picker.hass = this._hass;
      picker.value = this._getPath(picker.dataset.entityPath) || "";
      picker.includeDomains = picker.dataset.domains.split(",");
      picker.allowCustomEntity = true;
    });
  }

  _stationOptions() {
    if (!this._hass || !this._config || !this._config.radio.station_select) return [];
    const state = this._hass.states[this._config.radio.station_select];
    return state && state.attributes && Array.isArray(state.attributes.options)
      ? state.attributes.options
      : [];
  }

  _getPath(path) {
    return path.split(".").reduce((value, key) => value == null ? undefined : value[key], this._config);
  }

  _setPath(path, value) {
    const config = JSON.parse(JSON.stringify(this._config));
    const keys = path.split(".");
    let target = config;
    keys.forEach((key, index) => {
      if (index === keys.length - 1) {
        if (value === "") delete target[key];
        else target[key] = value;
      } else {
        if (target[key] == null) target[key] = /^\d+$/.test(keys[index + 1]) ? [] : {};
        target = target[key];
      }
    });
    this._config = config;
    const event = new Event("config-changed", { bubbles: true, composed: true });
    event.detail = { config };
    this.dispatchEvent(event);
  }

  _escape(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

if (!customElements.get("anenji-wall-panel-editor")) {
  customElements.define("anenji-wall-panel-editor", AnenjiWallPanelEditor);
}

if (!customElements.get("anenji-wall-panel")) {
  customElements.define("anenji-wall-panel", AnenjiWallPanel);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "anenji-wall-panel",
  name: "Anenji Wall Panel",
  description: "One-screen energy, outlet, and Wi-Fi radio dashboard for a 1024×600 wall tablet.",
  preview: true,
});
