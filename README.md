# RoadPulse-V2X
University of Wollongong in Dubai - CSIT 305 

Urban road infrastructure is continuously exposed to environmental and mechanical stresses. Extreme temperatures, repeated vehicle loading, and high traffic volumes contribute to pavement deterioration, potentially resulting in cracks, potholes, surface irregularities, and reduced driving safety. Identifying these defects early is essential for maintaining road quality and allocating infrastructure-maintenance resources effectively. Pavement management research emphasizes that reliable condition data is fundamental to assessing infrastructure health, forecasting deterioration, and determining appropriate maintenance interventions

This package contains everything you need to run, review, and collaborate on the V2X Road-Condition Monitoring Dashboard.

## Contents
1. `RoadPulse_V2X_Dashboard_Standalone.html`: A self-contained, interactive single-file web dashboard. Double-click to open in any web browser (Chrome, Edge, Safari, Firefox) with zero installation required.
2. `source_code/`: The full React / TypeScript / TanStack Start / Vite / Tailwind project from Lovable.

## How to open the Dashboard
- Install the `RoadPulse_V2X_Dashboard_Standalone.html`.
- You can directly open the Dashboard by double clicking `RoadPulse_V2X_Dashboard_Standalone.html` without installing any dependencies.
- It includes:
  - Interactive road degradation heatmap across synthetic corridors (Corridors A–I calibrated from PVS runs 1–9).
  - Over-time degradation timeline simulation slider (N = 0..50 passes).
  - Active Alerts, Prioritized Repair Queue, and Potential Degradation tabs below the map.
  - Advanced 100 Hz vibration graphs (raw vs. cleaned |a_z| vs. 0.30g baseline & 0.85g defect threshold, speed normalization, sensor mounting selector: below suspension, above suspension, dashboard).
  - Country-neutral PVS dataset explorer (1,391 GPS trace points and 1,080,906 samples).
