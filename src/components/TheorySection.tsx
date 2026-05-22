/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Database, Cpu, ShieldAlert, GitCommit } from "lucide-react";

export default function TheorySection() {
  return (
    <div className="bg-card-bg border border-grid-gray rounded-xl p-4 sm:p-5 mt-4">
      <h3 className="text-sm font-display font-bold text-cyber-cyan tracking-wide flex items-center gap-2 mb-3">
        <GitCommit className="w-4 h-4" />
        SCIENTIFIC INSIGHT: DEEP NEURAL NETWORKS IN TOKAMAK PHYSICS
      </h3>

      <p className="text-xs text-slate-300 leading-relaxed max-w-4xl text-justify mb-4">
        Plasma disruptions represent the single greatest challenge in structural survival for commercial
        Tokamak reactors. At core temperatures hotter than the sun (exceeding 100 million °C), an unmitigated 
        termination can release gigajoules of thermal and magnetic energy directly onto the beryllium or tungsten 
        first-wall divertor tiles within microseconds. Rapidly modeling these non-linear magnetohydrodynamic (MHD) 
        anomalies requires deep learning models that can parse multi-channel sensor feeds at microsecond speed.
      </p>

      {/* Bento-style segments */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Archival Big Data */}
        <div className="bg-slate-950/40 border border-grid-gray/30 p-3.5 rounded-lg flex gap-3">
          <div className="p-1.5 bg-cyber-orange/10 rounded border border-cyber-orange/20 self-start text-cyber-orange">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold text-slate-100 tracking-wide">
              1. BIG DATA REPOSITORY
            </h4>
            <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed text-justify">
              Recurrent deep neural networks and attention-based models are trained across decades of high-frequency pulses 
              stored in massive multi-terabyte data archives from open tokamak collaborations including DIII-D (USA), 
              EAST (China), and JET (UK CCFE).
            </p>
          </div>
        </div>

        {/* 2. LSTM & Transformers */}
        <div className="bg-slate-950/40 border border-grid-gray/30 p-3.5 rounded-lg flex gap-3">
          <div className="p-1.5 bg-cyber-cyan/10 rounded border border-cyber-cyan/20 self-start text-cyber-cyan">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold text-slate-100 tracking-wide">
              2. TEMPORAL INFERENCE
            </h4>
            <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed text-justify">
              By ingesting continuous magnetic diagnostic streams, LSTM arrays and transformer blocks calculate the probability 
              index of disruption. They find precursor patterns (e.g., locked modes/MHD growth) up to 100ms before visible collapse.
            </p>
          </div>
        </div>

        {/* 3. Rapid Mitigation Injection */}
        <div className="bg-slate-950/40 border border-grid-gray/30 p-3.5 rounded-lg flex gap-3">
          <div className="p-1.5 bg-cyber-green/10 rounded border border-cyber-green/20 self-start text-cyber-green">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold text-slate-100 tracking-wide">
              3. CRYOGENIC SHUTDOWN
            </h4>
            <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed text-justify">
              In under 10ms, automated FPGAs deploy massive gas injections (MGI) or shattered pellet injectors (SPI) to deposit 
              neon-deutrium ice in the core. This absorbs structural thermal heat and dampens magnetic currents safely.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
