// src/components/UploadShots/EditableApplicationItem.tsx
import React, { useMemo } from "react";

import {
  Alert,
  Box,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack, // Import Stack if you want to group index and icons nicely
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { SelectChangeEvent } from "@mui/material/Select";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoIcon from "@mui/icons-material/Info";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import {
  EditableVaccineApplication,
  GeminiExtractedApplication,
  SystemDose,
  SystemVaccine,
} from "./types";

// --- Constants ---
const DEFAULT_VALUE_FOR_MISSING_FIELD = "(Não especificado)";
// --- End Constants ---

interface EditableApplicationItemProps {
  app: EditableVaccineApplication;
  displayIndex: number; // New prop for the 1-based index
  systemVaccines: SystemVaccine[];
  activeVaccinesLoading: boolean;
  isSavingGlobally: boolean;
  onFieldChange: (
    appId: string | number,
    field: keyof GeminiExtractedApplication,
    value: string
  ) => void;
  onVaccineSelectChange: (appId: string | number, event: SelectChangeEvent<string>) => void;
  onDoseSelectChange: (appId: string | number, event: SelectChangeEvent<string>) => void; // <<<< NEW PROP
  onToggleReviewed: (appId: string | number) => void;
  onRemove: (appId: string | number) => void;
  showDivider: boolean;
}

// Helper function for dynamic helper text
const getHelperText = (
  currentValue: string | undefined | null,
  originalValue: string | undefined | null
): string => {
  const currentDisplayValue =
    currentValue === DEFAULT_VALUE_FOR_MISSING_FIELD ? "" : currentValue || "";
  const originalDisplayValue =
    originalValue === DEFAULT_VALUE_FOR_MISSING_FIELD ? "" : originalValue; // Treat original DEFAULT as blank for comparison here

  if (typeof originalValue === "undefined") {
    // This field was not part of the original Gemini extraction for this item (e.g., manually added item)
    // or the original_* field was never set.
    return ""; // No specific helper text needed for "original"
  }

  if (originalValue === DEFAULT_VALUE_FOR_MISSING_FIELD) {
    // Gemini explicitly said "Não especificado"
    return "Não especificado";
  }

  // If user changed it AND original was not effectively blank
  if (
    currentDisplayValue.trim() !== (originalDisplayValue || "").trim() &&
    (originalDisplayValue || "").trim() !== ""
  ) {
    return `Lido: ${originalDisplayValue}`;
  }

  // If value matches original, or original was truly blank (not placeholder), no extra helper text
  return "";
};

export const EditableApplicationItem: React.FC<EditableApplicationItemProps> = React.memo(
  ({
    app,
    displayIndex,
    systemVaccines,
    activeVaccinesLoading,
    isSavingGlobally,
    onFieldChange,
    onVaccineSelectChange,
    onDoseSelectChange, // <<<< NEW PROP
    onToggleReviewed,
    onRemove,
  }) => {
    const handleFieldChange = (field: keyof GeminiExtractedApplication, value: string) => {
      onFieldChange(app.id, field, value);
    };

    const handleVaccineChange = (event: SelectChangeEvent<string>) => {
      onVaccineSelectChange(app.id, event);
    };

    const handleDoseChange = (event: SelectChangeEvent<string>) => {
      onDoseSelectChange(app.id, event);
    };

    const handleToggle = () => {
      onToggleReviewed(app.id);
    };

    const handleRemove = () => {
      onRemove(app.id);
    };

    // Find the currently selected vaccine's possible doses
    const possibleDoses: SystemDose[] = useMemo(() => {
      if (!app.selectedVaccineId) return [];
      return systemVaccines.find(v => v.id === app.selectedVaccineId)?.doses || [];
    }, [app.selectedVaccineId, systemVaccines]);

    return (
      <Box
        component={Paper}
        variant="outlined"
        sx={{
          mb: 0.7,
          p: 0.6,
          borderLeft: app.saveError
            ? "4px solid red"
            : app.saveSuccess
            ? "4px solid green"
            : undefined,
        }}
      >
        <Grid container spacing={0} alignItems="flex-start">
          {/* Left Column: Index Number and Delete Icon */}
          <Grid
            item
            xs={12}
            md={1}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              pt: { xs: 0, md: "0px" },
            }}
          >
            <Typography
              variant="h5"
              component="div"
              sx={{
                fontWeight: "bold",
                mt: 1, // Adjusted margin-top slightly
                mb: 2, // Adjusted margin-bottom slightly
                // Custom styling examples:
                color: "primary.main", // Example: Use primary theme color
                // backgroundColor: theme => theme.palette.grey[200], // Example: Light grey background
                // padding: theme => theme.spacing(0.25, 1), // Example: Small padding (top/bottom, left/right)
                // borderRadius: theme => theme.shape.borderRadius, // Example: Rounded corners like theme
                // border: theme => `1px solid ${theme.palette.primary.light}`, // Example: Light border
                minWidth: "20px", // Ensure it has some minimum width for alignment
                textAlign: "center", // Center the number if it's a single digit
                lineHeight: 1.2, // Adjust line height for better vertical centering if bg is used
                paddingTop: "5px",
                paddingBottom: "0px",
                paddingLeft: "0px",
                paddingRight: "0px",
              }}
            >
              # {displayIndex}
            </Typography>
            <Stack direction="column" spacing={0.5} alignItems="center">
              {" "}
              {/* Stack for icons */}
              <Tooltip title="Remover esta aplicação">
                <span>
                  <IconButton
                    onClick={handleRemove}
                    size="small"
                    color="error"
                    aria-label="remover aplicação"
                    sx={{
                      mt: 1,
                      pt: 10,
                      display: "flex",
                      alignItems: "center",
                      paddingTop: "35px",
                      paddingBottom: "0px",
                      paddingLeft: "0px",
                      paddingRight: "0px",
                    }}
                    disabled={isSavingGlobally}
                  >
                    <DeleteIcon fontSize="large" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Grid>

          {/* Right Column: Main Fields and "Reviewed" Toggle */}
          <Grid item xs={12} md={11}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4} lg={3}>
                <TextField
                  label="Nome da Vacina (extraído da imagem)"
                  value={app.vaccine_name || ""}
                  fullWidth
                  variant="outlined"
                  size="small"
                  disabled={isSavingGlobally}
                  InputProps={{
                    readOnly: true,
                    style: { fontStyle: "italic", color: "grey" },
                  }}
                  helperText="Nome como extraído da imagem"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4} lg={3}>
                <FormControl
                  fullWidth
                  size="small"
                  error={!app.selectedVaccineId && !!app.saveError && !app.saveSuccess}
                >
                  <InputLabel id={`vaccine-select-label-${app.id}`}>Vacina do Sistema *</InputLabel>
                  <Select
                    labelId={`vaccine-select-label-${app.id}`}
                    id={`vaccine-select-${app.id}`}
                    value={app.selectedVaccineId || ""}
                    label="Vacina do Sistema *"
                    onChange={handleVaccineChange}
                    disabled={
                      isSavingGlobally || activeVaccinesLoading || systemVaccines.length === 0
                    }
                  >
                    <MenuItem value="">
                      <em>Selecione uma vacina</em>
                    </MenuItem>
                    {systemVaccines.map(sv => (
                      <MenuItem key={sv.id} value={sv.id}>
                        {sv.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {app.closest_known_active_vaccine &&
                    app.closest_known_active_vaccine !== DEFAULT_VALUE_FOR_MISSING_FIELD && (
                      <Tooltip
                        title={`Sugestão da IA: ${app.closest_known_active_vaccine}`}
                        placement="top-start"
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            mt: 0.5,
                            color: "text.secondary",
                          }}
                        >
                          <InfoIcon fontSize="small" sx={{ mr: 0.5 }} />
                          IA sugere:{" "}
                          {app.closest_known_active_vaccine.length > 30
                            ? `${app.closest_known_active_vaccine.substring(0, 27)}...`
                            : app.closest_known_active_vaccine}
                        </Typography>
                      </Tooltip>
                    )}
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={4} lg={2}>
                <TextField
                  label="Data de Aplicação *"
                  value={app.application_date || ""}
                  onChange={e => handleFieldChange("application_date", e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  disabled={isSavingGlobally}
                  error={!app.application_date && !!app.saveError && !app.saveSuccess}
                  placeholder="DD/MM/AAAA"
                  helperText={getHelperText(app.application_date, app.original_application_date)}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4} lg={2}>
                <TextField
                  label="Fabricante"
                  value={
                    app.manufacturer === DEFAULT_VALUE_FOR_MISSING_FIELD
                      ? ""
                      : app.manufacturer || ""
                  }
                  onChange={e => handleFieldChange("manufacturer", e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  disabled={isSavingGlobally}
                  helperText={getHelperText(app.manufacturer, app.original_manufacturer)}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4} lg={2}>
                <TextField
                  label="Lote"
                  value={
                    app.batch_number === DEFAULT_VALUE_FOR_MISSING_FIELD
                      ? ""
                      : app.batch_number || ""
                  }
                  onChange={e => handleFieldChange("batch_number", e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  disabled={isSavingGlobally}
                  helperText={getHelperText(app.batch_number, app.original_batch_number)}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4} lg={2}>
                <FormControl fullWidth size="small">
                  <InputLabel id={`dose-select-label-${app.id}`}>Dose</InputLabel>
                  <Select
                    labelId={`dose-select-label-${app.id}`}
                    id={`dose-select-${app.id}`}
                    value={app.selectedDoseId || ""}
                    label="Dose"
                    onChange={handleDoseChange}
                    disabled={
                      isSavingGlobally || !app.selectedVaccineId || possibleDoses.length === 0
                    }
                  >
                    <MenuItem value="">
                      <em>Nenhuma / Não Aplicável</em>
                    </MenuItem>
                    {possibleDoses.map(dose => (
                      <MenuItem key={dose.id} value={dose.id}>
                        {dose.label}
                      </MenuItem>
                    ))}
                  </Select>
                  {app.suggested_dose && app.suggested_dose !== "(Não especificado)" && (
                    <Tooltip title={`Sugestão de dose da IA: ${app.suggested_dose}`}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          mt: 0.5,
                          color: "text.secondary",
                        }}
                      >
                        <InfoIcon fontSize="small" sx={{ mr: 0.5 }} />
                        IA: {app.suggested_dose}
                      </Typography>
                    </Tooltip>
                  )}
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={4} lg={2}>
                <TextField
                  label="Data de Validade"
                  value={
                    app.expiry_date === DEFAULT_VALUE_FOR_MISSING_FIELD ? "" : app.expiry_date || ""
                  }
                  onChange={e => handleFieldChange("expiry_date", e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  disabled={isSavingGlobally}
                  helperText={getHelperText(app.expiry_date, app.original_expiry_date)}
                  placeholder="DD/MM/AAAA"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4} lg={2}>
                <TextField
                  label="Clínica de Aplicação"
                  value={
                    app.application_location === DEFAULT_VALUE_FOR_MISSING_FIELD
                      ? ""
                      : app.application_location || ""
                  }
                  onChange={e => handleFieldChange("application_location", e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  disabled={isSavingGlobally}
                  helperText={getHelperText(
                    app.application_location,
                    app.original_application_location
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4} lg={2}>
                <TextField
                  label="Registro da Aplicação"
                  value={
                    app.application_registry === DEFAULT_VALUE_FOR_MISSING_FIELD
                      ? ""
                      : app.application_registry || ""
                  }
                  onChange={e => handleFieldChange("application_registry", e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  disabled={isSavingGlobally}
                  helperText={getHelperText(
                    app.application_registry,
                    app.original_application_registry
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4} lg={2}>
                <TextField
                  label="Nome do Aplicador"
                  value={
                    app.applicator_name === DEFAULT_VALUE_FOR_MISSING_FIELD
                      ? ""
                      : app.applicator_name || ""
                  }
                  onChange={e => handleFieldChange("applicator_name", e.target.value)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  disabled={isSavingGlobally}
                  helperText={getHelperText(app.applicator_name, app.original_applicator_name)}
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                lg={2}
                sx={{
                  display: "flex",
                  alignItems: "center", // This will vertically align Chip, Spacer, and IconButton
                  paddingTop: "0px",
                  paddingBottom: "15px",
                  paddingLeft: "0px",
                  paddingRight: "0px",
                }}
              >
                {/* Item 1: The Chip (remains on the left) */}
                {app.is_existing_record && (
                  <Tooltip title="Atenção: Este registro de vacina parece já existir no sistema do paciente. Verifique cuidadosamente antes de salvar para evitar duplicatas.">
                    <Chip
                      icon={<WarningAmberIcon />}
                      label="Registro já existente!"
                      size="medium"
                      color="error"
                      variant="outlined"
                      sx={{
                        borderColor: "#D32F2F",
                        color: "#D32F2F",
                        backgroundColor: "#FFEBEE",
                      }}
                    />
                  </Tooltip>
                )}

                {/* Item 2: The Spacer - This is the key change */}
                <Box sx={{ flexGrow: 1 }} />
                {/* `flexGrow: 1` tells this Box to expand and take up all available horizontal space */}

                {/* Item 3: The Reviewed Toggle (will now be pushed to the right) */}
                <Tooltip title={app.isReviewed ? "Item Revisado!" : "Marcar como revisado"}>
                  <span>
                    <IconButton
                      onClick={handleToggle}
                      size="large"
                      color={app.isReviewed ? "success" : "default"}
                      aria-label={
                        app.isReviewed ? "marcar como não revisado" : "marcar como revisado"
                      }
                      disabled={isSavingGlobally}
                      sx={{
                        // Your padding can likely be simplified now that positioning is handled by flexbox
                        // For example, just add some left margin if needed:
                        // ml: 1
                        paddingLeft: "9px",
                        paddingRight: "10px", // Resetting padding from your example if it was just for spacing
                      }}
                    >
                      {app.isReviewed ? (
                        <CheckCircleIcon fontSize="large" />
                      ) : (
                        <CheckCircleOutlineIcon fontSize="large" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              </Grid>
            </Grid>{" "}
            {/* End of inner fields grid */}
            {/* Save Error/Success Messages */}
            {app.saveError && (
              <Alert severity="error" sx={{ mt: 1, fontSize: "0.8rem", p: "0px 8px" }}>
                {app.saveError}
              </Alert>
            )}
            {app.saveSuccess && (
              <Alert severity="success" sx={{ mt: 1, fontSize: "0.8rem", p: "0px 8px" }}>
                Salvo com sucesso!
              </Alert>
            )}
          </Grid>
        </Grid>
      </Box>
    );
  },
  (prevProps, nextProps) => {
    // Simplified memo comparison: re-render if app object reference changes,
    // or if other critical props that affect rendering logic change.
    // This relies on the parent creating new 'app' objects only when their data truly changes.
    if (
      prevProps.app !== nextProps.app ||
      prevProps.systemVaccines !== nextProps.systemVaccines || // Essential if vaccine list changes
      prevProps.activeVaccinesLoading !== nextProps.activeVaccinesLoading ||
      prevProps.isSavingGlobally !== nextProps.isSavingGlobally ||
      prevProps.showDivider !== nextProps.showDivider
    ) {
      return false; // Re-render
    }
    return true; // Props are considered the same, skip re-render
  }
);
