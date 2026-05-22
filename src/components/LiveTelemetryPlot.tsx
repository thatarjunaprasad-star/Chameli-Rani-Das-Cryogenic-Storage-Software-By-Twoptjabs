/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import { PlasmaStatus } from "../types";

interface LiveTelemetryPlotProps {
  riskHistory: number[];
  intensityHistory: number[];
  status: PlasmaStatus;
}

export default function LiveTelemetryPlot({
  riskHistory,
  intensityHistory,
  status,
}: LiveTelemetryPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let animOffset = 0;

    const render = () => {
      animOffset += 1;
      const width = canvas.width;
      const height = canvas.height;

      // Clear
      ctx.fillStyle = "#0c1220";
      ctx.fillRect(0, 0, width, height);

      // Draw background grid lines (horizontal)
      ctx.strokeStyle = "rgba(32, 44, 69, 0.4)";
      ctx.lineWidth = 1;
      const gridCountHorizontal = 5;
      for (let i = 0; i <= gridCountHorizontal; i++) {
        const y = (height - 30) * (i / gridCountHorizontal) + 12;
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(width - 15, y);
        ctx.stroke();

        // Label axis y (0.0 to 1.0)
        ctx.fillStyle = "#64748b";
        ctx.font = "9px monospace";
        const val = (1.0 - i / gridCountHorizontal).toFixed(1);
        ctx.fillText(val, 12, y + 3);
      }

      // Draw vertical moving grid lines to indicate simulation pacing
      const gridCountVertical = 8;
      const movingGridOffset = (animOffset * 0.5) % 30;
      for (let i = 0; i < gridCountVertical; i++) {
        const x = 40 + i * ((width - 55) / (gridCountVertical - 1)) - movingGridOffset;
        if (x >= 40 && x <= width - 15) {
          ctx.beginPath();
          ctx.moveTo(x, 12);
          ctx.lineTo(x, height - 18);
          ctx.stroke();
        }
      }

      // Plot boundaries
      const startX = 40;
      const endX = width - 15;
      const plotWidth = endX - startX;
      const plotHeight = height - 30;
      const startY = 12;

      // Draw active plot borders
      ctx.strokeStyle = "#202c45";
      ctx.strokeRect(startX, startY, plotWidth, plotHeight);

      // Helper to compute coordinates
      const getX = (index: number, total: number) => {
        return startX + (index / (total - 1)) * plotWidth;
      };

      const getY = (val: number) => {
        // map 0..1 to startY+plotHeight..startY
        const clamped = Math.max(0, Math.min(1, val));
        return startY + plotHeight - clamped * plotHeight;
      };

      // Plot Disruption Risk (Solid Neon Red)
      if (riskHistory.length > 1) {
        // Shading Under Risk Line
        ctx.fillStyle = "rgba(255, 42, 95, 0.05)";
        ctx.beginPath();
        ctx.moveTo(startX, startY + plotHeight);
        for (let i = 0; i < riskHistory.length; i++) {
          ctx.lineTo(getX(i, riskHistory.length), getY(riskHistory[i]));
        }
        ctx.lineTo(getX(riskHistory.length - 1, riskHistory.length), startY + plotHeight);
        ctx.closePath();
        ctx.fill();

        // Main line
        ctx.strokeStyle = "#ff2a5f";
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(startX, getY(riskHistory[0]));
        for (let i = 1; i < riskHistory.length; i++) {
          ctx.lineTo(getX(i, riskHistory.length), getY(riskHistory[i]));
        }
        ctx.stroke();

        // Add a pulsing glow marker at the very edge (last data point)
        const lastRiskVal = riskHistory[riskHistory.length - 1];
        const lastX = getX(riskHistory.length - 1, riskHistory.length);
        const lastY = getY(lastRiskVal);
        ctx.fillStyle = "#ff2a5f";
        ctx.shadowColor = "#ff2a5f";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }

      // Plot MHD Instability Level (Dashed Orange Line)
      if (intensityHistory.length > 1) {
        ctx.strokeStyle = "#ff9f00";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]); // Dashed
        ctx.beginPath();
        ctx.moveTo(startX, getY(intensityHistory[0]));
        for (let i = 1; i < intensityHistory.length; i++) {
          ctx.lineTo(getX(i, intensityHistory.length), getY(intensityHistory[i]));
        }
        ctx.stroke();
        ctx.setLineDash([]); // Reset
      }

      // Time offset description or ticks on X axis
      ctx.fillStyle = "#64748b";
      ctx.font = "8px monospace";
      ctx.fillText("-80ms (Archived)", startX, height - 5);
      ctx.fillText("Real-time Plasma Discharge (T_pulse)", endX - 160, height - 5);
      ctx.fillText("Live", endX - 25, height - 5);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [riskHistory, intensityHistory]);

  return (
    <div className="flex flex-col h-full bg-card-bg border border-grid-gray rounded-xl p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 mb-3">
        <div>
          <h3 className="text-xs font-mono font-bold text-white tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyber-red animate-pulse" />
            DIAGNOSTIC TELEMETRY (LIVE SCROLL)
          </h3>
          <p className="text-[10px] text-text-muted">
            Continuous magnetic sensor streams updating at 500 Hz
          </p>
        </div>

        {/* Legend */}
        <div className="flex gap-3 text-[9px] font-mono mt-1 sm:mt-0">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-1 bg-cyber-red" />
            <span className="text-slate-300">Disruption Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-1 border-b-2 border-dashed border-cyber-orange" />
            <span className="text-slate-300">MHD Amp (Locked Mode)</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[160px] relative">
        <canvas
          ref={canvasRef}
          width={450}
          height={210}
          className="w-full h-full block rounded border border-grid-gray/30 bg-slate-950/40"
        />
      </div>

      <div className="mt-2 text-[9px] font-mono text-text-muted flex justify-between items-center bg-slate-950/30 p-1 px-2 rounded">
        <span>STATE RESOLUTION: 2.0ms step horizon</span>
        <span className="text-cyber-cyan">AEGIS-NET INFERENCE ENGINE ACTIVE</span>
      </div>
    </div>
  );
}
