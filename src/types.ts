/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum TokamakDeviceKey {
  DIII_D = "DIII_D",
  EAST = "EAST",
  JET = "JET",
}

export interface TokamakDeviceConfig {
  key: TokamakDeviceKey;
  deviceName: string;
  location: string;
  baselineIp: number; // Plasma current (Ip) in MA
  baselineBt: number; // Toroidal magnetic field (Bt) in Tesla
  baselineDensity: number; // Density in 10^19 m^-3
  warningLeadTime: number; // Forecast warning horizon targets in ms
}

export const TOKAMAK_DEVICES: Record<TokamakDeviceKey, TokamakDeviceConfig> = {
  [TokamakDeviceKey.DIII_D]: {
    key: TokamakDeviceKey.DIII_D,
    deviceName: "DIII-D",
    location: "General Atomics, USA",
    baselineIp: 1.5,
    baselineBt: 2.1,
    baselineDensity: 5.0,
    warningLeadTime: 30,
  },
  [TokamakDeviceKey.EAST]: {
    key: TokamakDeviceKey.EAST,
    deviceName: "EAST",
    location: "ASIPP, China",
    baselineIp: 1.0,
    baselineBt: 3.5,
    baselineDensity: 4.5,
    warningLeadTime: 50,
  },
  [TokamakDeviceKey.JET]: {
    key: TokamakDeviceKey.JET,
    deviceName: "JET",
    location: "CCFE, United Kingdom",
    baselineIp: 3.2,
    baselineBt: 3.45,
    baselineDensity: 8.0,
    warningLeadTime: 80,
  },
};

export enum InstabilityType {
  LOCKED_MODE = "LOCKED_MODE",
  DENSITY_LIMIT = "DENSITY_LIMIT",
  CURRENT_QUENCH = "CURRENT_QUENCH",
}

export interface InstabilityConfig {
  key: InstabilityType;
  displayName: string;
  description: string;
}

export const INSTABILITIES: Record<InstabilityType, InstabilityConfig> = {
  [InstabilityType.LOCKED_MODE]: {
    key: InstabilityType.LOCKED_MODE,
    displayName: "Locked Mode (MHD)",
    description: "Growing magnetohydrodynamic tearing modes lock to the wall, causing rapid loss of rotation and confinement.",
  },
  [InstabilityType.DENSITY_LIMIT]: {
    key: InstabilityType.DENSITY_LIMIT,
    displayName: "Greenwald Density Limit",
    description: "Plasma density exceeds critical limits, causing thermal collapse and edge cooling.",
  },
  [InstabilityType.CURRENT_QUENCH]: {
    key: InstabilityType.CURRENT_QUENCH,
    displayName: "Vertical Displacement Event",
    description: "Loss of vertical position control, driving rapid vertical drift and wall contact.",
  },
};

export enum LogSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  CRITICAL = "CRITICAL",
  SUCCESS = "SUCCESS",
}

export interface LogEntry {
  id: number;
  plasmaTimeMs: number;
  message: string;
  severity: LogSeverity;
}

export type PlasmaStatus = "STABLE" | "INSTABILITY_DETECTED" | "MITIGATED" | "DISRUPTED";
