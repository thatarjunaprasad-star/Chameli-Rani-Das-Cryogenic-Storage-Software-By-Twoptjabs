/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { PlasmaStatus } from "../types";

interface ForecastGaugeProps {
  probability: number;
  leadTime: number;
  latency: number;
  status: PlasmaStatus;
}

export default function ForecastGauge({
  probability,
  leadTime,
  latency,
  status,
}: ForecastGaugeProps) {
  // SVG circle math
  const size = 150;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  // Render an arc that spans 260 degrees (leaving the bottom open like a tachometer)
  // 260 degrees as a fraction of circumference
  const angleSpan = 260;
  const arcLength = (circumference * angleSpan) / 360;

  // Stroke offset determined by probability
  const strokeDashoffset = arcLength - (probability * arcLength);

  // Colors based on risk level
  const isHighRisk = probability >= 0.8;
  const isMedRisk = probability >= 0.4 && probability < 0.8;
  const colorClass = isHighRisk
    ? "text-cyber-red"
    : isMedRisk
    ? "text-cyber-orange"
    : "text-cyber-cyan";

  const colorHex = isHighRisk
    ? "#ff2a5f"
    : isMedRisk
    ? "#ff9f00"
    : "#00f0ff";

  return (
    <div className="flex flex-col h-full bg-card-bg border border-grid-gray rounded-xl p-4 justify-between">
      <h3 className="text-xs font-mono font-bold text-white tracking-wider">
        AI FORECAST HORIZON
      </h3>

      {/* Circle Ring Gauge Container */}
      <div className="flex flex-col items-center justify-center relative my-2">
        <svg
          width={size}
          height={size}
          className="transform -rotate-[220deg]"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background open circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#202c45" // GridGray
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />

          {/* Foreground colored risk arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={colorHex}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />
        </svg>

        {/* Central Overlay text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pb-2">
          <span className={`text-3xl font-mono font-extrabold tracking-tighter ${colorClass}`}>
            {Math.round(probability * 100)}%
          </span>
          <span className="text-[9px] font-mono font-bold text-text-muted mt-0.5 tracking-widest upper">
            RISK INDEX
          </span>
        </div>
      </div>

      {/* Diagnostics Readout Row */}
      <div className="space-y-1 text-xs">
        <div className="flex justify-between items-center border-b border-grid-gray/30 pb-1">
          <span className="text-text-muted">Warning Time:</span>
          <span
            className={`font-mono font-bold ${
              leadTime > 900
                ? "text-text-muted"
                : leadTime < 40
                ? "text-cyber-red animate-pulse"
                : "text-cyber-green"
            }`}
          >
            {leadTime > 900 ? "N/A (Stable)" : `${Math.round(leadTime)} ms`}
          </span>
        </div>

        <div className="flex justify-between items-center border-b border-grid-gray/30 pb-1">
          <span className="text-text-muted">Inference Latency:</span>
          <span className="font-mono text-cyber-cyan font-bold">
            {latency.toFixed(2)} ms
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-text-muted">DNN State:</span>
          <span
            className={`font-mono font-bold ${
              probability >= 0.8
                ? "text-cyber-red animate-pulse"
                : "text-cyber-cyan"
            }`}
          >
            {probability >= 0.8 ? "TRIGGERED" : "MONITORING"}
          </span>
        </div>
      </div>
    </div>
  );
}
