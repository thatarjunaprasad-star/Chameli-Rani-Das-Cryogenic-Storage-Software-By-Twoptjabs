/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { InstabilityType, INSTABILITIES, PlasmaStatus } from "../types";

interface ControlSandboxProps {
  activeInstability: InstabilityType | null;
  onTriggerInstability: (instability: InstabilityType) => void;
  mitigationModeAuto: boolean;
  onToggleMitigationMode: (auto: boolean) => void;
  onManualMitigate: () => void;
  onResetSimulation: () => void;
  status: PlasmaStatus;
  disruptionProbability: number;
}

export default function ControlSandbox({
  activeInstability,
  onTriggerInstability,
  mitigationModeAuto,
  onToggleMitigationMode,
  onManualMitigate,
  onResetSimulation,
  status,
  disruptionProbability,
}: ControlSandboxProps) {
  // Is triggering manual valve allowed?
  // User should be able to trigger manual mitigation if instability is active OR disruption risk is climbing, and auto mode is OFF, and we are not already mitigated/disrupted.
  const canManualMitigate =
    !mitigationModeAuto &&
    (status === "INSTABILITY_DETECTED" || disruptionProbability > 0.4) &&
    status !== "MITIGATED" &&
    status !== "DISRUPTED";

  return (
    <div className="flex flex-col bg-card-bg border border-grid-gray rounded-xl p-4 gap-4 h-full">
      <div>
        <h3 className="text-xs font-mono font-bold text-white tracking-wider">
          OPERATIONAL TESTBED & MITIGATION SANDBOX
        </h3>
        <p className="text-[10px] text-text-muted mt-0.5 leading-normal">
          Inject a thermal or magnetic anomaly to stress-test the pre-disruption detection algorithms.
        </p>
      </div>

      {/* Anomaly Grid */}
      <div className="space-y-1.5 flex-1">
        <span className="text-[10px] font-mono font-bold text-text-muted tracking-wider block">
          INJECT ANOMALY pre-cursors:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {Object.values(INSTABILITIES).map((inst) => {
            const isActive = activeInstability === inst.key;
            return (
              <button
                key={inst.key}
                onClick={() => onTriggerInstability(inst.key)}
                className={`py-2 px-1.5 rounded text-[10px] font-bold font-mono transition-all duration-300 border cursor-pointer flex flex-col items-center justify-center text-center ${
                  isActive
                    ? "bg-cyber-orange border-cyber-orange text-slate-950 font-extrabold shadow-sm shadow-cyber-orange/20"
                    : "bg-slate-950/40 border-grid-gray/40 text-slate-300 hover:border-text-muted/40 hover:bg-slate-900/40"
                }`}
              >
                <span>{inst.displayName.replace(" (MHD)", "")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mitigation Settings Row */}
      <div className="bg-slate-950/40 border border-grid-gray/30 p-2.5 rounded-lg flex items-center justify-between gap-3">
        <div className="flex-1">
          <h4 className="text-[11px] font-mono font-bold text-slate-200">
            AUTO MITIGATION VALVE CONTROL
          </h4>
          <p className="text-[9px] text-text-muted mt-0.5 leading-normal">
            Triggers cryogenic pellet valves within 10ms of warning threshold.
          </p>
        </div>

        {/* Toggle switch */}
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mitigationModeAuto}
            onChange={(e) => onToggleMitigationMode(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-grid-gray peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-950 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyber-cyan" />
        </label>
      </div>

      {/* Emergency Valves & Reset Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-auto pt-2">
        {/* Manual Mitigation */}
        <button
          onClick={onManualMitigate}
          disabled={!canManualMitigate}
          className={`py-2.5 px-3 rounded text-[10px] font-bold font-mono tracking-wider transition-all border ${
            canManualMitigate
              ? "bg-transparent border-cyber-red text-cyber-red hover:bg-cyber-red/10 cursor-pointer shadow-lg shadow-cyber-red/5 "
              : "border-grid-gray/30 text-text-muted/30 bg-slate-900/20 cursor-not-allowed"
          }`}
        >
          MANUAL VALVE TRIGGER
        </button>

        {/* Reset / Spark Discharge */}
        <button
          onClick={onResetSimulation}
          className="py-2.5 px-3 rounded bg-cyber-cyan hover:bg-cyber-cyan/90 text-slate-950 text-[10px] font-extrabold font-mono tracking-wider transition-all cursor-pointer shadow-md shadow-cyber-cyan/10"
        >
          RESET REACTOR DISCHARGE
        </button>
      </div>
    </div>
  );
}
