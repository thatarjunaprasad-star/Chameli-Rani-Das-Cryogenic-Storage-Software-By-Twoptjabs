/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from "react";
import { LogEntry, LogSeverity } from "../types";

interface DiagnosticsLogProps {
  logs: LogEntry[];
}

export default function DiagnosticsLog({ logs }: DiagnosticsLogProps) {
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Since logs are added at the beginning of the array (newest first),
  // they are displayed list-reversed or we can just render the array from top to bottom.
  // Rendering the list as-is shows the newest on top which is excellent for scanning during high fast-frequency updates.

  return (
    <div className="flex flex-col bg-card-bg border border-grid-gray rounded-xl p-4 h-[250px]">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-mono font-bold text-white tracking-wider flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-cyan opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-cyan"></span>
          </span>
          HIGH-FREQUENCY DIAGNOSTICS LOG
        </h3>
        <span className="text-[9px] font-mono text-text-muted bg-grid-gray/30 px-1.5 py-0.5 rounded border border-grid-gray/20">
          500 Hz Bus
        </span>
      </div>

      <div className="flex-1 bg-slate-950/70 rounded-lg p-3 font-mono text-xs overflow-y-auto border border-grid-gray/40 custom-scrollbar shadow-inner">
        <div className="space-y-2">
          {logs.map((log) => {
            const severityColor =
              log.severity === LogSeverity.INFO
                ? "text-text-muted"
                : log.severity === LogSeverity.WARNING
                ? "text-cyber-orange"
                : log.severity === LogSeverity.CRITICAL
                ? "text-cyber-red font-bold"
                : "text-cyber-green font-bold";

            return (
              <div key={log.id} className="flex gap-2 items-start leading-5 leading-normal select-none">
                <span className="text-cyber-cyan font-bold select-none whitespace-nowrap">
                  [{log.plasmaTimeMs.toFixed(2)} ms]
                </span>
                <span className={severityColor}>{log.message}</span>
              </div>
            );
          })}
        </div>
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
