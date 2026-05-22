/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import { PlasmaStatus, TokamakDeviceConfig } from "../types";

interface TokamakVisualizerProps {
  status: PlasmaStatus;
  device: TokamakDeviceConfig;
  safetyFactor: number;
  lockedMode: number;
  radiatedPower: number;
}

export default function TokamakVisualizer({
  status,
  device,
  safetyFactor,
  lockedMode,
  radiatedPower,
}: TokamakVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let tick = 0;

    const render = () => {
      tick += 1;
      const width = canvas.width;
      const height = canvas.height;

      // Clear with subtle overlay
      ctx.fillStyle = "#0d1322";
      ctx.fillRect(0, 0, width, height);

      // Draw outer grid background
      ctx.strokeStyle = "rgba(32, 44, 69, 0.4)";
      ctx.lineWidth = 1;
      const gridSize = 20;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const scale = Math.min(width, height) / 280;

      // Draw Tokamak magnet coils outline safely
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 115 * scale, 0, Math.PI * 2);
      ctx.stroke();

      // Outer cryostat/coils (discrete structures)
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 12 * scale;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, 115 * scale, angle, angle + 0.15);
        ctx.stroke();
      }

      // 1. Draw D-shaped vacuum vessel wall (Double-lined containment wall)
      ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
      ctx.lineWidth = 3 * scale;
      ctx.fillStyle = "#0f172a";

      const drawDVessel = (ctx: CanvasRenderingContext2D, sizeFactor: number) => {
        const radiusX = 65 * sizeFactor * scale;
        const radiusY = 90 * sizeFactor * scale;
        const rxOffset = 15 * scale;

        ctx.beginPath();
        // Top right
        ctx.moveTo(centerX + rxOffset, centerY - radiusY);
        ctx.quadraticCurveTo(
          centerX + rxOffset + radiusX,
          centerY - radiusY,
          centerX + rxOffset + radiusX * 0.75,
          centerY
        );
        // Bottom right
        ctx.quadraticCurveTo(
          centerX + rxOffset + radiusX,
          centerY + radiusY,
          centerX + rxOffset,
          centerY + radiusY
        );
        // Left straight wall (representing central solenoid stack)
        ctx.lineTo(centerX - radiusX * 0.45, centerY + radiusY * 0.9);
        ctx.lineTo(centerX - radiusX * 0.45, centerY - radiusY * 0.9);
        ctx.closePath();
      };

      drawDVessel(ctx, 1.0);
      ctx.fill();
      ctx.stroke();

      // Inner beryllium wall armor tile segment highlights
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 4 * scale;
      // Draw highlighted armor tile boundaries
      drawDVessel(ctx, 0.95);
      ctx.stroke();

      // 2. Central Solenoid stack core column
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(centerX - 35 * scale, centerY - 110 * scale, 15 * scale, 220 * scale);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1 * scale;
      ctx.strokeRect(centerX - 35 * scale, centerY - 110 * scale, 15 * scale, 220 * scale);

      // Slinky solenoid coils decoration
      ctx.strokeStyle = "rgba(100, 116, 139, 0.8)";
      for (let sy = centerY - 100 * scale; sy < centerY + 100 * scale; sy += 10 * scale) {
        ctx.beginPath();
        ctx.moveTo(centerX - 35 * scale, sy);
        ctx.lineTo(centerX - 20 * scale, sy + 3 * scale);
        ctx.stroke();
      }

      // 3. Glowing Plasma Core (D-shaped inside chamber)
      let plasmaColor = "#00f0ff"; // Stable CyberCyan
      let alphaMultiplier = 1.0;
      let coreSize = 0.8;
      let wobble = 0;
      let verticalShift = 0;

      if (status === "INSTABILITY_DETECTED") {
        const isCriticalRisk = safetyFactor < 2.0 || lockedMode > 2.0;
        plasmaColor = isCriticalRisk ? "#ff2a5f" : "#ff9f00"; // Red or Orange
        wobble = Math.sin(tick * 0.6) * 4 * scale * (lockedMode / 1.5);
        
        // Vertical displacement event
        if (safetyFactor < 2.0) {
          verticalShift = Math.sin(tick * 0.2) * 12 * scale;
        }
      } else if (status === "MITIGATED") {
        plasmaColor = "#00ff87"; // Healing CyberGreen
        alphaMultiplier = Math.max(0.1, 1 - (tick % 100) / 100);
        coreSize = 0.8 * (safetyFactor > 6 ? 0.35 : 0.7); // collapsing current size
      } else if (status === "DISRUPTED") {
        plasmaColor = "#ef4444";
        alphaMultiplier = Math.max(0, 0.4 * Math.sin(tick * 0.8)); // intermittent flickering sparks
        coreSize = 0.2;
      }

      // Radial glowing aura
      ctx.save();
      ctx.translate(wobble, verticalShift);
      const gradient = ctx.createRadialGradient(
        centerX + 20 * scale,
        centerY,
        5 * scale,
        centerX + 25 * scale,
        centerY,
        75 * scale
      );
      
      if (status === "STABLE") {
        gradient.addColorStop(0, "rgba(0, 240, 255, 0.85)");
        gradient.addColorStop(0.4, "rgba(0, 240, 255, 0.35)");
        gradient.addColorStop(1, "rgba(0, 240, 255, 0)");
      } else if (status === "INSTABILITY_DETECTED") {
        if (plasmaColor === "#ff2a5f") {
          gradient.addColorStop(0, "rgba(255, 42, 95, 0.9)");
          gradient.addColorStop(0.4, "rgba(255, 42, 95, 0.4)");
          gradient.addColorStop(1, "rgba(255, 42, 95, 0)");
        } else {
          gradient.addColorStop(0, "rgba(255, 159, 0, 0.9)");
          gradient.addColorStop(0.4, "rgba(255, 159, 0, 0.4)");
          gradient.addColorStop(1, "rgba(255, 159, 0, 0)");
        }
      } else if (status === "MITIGATED") {
        gradient.addColorStop(0, `rgba(0, 255, 135, ${0.8 * alphaMultiplier})`);
        gradient.addColorStop(0.6, `rgba(0, 255, 135, ${0.2 * alphaMultiplier})`);
        gradient.addColorStop(1, "rgba(0, 255, 135, 0)");
      } else {
        gradient.addColorStop(0, `rgba(239, 68, 68, ${alphaMultiplier})`);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
      }

      ctx.fillStyle = gradient;
      drawDVessel(ctx, coreSize);
      ctx.fill();

      // Magnetic field curves / core lines inside plasma
      if (status !== "DISRUPTED") {
        ctx.strokeStyle = plasmaColor;
        ctx.globalAlpha = 0.45 * alphaMultiplier;
        
        const fluxCount = status === "STABLE" ? 4 : 2;
        for (let i = 1; i <= fluxCount; i++) {
          ctx.lineWidth = (1.5 - i * 0.2) * scale;
          drawDVessel(ctx, coreSize * (0.3 + i * 0.17));
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
      }

      // Draw high heat thermal radiation spots on armor tiles if radiated power is high
      if (radiatedPower > 0.6) {
        ctx.strokeStyle = "rgba(255, 159, 0, 0.8)";
        ctx.lineWidth = 3 * scale;
        ctx.shadowColor = "#ff9f00";
        ctx.shadowBlur = 10 * scale;
        
        ctx.beginPath();
        // highlight top inner edge
        ctx.arc(centerX + 15 * scale, centerY - 90 * scale, 25 * scale, Math.PI, Math.PI * 1.5);
        ctx.stroke();

        ctx.shadowBlur = 0; // reset shadow
      }

      // Drawing unstable electric/magnetic disruption arches (sparks) if lockedMode is high
      if (status === "INSTABILITY_DETECTED" && lockedMode > 1.2) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5 * scale;
        ctx.beginPath();
        
        // Random electric arcs to the outer walls
        const arcCount = Math.floor(lockedMode / 1.5) + 1;
        for (let a = 0; a < arcCount; a++) {
          let cx = centerX + 15 * scale + (Math.random() * 30 - 15) * scale;
          let cy = centerY + (Math.random() * 80 - 40) * scale;
          ctx.moveTo(cx, cy);

          // Wave towards outer D-wall
          for (let step = 1; step <= 5; step++) {
            cx += 8 * scale;
            cy += (Math.random() * 15 - 7.5) * scale;
            ctx.lineTo(cx, cy);
          }
        }
        ctx.stroke();
      }

      // Display diagnostic overlay markers directly in layout vector space
      ctx.font = "bold 9px monospace";
      ctx.fillStyle = status === "STABLE" ? "#00f0ff" : status === "MITIGATED" ? "#00ff87" : "#ff2a5f";
      
      const labelText = status === "STABLE" 
        ? "PLASMA: CONFINED" 
        : status === "INSTABILITY_DETECTED" 
        ? "ALERT: PRE-DISRUPT" 
        : status === "MITIGATED" 
        ? "VALVE INJECTED: QUENCHED" 
        : "FAILURE: DISRUPTED";
      
      ctx.fillText(labelText, centerX - 55 * scale, centerY + 125 * scale);

      ctx.restore();

      // Show Pellet launch trajectories if mitigation is triggered recently
      if (status === "MITIGATED" && tick % 30 < 15) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        // inject from top-right tile nozzle
        const injectorX = centerX + 55 * scale;
        const injectorY = centerY - 65 * scale;
        ctx.arc(injectorX - (tick % 15) * 2 * scale, injectorY + (tick % 15) * 2.5 * scale, 3 * scale, 0, Math.PI * 2);
        ctx.fill();

        // text labeled injection
        ctx.fillStyle = "#00f0ff";
        ctx.fillText("SPI INJECT", injectorX + 5 * scale, injectorY);
      }

      // Draw solenoid heating beam representation
      if (status === "STABLE") {
        ctx.strokeStyle = "rgba(0, 240, 255, 0.15)";
        ctx.lineWidth = 10 * scale;
        ctx.beginPath();
        ctx.moveTo(centerX + 65 * scale, centerY - 30 * scale);
        ctx.lineTo(centerX, centerY);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [status, device, safetyFactor, lockedMode, radiatedPower]);

  return (
    <div className="flex flex-col h-full bg-slate-950/80 border border-grid-gray rounded-xl overflow-hidden p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full animate-ping ${
            status === "STABLE" ? "bg-cyber-cyan" : status === "INSTABILITY_DETECTED" ? "bg-cyber-orange" : status === "MITIGATED" ? "bg-cyber-green" : "bg-cyber-red"
          }`} />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-100">
            CHAMBER CROSS-SECTION (MAGNETIC FLUX)
          </span>
        </div>
        <span className="text-[10px] font-mono text-text-muted">
          Active: {device.deviceName}
        </span>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="w-full h-full max-h-[280px] max-w-[280px] rounded-lg border border-grid-gray/60"
        />

        {/* Dynamic Warning Indicator Overlay */}
        {status === "INSTABILITY_DETECTED" && (
          <div className="absolute top-2 left-2 right-2 bg-cyber-red/10 border border-cyber-red/30 px-2 py-1 rounded flex items-center justify-between animate-pulse">
            <span className="text-[10px] font-mono text-cyber-red font-bold">⚠️ CRITICAL TEARING OVERLOAD</span>
            <span className="text-[9px] font-mono text-slate-300">MODULATION: AT CORE LIMIT</span>
          </div>
        )}
      </div>

      <div className="mt-2 text-[10px] font-mono text-text-muted text-center leading-relaxed">
        Showing real-time magnetic confinement flux geometries and central solenoid core logs.
      </div>
    </div>
  );
}
