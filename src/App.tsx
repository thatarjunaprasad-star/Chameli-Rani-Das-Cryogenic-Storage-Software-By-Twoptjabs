/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Zap, ShieldAlert, Cpu, Database } from "lucide-react";
import {
  TokamakDeviceKey,
  TOKAMAK_DEVICES,
  InstabilityType,
  LogSeverity,
  LogEntry,
  PlasmaStatus,
} from "./types";
import TokamakVisualizer from "./components/TokamakVisualizer";
import LiveTelemetryPlot from "./components/LiveTelemetryPlot";
import ForecastGauge from "./components/ForecastGauge";
import DiagnosticsLog from "./components/DiagnosticsLog";
import ControlSandbox from "./components/ControlSandbox";
import TheorySection from "./components/TheorySection";

interface SimState {
  isSimulating: boolean;
  plasmaStatus: PlasmaStatus;
  activeInstability: InstabilityType | null;
  plasmaCurrent: number;
  safetyFactor: number;
  lockedModeAmplitude: number;
  radiatedPowerRatio: number;
  disruptionProbability: number;
  timeToDisruptionMs: number;
  inferenceLatencyMs: number;
  mitigationTriggered: boolean;
  mitigationTypeTriggered: string | null;
  plasmaTimeCounter: number;
  riskHistory: number[];
  intensityHistory: number[];
}

interface AppState {
  deviceKey: TokamakDeviceKey;
  sim: SimState;
  logs: LogEntry[];
  mitigationModeAuto: boolean;
}

export default function App() {
  const initialDeviceKey = TokamakDeviceKey.DIII_D;
  const initialDevice = TOKAMAK_DEVICES[initialDeviceKey];

  const [appState, setAppState] = useState<AppState>(() => {
    return {
      deviceKey: initialDeviceKey,
      mitigationModeAuto: true,
      logs: [
        {
          id: 1,
          plasmaTimeMs: 0.0,
          message: "AEGIS-Net Model initialized. Scanning baseline diagnostics...",
          severity: LogSeverity.INFO,
        },
      ],
      sim: {
        isSimulating: true,
        plasmaStatus: "STABLE",
        activeInstability: null,
        plasmaCurrent: initialDevice.baselineIp,
        safetyFactor: 3.2,
        lockedModeAmplitude: 0.1,
        radiatedPowerRatio: 0.35,
        disruptionProbability: 0.04,
        timeToDisruptionMs: 999,
        inferenceLatencyMs: 1.24,
        mitigationTriggered: false,
        mitigationTypeTriggered: null,
        plasmaTimeCounter: 0.0,
        riskHistory: Array(40).fill(0.04),
        intensityHistory: Array(40).fill(0.1),
      },
    };
  });

  const [isSimulating, setIsSimulating] = useState<boolean>(true);

  // Timer loop for simulation clock updates based on state changes
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setAppState((prev) => {
        // If simulation is internally stopped, clear standard clock
        if (!prev.sim.isSimulating) {
          setIsSimulating(false);
          return prev;
        }

        const device = TOKAMAK_DEVICES[prev.deviceKey];
        const nextTime = prev.sim.plasmaTimeCounter + 2.0;
        const nextLatency = Math.random() * 0.3 + 1.1; // Latency range 1.1 - 1.4 ms

        let current = prev.sim.plasmaCurrent;
        let safety = prev.sim.safetyFactor;
        let locked = prev.sim.lockedModeAmplitude;
        let rad = prev.sim.radiatedPowerRatio;
        let prob = prev.sim.disruptionProbability;
        let lead = prev.sim.timeToDisruptionMs;
        let status = prev.sim.plasmaStatus;
        let mTriggered = prev.sim.mitigationTriggered;
        let mType = prev.sim.mitigationTypeTriggered;
        let simulating = prev.sim.isSimulating;
        const nextLogs = [...prev.logs];

        const addTickLog = (msg: string, severity: LogSeverity, timeVal: number) => {
          nextLogs.unshift({
            id: Date.now() + Math.random(),
            plasmaTimeMs: timeVal,
            message: msg,
            severity,
          });
        };

        if (status === "STABLE" && prev.sim.activeInstability === null) {
          // Stable fluctuations
          current = Math.max(0.1, device.baselineIp + (Math.random() - 0.5) * 0.04);
          safety = Math.max(1.5, 3.2 + (Math.random() - 0.5) * 0.1);
          locked = Math.max(0.01, 0.1 + Math.random() * 0.15);
          rad = Math.max(0.1, 0.35 + Math.random() * 0.05);
          prob = Math.max(0.0, Math.min(1.0, 0.02 + locked * 0.1));
          lead = 999;
        } else if (prev.sim.activeInstability !== null && status !== "MITIGATED" && status !== "DISRUPTED") {
          status = "INSTABILITY_DETECTED";

          // Degenerate parameters depending on active anomaly
          switch (prev.sim.activeInstability) {
            case InstabilityType.LOCKED_MODE:
              locked += Math.random() * 0.8 + 0.5;
              safety -= 0.08;
              prob = Math.min(0.99, prob + 0.12);
              break;
            case InstabilityType.DENSITY_LIMIT:
              rad += 0.11;
              current -= 0.05;
              prob = Math.min(0.99, prob + 0.09);
              break;
            case InstabilityType.CURRENT_QUENCH:
              safety -= 0.18;
              locked += 0.3;
              prob = Math.min(0.99, prob + 0.15);
              break;
          }

          safety = Math.max(1.1, safety);

          // Deep learning forecast threshold calculation
          if (prob > 0.3) {
            const targetLead = device.warningLeadTime;
            lead = Math.max(3.0, targetLead * (1.1 - prob) + (Math.floor(Math.random() * 9) - 4));
          }

          // Trigger warning log at crossing 0.40 first time
          if (prev.sim.disruptionProbability < 0.4 && prob >= 0.4) {
            addTickLog(
              `DNN ALERT: Anomalous plasma profiles detected. Disruption risk: ${Math.round(prob * 100)}%`,
              LogSeverity.WARNING,
              nextTime
            );
          }

          // Trigger automatic mitigation breach
          if (prob >= 0.85 && !mTriggered) {
            if (prev.mitigationModeAuto) {
              mTriggered = true;
              mType = device.key === TokamakDeviceKey.JET ? "SPI" : "MGI";
              status = "MITIGATED";

              addTickLog(
                `DNN EVENT TRIGGER: Threshold reached (P=${Math.round(prob * 100)}%). Fire command issued in ${nextLatency.toFixed(2)}ms.`,
                LogSeverity.CRITICAL,
                nextTime
              );
              addTickLog(
                `AUTOMATED MITIGATION SUCCESS: ${mType} injected. Thermal energy dissipated safely. Plasma terminated smoothly.`,
                LogSeverity.SUCCESS,
                nextTime + 5
              );
            } else {
              // Manual mitigation waiting room -> terminal crash at 0.98
              if (prob >= 0.98) {
                status = "DISRUPTED";
                simulating = false;
                current = 0.0;
                locked = 12.0;
                rad = 5.0;
                prob = 1.0;
                lead = 0;

                addTickLog(
                  "CRITICAL FAILURE: Plasma Disruption occurred! Violent current quench. Structural walls subjected to immense electromagnetic loads.",
                  LogSeverity.CRITICAL,
                  nextTime
                );
              }
            }
          }
        } else if (status === "MITIGATED") {
          current = Math.max(0.0, current - 0.3);
          locked = Math.max(0.0, locked - 0.4);
          safety = Math.min(10.0, safety + 0.4);
          prob = Math.max(0.01, prob - 0.2);
          lead = 999;

          if (current === 0.0) {
            simulating = false;
            addTickLog("Reactor idle. Ready for next simulation discharge.", LogSeverity.INFO, nextTime);
          }
        }

        const nextRiskHistory = [...prev.sim.riskHistory.slice(1), prob];
        const nextIntensityHistory = [...prev.sim.intensityHistory.slice(1), Math.min(1.0, locked / 5.0)];

        return {
          ...prev,
          logs: nextLogs,
          sim: {
            ...prev.sim,
            plasmaTimeCounter: nextTime,
            inferenceLatencyMs: nextLatency,
            plasmaCurrent: current,
            safetyFactor: safety,
            lockedModeAmplitude: locked,
            radiatedPowerRatio: rad,
            disruptionProbability: prob,
            timeToDisruptionMs: lead,
            plasmaStatus: status,
            mitigationTriggered: mTriggered,
            mitigationTypeTriggered: mType,
            isSimulating: simulating,
            riskHistory: nextRiskHistory,
            intensityHistory: nextIntensityHistory,
          },
        };
      });
    }, 80);

    return () => clearInterval(interval);
  }, [isSimulating, appState.deviceKey, appState.mitigationModeAuto]);

  const activeDevice = TOKAMAK_DEVICES[appState.deviceKey];

  // Action methods
  const handleTriggerInstability = (inst: InstabilityType) => {
    setAppState((prev) => {
      const isTerminated = prev.sim.plasmaStatus === "MITIGATED" || prev.sim.plasmaStatus === "DISRUPTED";
      let nextSim = { ...prev.sim };
      const nextLogs = [...prev.logs];

      if (isTerminated) {
        const device = TOKAMAK_DEVICES[prev.deviceKey];
        nextSim = {
          ...nextSim,
          isSimulating: true,
          plasmaStatus: "STABLE",
          activeInstability: inst,
          plasmaCurrent: device.baselineIp,
          safetyFactor: 3.2,
          lockedModeAmplitude: 0.1,
          radiatedPowerRatio: 0.35,
          disruptionProbability: 0.04,
          timeToDisruptionMs: 999,
          mitigationTriggered: false,
          mitigationTypeTriggered: null,
          riskHistory: Array(40).fill(0.04),
          intensityHistory: Array(40).fill(0.1),
        };
      } else {
        nextSim.activeInstability = inst;
      }

      nextLogs.unshift({
        id: Date.now() + Math.random(),
        plasmaTimeMs: nextSim.plasmaTimeCounter,
        message: `CRITICAL EVENT STIMULATION: Inducing ${INSTABILITIES[inst]?.displayName} anomaly.`,
        severity: LogSeverity.WARNING,
      });

      return {
        ...prev,
        sim: nextSim,
        logs: nextLogs,
      };
    });
    setIsSimulating(true);
  };

  const handleToggleMitigationMode = (auto: boolean) => {
    setAppState((prev) => ({
      ...prev,
      mitigationModeAuto: auto,
    }));
  };

  const handleManualMitigate = () => {
    setAppState((prev) => {
      if (prev.sim.plasmaStatus !== "INSTABILITY_DETECTED" && prev.sim.disruptionProbability <= 0.4) {
        return prev;
      }

      const nextTime = prev.sim.plasmaTimeCounter;
      const nextLogs = [...prev.logs];
      nextLogs.unshift({
        id: Date.now() + Math.random(),
        plasmaTimeMs: nextTime,
        message: "MANUAL INTERVENTION: Reactor Operator fired Shattered Pellet Injector (SPI)!",
        severity: LogSeverity.SUCCESS,
      });

      return {
        ...prev,
        sim: {
          ...prev.sim,
          mitigationTriggered: true,
          mitigationTypeTriggered: "SPI (Manual)",
          plasmaStatus: "MITIGATED",
        },
        logs: nextLogs,
      };
    });
  };

  const handleResetSimulation = () => {
    setAppState((prev) => {
      const device = TOKAMAK_DEVICES[prev.deviceKey];
      const nextLogs = [...prev.logs];
      nextLogs.unshift({
        id: Date.now() + Math.random(),
        plasmaTimeMs: prev.sim.plasmaTimeCounter,
        message: "Simulation parameters reset. Plasma discharge normalized.",
        severity: LogSeverity.INFO,
      });

      return {
        ...prev,
        logs: nextLogs,
        sim: {
          ...prev.sim,
          isSimulating: true,
          plasmaStatus: "STABLE",
          activeInstability: null,
          plasmaCurrent: device.baselineIp,
          safetyFactor: 3.2,
          lockedModeAmplitude: 0.1,
          radiatedPowerRatio: 0.35,
          disruptionProbability: 0.04,
          timeToDisruptionMs: 999,
          mitigationTriggered: false,
          mitigationTypeTriggered: null,
          riskHistory: Array(40).fill(0.04),
          intensityHistory: Array(40).fill(0.1),
        },
      };
    });
    setIsSimulating(true);
  };

  const handleDeviceSelected = (deviceKey: TokamakDeviceKey) => {
    const device = TOKAMAK_DEVICES[deviceKey];
    setAppState((prev) => {
      const nextLogs = [...prev.logs];
      nextLogs.unshift({
        id: Date.now() + Math.random(),
        plasmaTimeMs: prev.sim.plasmaTimeCounter,
        message: `Configured for ${device.deviceName} tokamak. Expected warning window: ${device.warningLeadTime} ms.`,
        severity: LogSeverity.INFO,
      });

      return {
        ...prev,
        deviceKey,
        sim: {
          ...prev.sim,
          isSimulating: true,
          plasmaStatus: "STABLE",
          activeInstability: null,
          plasmaCurrent: device.baselineIp,
          safetyFactor: 3.2,
          lockedModeAmplitude: 0.1,
          radiatedPowerRatio: 0.35,
          disruptionProbability: 0.04,
          timeToDisruptionMs: 999,
          mitigationTriggered: false,
          mitigationTypeTriggered: null,
          riskHistory: Array(40).fill(0.04),
          intensityHistory: Array(40).fill(0.1),
        },
      };
    });
    setIsSimulating(true);
  };

  // Metric status mapping
  const currentMetricColor =
    appState.sim.plasmaCurrent < activeDevice.baselineIp * 0.7 && appState.sim.plasmaCurrent > 0
      ? "text-cyber-orange"
      : "text-slate-100";

  const safetyMetricColor = appState.sim.safetyFactor < 2.0 ? "text-cyber-red animate-pulse" : "text-cyber-green";
  const lockedMetricColor = appState.sim.lockedModeAmplitude > 1.5 ? "text-cyber-red animate-pulse" : "text-cyber-green";
  const radiatedMetricColor = appState.sim.radiatedPowerRatio > 0.9 ? "text-cyber-orange" : "text-cyber-cyan";

  const statusColorMap = {
    STABLE: "bg-cyber-green",
    INSTABILITY_DETECTED: "bg-cyber-orange animate-pulse",
    MITIGATED: "bg-cyber-cyan",
    DISRUPTED: "bg-cyber-red animate-ping",
  };

  const INSTABILITIES = {
    [InstabilityType.LOCKED_MODE]: { displayName: "Locked Mode (MHD)" },
    [InstabilityType.DENSITY_LIMIT]: { displayName: "Greenwald Density Limit" },
    [InstabilityType.CURRENT_QUENCH]: { displayName: "Vertical Displacement Event" },
  };

  return (
    <div className="min-h-screen bg-dark-bg text-slate-100 p-4 font-sans select-none overflow-x-hidden md:py-6">
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
        
        {/* Header Block */}
        <div className="bg-card-bg border border-grid-gray rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-full ${statusColorMap[appState.sim.plasmaStatus]}`} />
              <h1 className="text-sm sm:text-base font-display font-extrabold tracking-widest text-slate-100 uppercase">
                AEGIS-NET // PLASMA CONSOLE
              </h1>
            </div>
            <p className="text-[11px] text-text-muted font-medium mt-0.5">
              Predictive Deep Learning Disruption Mitigation Simulation Platform
            </p>
          </div>

          {/* Tokamak Reactor Tabs */}
          <div className="flex bg-slate-950/60 p-1 rounded-lg border border-grid-gray/40 gap-1 self-stretch sm:self-auto justify-between">
            {Object.values(TOKAMAK_DEVICES).map((dev) => {
              const isSelected = appState.deviceKey === dev.key;
              return (
                <button
                  key={dev.key}
                  onClick={() => handleDeviceSelected(dev.key)}
                  className={`py-1.5 px-3 flex-1 sm:flex-initial rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-cyber-cyan/15 border border-cyber-cyan text-cyber-cyan font-extrabold"
                      : "text-text-muted hover:text-slate-100 border border-transparent"
                  }`}
                >
                  {dev.deviceName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dashboard 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Column A: Telemetry Plot & Sandbox Controls (Span 7) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <LiveTelemetryPlot
              riskHistory={appState.sim.riskHistory}
              intensityHistory={appState.sim.intensityHistory}
              status={appState.sim.plasmaStatus}
            />

            <ControlSandbox
              activeInstability={appState.sim.activeInstability}
              onTriggerInstability={handleTriggerInstability}
              mitigationModeAuto={appState.mitigationModeAuto}
              onToggleMitigationMode={handleToggleMitigationMode}
              onManualMitigate={handleManualMitigate}
              onResetSimulation={handleResetSimulation}
              status={appState.sim.plasmaStatus}
              disruptionProbability={appState.sim.disruptionProbability}
            />
          </div>

          {/* Column B: Chamber Cross Section, AI Forecast & Diagnostics Logs (Span 5) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TokamakVisualizer
                status={appState.sim.plasmaStatus}
                device={activeDevice}
                safetyFactor={appState.sim.safetyFactor}
                lockedMode={appState.sim.lockedModeAmplitude}
                radiatedPower={appState.sim.radiatedPowerRatio}
              />

              <ForecastGauge
                probability={appState.sim.disruptionProbability}
                leadTime={appState.sim.timeToDisruptionMs}
                latency={appState.sim.inferenceLatencyMs}
                status={appState.sim.plasmaStatus}
              />
            </div>

            <DiagnosticsLog logs={appState.logs} />
          </div>
        </div>

        {/* Dynamic Critical Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-1">
          {/* Card 1: Plasma Current */}
          <div className="bg-card-bg border border-grid-gray rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[10px] font-mono text-text-muted tracking-wider uppercase font-bold">
              Plasma Current (Ip)
            </span>
            <span className={`text-2xl font-mono font-bold mt-2 ${currentMetricColor}`}>
              {appState.sim.plasmaCurrent.toFixed(2)} MA
            </span>
            <span className="text-[10px] text-text-muted/60 font-mono mt-1">
              Baseline Target: {activeDevice.baselineIp} MA
            </span>
          </div>

          {/* Card 2: Safety Factor */}
          <div className="bg-card-bg border border-grid-gray rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[10px] font-mono text-text-muted tracking-wider uppercase font-bold">
              Safety Factor (q95)
            </span>
            <span className={`text-2xl font-mono font-bold mt-2 ${safetyMetricColor}`}>
              {appState.sim.safetyFactor.toFixed(2)}
            </span>
            <span className="text-[10px] text-text-muted/60 font-mono mt-1">
              Disruption Limit: &lt; 2.00
            </span>
          </div>

          {/* Card 3: Locked Mode */}
          <div className="bg-card-bg border border-grid-gray rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[10px] font-mono text-text-muted tracking-wider uppercase font-bold">
              Locked Mode Amplitude
            </span>
            <span className={`text-2xl font-mono font-bold mt-2 ${lockedMetricColor}`}>
              {appState.sim.lockedModeAmplitude.toFixed(2)} G
            </span>
            <span className="text-[10px] text-text-muted/60 font-mono mt-1">
              Instability Line: &gt; 1.50 G
            </span>
          </div>

          {/* Card 4: Radiation Ratio */}
          <div className="bg-card-bg border border-grid-gray rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[10px] font-mono text-text-muted tracking-wider uppercase font-bold">
              Rad. Power Ratio
            </span>
            <span className={`text-2xl font-mono font-bold mt-2 ${radiatedMetricColor}`}>
              {Math.round(appState.sim.radiatedPowerRatio * 100)}%
            </span>
            <span className="text-[10px] text-text-muted/60 font-mono mt-1">
              Collapse Alarm: &gt; 90%
            </span>
          </div>
        </div>

        {/* Theoretical Insight Section */}
        <TheorySection />

      </div>
    </div>
  );
}
