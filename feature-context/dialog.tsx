// netvacinas-frontend/src/components/UploadShots/dialog.tsx
import React from "react";

import { Dialog, DialogContent, DialogTitle } from "@mui/material";

import { useCurrentPatient } from "../PatientCard"; // To get patientId

import { UploadShotsForm } from "./form"; // Assuming form.tsx is in the same directory

interface UploadShotsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const UploadShotsDialog: React.FC<UploadShotsDialogProps> = ({ open, onClose }) => {
  const patient = useCurrentPatient(); // Get current patient context

  // --- Quick Console Log (and debugger) to Inspect Patient Object ---
  // React.useEffect(() => {
  //   // debugger;
  //   if (patient) {
  //     console.log("Current Patient Object in UploadShotsDialog:", patient);
  //     // You can log specific properties too:
  //     // console.log("Patient ID:", patient.id);
  //     // console.log("Patient Name:", patient.name); // Assuming it has a name property
  //   } else {
  //     console.log("UploadShotsDialog: Patient object is null or undefined.");
  //   }
  // }, [patient]); // Re-run this effect if the patient object changes

  // It's important to handle the case where patient or patient.id might not be available
  // For instance, if the dialog is somehow rendered when no patient is selected.
  // You might want to disable the button that opens the dialog in such cases.
  if (!patient || !patient.id) {
    // Or render a message inside the dialog, or simply don't render the form
    console.warn("UploadShotsDialog: Patient ID is not available.");
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      scroll="paper" // Important for allowing content to scroll within the paper
      sx={{ "& .MuiDialog-paper": { maxHeight: "95vh" } }}
    >
      <DialogTitle>Upload de Arquivos da Carteirinha</DialogTitle>
      <DialogContent sx={{ pt: "0px", flexGrow: 1, overflowY: "auto" }}>
        {/* MUI DialogContent sometimes adds too much top padding */}
        <UploadShotsForm patientId={patient.id} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
};
