# Deburr Cell Sim – automatic abrasive-brush deburring cell (3D)

Interactive three.js simulation of an automatic brush-deburring cell for cutting tools (Braude College ME, DR3 project).
Live: https://vbuchatsky-source.github.io/deburr-cell-sim/

Full cycle (robot → load station + shutter → vision → disc brush on edges → cup brush on tip → inspection → sort OK/NG),
recipes, X-ray / section / explode, guided tour, risks with fault simulation, SPC (histogram, run chart, Cpk, CSV), BOM, HE/EN.

URL params: `?lang=en`, `?q=high`, `?paused`, `?x`, `?e=1`, `?sec=z&sv=.5`, `?cam=brush|work|chuck|robot|cabinet|top`, `?st=N`, `?tab=data`.
Collision check (dev): open with `?nomerge&paused`, then in console `await __triInit(); __triCycle(130)`.
