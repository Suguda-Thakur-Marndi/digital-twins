# 3D Human Avatar & Asset Attributions

This document records the provenance, licensing, and compliance details for all 3D digital twin assets used in the **VitalTwin — AI-Powered Clinical Digital Twin** platform.

---

## 1. Primary 3D Humanoid Body Model

- **Asset Name:** Generic Rigged Humanoid Avatar (`generic-body.glb` / Xbot)
- **Author / Origin:** Three.js Authors & Contributors ([mrdoob/three.js](https://github.com/mrdoob/three.js))
- **Source Repository:** [three.js/examples/models/gltf/Xbot.glb](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Xbot.glb)
- **License:** **MIT License** (Permissive open-source license permitting reuse, modification, and redistribution)
- **File Size:** **2.79 MB** (2,930,032 bytes) — *Complies with the < 5.0 MB performance budget.*
- **Rig Structure:** Standard humanoid skeletal armature with Mixamo bone topology:
  - Cranial / Head: `mixamorigHead` (`mixamorig:Head`)
  - Upper Thorax / Cardiac Core: `mixamorigSpine2` (`mixamorig:Spine2`)
  - Left Brachial / BP Cuff: `mixamorigLeftArm` (`mixamorig:LeftArm`)
  - Abdominal & Pelvic Axis: `mixamorigHips` (`mixamorig:Hips`) / `mixamorigSpine`
- **Anatomy & Neutrality:**
  - Faceless, neutral mannequin finish with non-identifiable facial geometry.
  - Neutral matte clothing/chassis devoid of identifiable brand marks or distinguishing features.
  - Zero depiction of any real, living, or named individual.
  - Watermarked with: **"Synthetic patient, generic model"**.

---

## 2. Technical Architecture Reference

- **Technical Reference:** [https://github.com/hmthanh/3d-human-model](https://github.com/hmthanh/3d-human-model)
- **Status:** **Reference Only** (Architectural concept for Three.js bone tracking and GLB loading).
- **Compliance & Privacy Guardrails:**
  - In strict compliance with open-source and copyright compliance rules, **no code, shaders, or asset files** (`Thanh.glb`, `TranThiNgocTham.glb`) were copied or imported from that repository.
  - The VitalTwin 3D viewer is an entirely original React Three Fiber (`@react-three/fiber` + `@react-three/drei`) implementation built from scratch.

---

## 3. Clinical & Legal Disclaimers

> **Illustrative body model. It does not represent this patient's anatomy.**

- The 3D body twin serves solely as an interactive spatial index and clinical visualization aid for mapped longitudinal EHR telemetry and simulated what-if projections.
- It is not an anatomical imaging study, CT/MRI volumetric rendering, or diagnostic device.
- All baseline patient profiles originate from synthetic EHR generators (Synthea). No Protected Health Information (PHI) is used.
