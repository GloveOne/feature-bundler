// netvacinas-frontend/src/components/UploadShots/index.tsx
import React, { useState } from "react";

import { Button as MuiButton } from "@mui/material"; // Using MUI Button

import { UploadShotsDialog } from "./dialog";

interface UploadShotsButtonProps {
  children: React.ReactNode; // To accept the button text like "Fazer upload..."
  // You can add other props here if needed, e.g., for styling the button
}

export const UploadShotsButton: React.FC<UploadShotsButtonProps> = ({
  children,
  ...buttonProps
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  return (
    <>
      <MuiButton variant="contained" color="primary" onClick={handleOpenDialog} {...buttonProps}>
        {children}
      </MuiButton>
      <UploadShotsDialog open={dialogOpen} onClose={handleCloseDialog} />
    </>
  );
};
