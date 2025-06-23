// src/components/UploadShots/types.ts

// Fields extracted by Gemini and present in the `vaccine_applications` array
// This is the primary type for a single application object returned by Gemini.
export interface GeminiExtractedApplication {
  vaccine_name: string;
  application_date: string;
  manufacturer: string;
  batch_number: string;
  expiry_date: string;
  application_location: string;
  application_registry: string;
  applicator_name: string;
  is_existing_record: boolean;
  closest_known_active_vaccine: string;
  suggested_dose: string;
}

// Represents a vaccine from your system's active list
export interface SystemVaccine {
  id: string; // GraphQL Global ID
  name: string;
  doses: SystemDose[];
}

export interface SystemDose { // <<<< NEW
  id: string; // GraphQL Global ID
  label: string;
}

// The type used for managing applications in the frontend form's state
export type EditableVaccineApplication = GeminiExtractedApplication & {
  id: string | number; // Local unique ID for React list items
  isReviewed?: boolean;
  selectedVaccineId?: string | null; // GraphQL Global ID of the selected system vaccine
  selectedDoseId?: string | null; // GraphQL Global ID of the selected system dose

  saveError?: string | null; // Error message specific to this application after a save attempt
  saveSuccess?: boolean; // Flag indicating if this specific application was saved successfully

  // Store original values for fields that might have helper text showing original
  original_manufacturer?: string;
  original_batch_number?: string;
  original_expiry_date?: string;
  original_application_location?: string;
  original_application_registry?: string;
  original_applicator_name?: string;
  original_application_date?: string;
  // We don't need original_application_date for this specific helper text feature,
  // but you could add it if you had a similar requirement for it.
  // original_vaccine_name is already covered by `vaccine_name` which is displayed read-only.
};

// --- Types related to ProcessBase64File Mutation ---
export interface ProcessBase64FileInput {
  fileContentBase64: string;
  originalFilename: string;
  contentType: string;
  patientId: string;
}

// Structure of the geminiResponse from ProcessBase64File
export interface GeminiVaccinationCardData {
  vaccine_applications: GeminiExtractedApplication[];
}

// Payload type from the ProcessBase64File mutation
export interface ProcessGeminiFilePayload {
  success: boolean;
  geminiResponse: GeminiVaccinationCardData | null;
  errors: string[] | null;
}

// The overall structure of the data returned by the ProcessBase64File mutation
export interface ProcessBase64FileMutationData {
  processBase64File: {
    payload: ProcessGeminiFilePayload;
  };
}

export interface ProcessBase64FileMutationVars {
  input: ProcessBase64FileInput;
}

// --- Types related to SaveExtractedVaccineApplications Mutation ---
export interface ExtractedApplicationSaveInput {
  vaccineId: string | null | undefined;
  applicationDate: string;
  doseId?: string | null;
  manufacturerName?: string | null;
  batchNumber?: string | null;
  observations?: string | null;
}

export interface SaveExtractedVaccineApplicationsInput {
  patientId: string;
  applications: ExtractedApplicationSaveInput[];
}

export interface SavedShotPayload {
  id: string;
}

export interface ProcessedApplicationResultPayload {
  inputIndex: number;
  success: boolean;
  shot: SavedShotPayload | null;
  errors: string[] | null;
}

export interface SaveExtractedVaccineApplicationsPayload {
  overallSuccess: boolean;
  processedApplications: ProcessedApplicationResultPayload[];
}

export interface SaveExtractedVaccineApplicationsMutationData {
  saveExtractedVaccineApplications: {
    payload: SaveExtractedVaccineApplicationsPayload;
  };
}

export interface SaveExtractedVaccineApplicationsMutationVars {
  input: SaveExtractedVaccineApplicationsInput;
}