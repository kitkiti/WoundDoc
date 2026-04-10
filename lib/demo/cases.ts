import type { CaptureContext, RiskForm } from "@/lib/types/schema";

export type DemoCase = {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  imageFileName: string;
  riskForm: RiskForm;
  captureContext: CaptureContext;
  roiHint?: [number, number, number, number];
  qualityFlags?: string[];
  classifierOverride?: {
    top_class?: string;
    top_probability?: number;
    pressure_injury_probability?: number;
    class_probabilities?: Record<string, number>;
    uncertainty_reasons?: string[];
    secondary_findings?: string[];
  };
};

export const demoCases: DemoCase[] = [
  {
    id: "sacrum-uncertain",
    badge: "Sample 1",
    title: "Sacrum, uncertain concern",
    subtitle: "Low-confidence pressure injury suspicion",
    description: "Sacral image with mixed quality and uncertain concern confidence.",
    imageFileName: "sacrum-uncertain.png",
    riskForm: {
      body_site: "Sacrum",
      mobility_limited: true,
      moisture_issue: true,
      nutrition_risk: true,
      device_present: false,
      previous_pressure_injury: false,
      support_surface_in_use: true,
      formal_risk_score: 14,
      comments: "Limited reposition tolerance overnight."
    },
    captureContext: {
      reference_visible: true,
      reference_type: "ruler",
      reference_length_cm: 2,
      reference_length_px: 96,
      pixels_per_cm: 48,
      calibration_status: "manual_override",
      notes: "Bedside ruler included near wound margin."
    },
    qualityFlags: ["mild_blur"]
  },
  {
    id: "heel-suspicion",
    badge: "Sample 2",
    title: "Heel, elevated concern",
    subtitle: "Higher pressure injury likelihood",
    description: "Heel image with clearer framing and elevated pressure injury concern.",
    imageFileName: "heel-suspicion.png",
    riskForm: {
      body_site: "Right heel",
      mobility_limited: true,
      moisture_issue: false,
      nutrition_risk: true,
      device_present: false,
      previous_pressure_injury: true,
      support_surface_in_use: false,
      formal_risk_score: 12,
      comments: "Offloading boots intermittently removed."
    },
    captureContext: {
      reference_visible: true,
      reference_type: "ruler",
      reference_length_cm: 1,
      reference_length_px: 58,
      pixels_per_cm: 58,
      calibration_status: "manual_override",
      notes: "Reference marker aligned to plantar edge."
    },
    roiHint: [160, 150, 420, 420],
    qualityFlags: ["shadowed_background"]
  },
  {
    id: "device-pressure",
    badge: "Sample 3",
    title: "Device-related pressure",
    subtitle: "Localized pressure around tubing",
    description: "Localized pressure pattern adjacent to a medical device contact point.",
    imageFileName: "device-pressure.png",
    riskForm: {
      body_site: "Left ear",
      mobility_limited: false,
      moisture_issue: false,
      nutrition_risk: false,
      device_present: true,
      previous_pressure_injury: false,
      support_surface_in_use: false,
      formal_risk_score: 9,
      comments: "Cannula pressure relieved and repositioned."
    },
    captureContext: {
      reference_visible: false,
      reference_type: "none",
      reference_length_cm: null,
      reference_length_px: null,
      pixels_per_cm: null,
      calibration_status: "not_calibrated",
      notes: "No scale reference in frame."
    },
    qualityFlags: ["small_roi"]
  }
];

export function getDemoCase(id: string) {
  return demoCases.find((item) => item.id === id);
}
