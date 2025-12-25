XanVision: Xandeum pNode Intelligence Suite
XanVision is a high-performance, real-time analytics and visualization platform for the Xandeum storage network. Built for the Munich Release, it transforms raw gossip protocol data into a holographic 3D topology and an actionable economic dashboard for pNode operators.

Key Features
Holographic 3D Topology: A custom-built Canvas 3D engine that maps pNode clusters globally based on real-time geolocation.

STOINC Revenue Engine: Accurate reward projections using the official Munich formula: pNodes×GB×Performance×Stake.

Real-time Health Monitoring: Tracking of pNode performance scores (0.0 - 1.0) and 30-second heartbeat pings.

Era and NFT Multipliers: Integrated calculators for the 16x Deep South Era boost and high-tier NFT multipliers (Titan, Dragon, etc.).

Infrastructure Insights: Advanced regional distribution metrics and ISP-level reporting for network decentralization analysis.

System Architecture
XanVision utilizes a Client-Server-Proxy architecture to ensure low-latency performance and bridge the gap between Xandeum’s pRPC data and modern web browsers.

1. Backend Proxy (proxy-server.js)
Caching Layer: Implements a 30-second podsCache to prevent RPC throttling and ensure consistent performance for all users.

Data Normalization: Standardizes JSON-RPC responses into a clean, UI-ready format (e.g., converting raw bytes to GB).

Geolocation Engine: Resolves node IP addresses into physical coordinates for the 3D graph.

2. Frontend Intelligence
React 18 and Vite: Optimized development and production builds.

Custom 3D Engine (Node3D.jsx): A performance-oriented HTML5 Canvas 2D engine that avoids the overhead of heavy 3D libraries while delivering 60fps holographic rotations.

Installation and Setup
Prerequisites
Node.js (v18 or higher)

NPM or Yarn

1. Clone the Repository
Bash

git clone https://github.com/olskido/xanvision
cd xanvision
2. Install Dependencies
Bash

npm install
3. Start the Proxy Server
Bash

node proxy-server.js
4. Run the Development Environment
Bash

npm run dev
Technical Implementation Highlights
The Projection Math
XanVision maps geographic coordinates to a 3D Cartesian space using spherical trigonometry:

x=R⋅cos(lat)⋅cos(lon)

y=R⋅sin(lat)

z=R⋅cos(lat)⋅sin(lon)

pRPC Integration
The platform interacts with the Xandeum pRPC interface to fetch get_pods and get_version data. This enables the unique Munich Adoption tracker, which monitors how many nodes have successfully upgraded to the v0.3 storage prototype.

Roadmap
Herrenberg Integration: Support for the next era of file-storage metrics.

One-Click Maintenance: Automated scripts for node upgrades.

Shard Health Alerts: Predictive maintenance for storage shards.

License and Acknowledgments
Built for the Xandeum Buildathon 2025. Special thanks to the Xandeum Foundation for the pRPC documentation and community support.