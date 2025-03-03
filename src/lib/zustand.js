import { create } from "zustand"

export const zusCursor = create((set, get) => ({
  TEXTURE_DOWNSAMPLE: 1.0, setTEXTURE_DOWNSAMPLE: state => set({TEXTURE_DOWNSAMPLE: state }),
  DENSITY_DISSIPATION: 0.95, setDENSITY_DISSIPATION: state => set({DENSITY_DISSIPATION: state }),
  VELOCITY_DISSIPATION: 0.99, setVELOCITY_DISSIPATION: state => set({VELOCITY_DISSIPATION: state }),
  PRESSURE_DISSIPATION: 0.8, setPRESSURE_DISSIPATION: state => set({PRESSURE_DISSIPATION: state }),
  PRESSURE_ITERATIONS: 25, setPRESSURE_ITERATIONS: state => set({PRESSURE_ITERATIONS: state }),
  CURL: 30, setCURL: state => set({CURL: state }),
  SPLAT_RADIUS: 0.001, setSPLAT_RADIUS: state => set({SPLAT_RADIUS: state }),
}))