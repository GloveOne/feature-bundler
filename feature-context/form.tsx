// /home/gnavarro/Development/netvacinas-frontend/src/components/UploadShots/form.tsx
import React, {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useDebounce } from "react-use";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  InputAdornment,
  List,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { SelectChangeEvent } from "@mui/material/Select";

import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SearchIcon from "@mui/icons-material/Search";

import { ApolloError, useMutation, useQuery } from "@apollo/client";

import {
  patientQuery,
  SAVE_EXTRACTED_VACCINE_APPLICATIONS_MUTATION,
  vaccineListQuery,
} from "../../data/queries";
import { useSuccessMessage } from "../../lib/notification";

import { EditableApplicationItem } from "./EditableApplicationItem";
import {
  EditableVaccineApplication,
  GeminiExtractedApplication,
  GeminiVaccinationCardData,
  SystemVaccine,
} from "./types";
import { useUploadShots } from "./useUploadShots";

const DEBOUNCE_DELAY = 400;
const DEFAULT_VALUE_FOR_MISSING_FIELD = "(Não especificado)";

interface UploadShotsFormProps {
  patientId: string;
  onClose?: () => void;
}

const formatDateToYYYYMMDD = (dateString: string): string => {
  if (!dateString || typeof dateString !== "string") return "";
  const parts = dateString.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (
      day &&
      month &&
      year &&
      day.length === 2 &&
      month.length === 2 &&
      (year.length === 4 || year.length === 2)
    ) {
      const fullYear =
        year.length === 2 ? (parseInt(year, 10) > 50 ? `19${year}` : `20${year}`) : year;
      return `${fullYear}-${month}-${day}`;
    }
  }
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  console.warn(`Date string "${dateString}" is not in expected DD/MM/YYYY format for conversion.`);
  return dateString;
};

export const UploadShotsForm: React.FC<UploadShotsFormProps> = ({ patientId, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editableApplications, setEditableApplications] = useState<EditableVaccineApplication[]>(
    []
  );
  const [showResults, setShowResults] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");

  const [, cancelDebounce] = useDebounce(
    () => {
      setDebouncedSearchTerm(inputValue);
    },
    DEBOUNCE_DELAY,
    [inputValue]
  );
  useEffect(() => () => cancelDebounce(), [cancelDebounce]);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveOverallError, setSaveOverallError] = useState<string | null>(null);

  const {
    data: activeVaccinesData,
    loading: activeVaccinesLoading,
    error: activeVaccinesError,
  } = useQuery(vaccineListQuery, {
    variables: {
      patientId: patientId,
      inventoryDate: new Date().toISOString().split("T")[0],
      withPrice: false,
      withPrices: false,
      withInventoryCount: false,
      withDiscounts: false,
      withFees: false,
      withDoses: true, // Fetch doses for each vaccine
      withApplicationSites: false,
      withApplicationMethods: false,
      withManufacturers: false,
      withBatches: false,
      withSuggestions: false,
      withReservable: false,
      withoutInventoryBatches: true,
      withoutInventoryCountBatches: true,
    },
    skip: !patientId,
  });

  const systemVaccines: SystemVaccine[] = useMemo(() => {
    return (
      activeVaccinesData?.vaccines
        ?.filter((v: any) => v.id && v.name)
        .map((v: any) => ({ id: v.id, name: v.name, doses: v.doses || [] })) || []
    );
  }, [activeVaccinesData]);

  const { processFile, isProcessing: isExtracting, error: processError } = useUploadShots({
    patientId,
    onUploadSuccess: useCallback(
      (response: GeminiVaccinationCardData | null) => {
        const currentSystemVaccines = systemVaccines;
        if (response && response.vaccine_applications) {
          const newApps = response.vaccine_applications.map(
            (geminiApp: GeminiExtractedApplication, index: number) => {
              let preSelectedVaccineId: string | null = null;
              let preSelectedDoseId: string | null = null;
              // <<<< THIS IS THE CORRECTED LOGIC WITH THE IF BLOCK RESTORED >>>>
              if (
                geminiApp.closest_known_active_vaccine &&
                geminiApp.closest_known_active_vaccine !== DEFAULT_VALUE_FOR_MISSING_FIELD &&
                currentSystemVaccines.length > 0
              ) {
                const foundVaccine = currentSystemVaccines.find(
                  sv => sv.name === geminiApp.closest_known_active_vaccine
                );

                if (foundVaccine) {
                  // Step 1: Pre-select the vaccine
                  preSelectedVaccineId = foundVaccine.id;
                  // Step 2: Use the found vaccine's dose list to pre-select the dose
                  if (
                    geminiApp.suggested_dose &&
                    geminiApp.suggested_dose !== DEFAULT_VALUE_FOR_MISSING_FIELD
                  ) {
                    const foundDose = foundVaccine.doses.find(
                      d => d.label === geminiApp.suggested_dose
                    );
                    if (foundDose) {
                      preSelectedDoseId = foundDose.id;
                    }
                  }
                }
              }

              return {
                ...geminiApp,
                id: `initial-${index}-${Date.now()}`,
                isReviewed: false,
                selectedVaccineId: preSelectedVaccineId,
                selectedDoseId: preSelectedDoseId,
                saveError: null,
                saveSuccess: false,
                original_application_date: geminiApp.application_date,
                original_manufacturer: geminiApp.manufacturer,
                original_batch_number: geminiApp.batch_number,
                original_expiry_date: geminiApp.expiry_date,
                original_application_location: geminiApp.application_location,
                original_application_registry: geminiApp.application_registry,
                original_applicator_name: geminiApp.applicator_name,
              };
            }
          );
          setEditableApplications(newApps);
          setShowResults(true);
        } else {
          setEditableApplications([]);
          setShowResults(true);
        }
        setInputValue("");
        setDebouncedSearchTerm("");
        setSaveOverallError(null);
      },
      [systemVaccines]
    ),
    onUploadError: useCallback(
      (_errorMessages: string[] | null, _rawError?: Error | ApolloError) => {
        setShowResults(false);
        setEditableApplications([]);
        setInputValue("");
        setDebouncedSearchTerm("");
        setSaveOverallError(null);
      },
      []
    ),
  });

  // This composite useEffect handles pre-selection and invalidation for doses
  useEffect(() => {
    // Only run if we have data to work with
    if (systemVaccines.length === 0 || editableApplications.length === 0) return;

    // Use a variable to track if any changes were made to avoid unnecessary re-renders
    let didChange = false;
    const newApps = editableApplications.map(app => {
      const newApp = { ...app };

      // Case 1: Pre-select dose if a vaccine was just selected by user/another effect
      if (
        newApp.selectedVaccineId &&
        !newApp.selectedDoseId &&
        newApp.suggested_dose &&
        newApp.suggested_dose !== DEFAULT_VALUE_FOR_MISSING_FIELD
      ) {
        const selectedVaccine = systemVaccines.find(v => v.id === newApp.selectedVaccineId);
        const foundDose = selectedVaccine?.doses.find(d => d.label === newApp.suggested_dose);
        if (foundDose) {
          newApp.selectedDoseId = foundDose.id;
          didChange = true;
        }
      }

      // Case 2: Invalidate selected dose if vaccine changes and dose is no longer valid
      if (newApp.selectedVaccineId && newApp.selectedDoseId) {
        const selectedVaccine = systemVaccines.find(v => v.id === newApp.selectedVaccineId);
        const doseStillValid = selectedVaccine?.doses.some(d => d.id === newApp.selectedDoseId);
        if (!doseStillValid) {
          newApp.selectedDoseId = null;
          didChange = true;
        }
      }
      return newApp;
    });

    if (didChange) {
      setEditableApplications(newApps);
    }
  }, [editableApplications, systemVaccines]);

  useEffect(() => {
    if (!selectedFile) {
      setEditableApplications([]);
      setShowResults(false);
      setInputValue("");
      setDebouncedSearchTerm("");
      setSaveOverallError(null);
    }
  }, [selectedFile]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      // Reset other states
      setShowResults(false);
      setEditableApplications([]);
      setInputValue("");
      setDebouncedSearchTerm("");
      setSaveOverallError(null);
    } else {
      if (!event.target.files || event.target.files.length === 0) {
        setSelectedFile(null);
      }
    }
  }, []);

  const handleSubmitFileExtraction = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (selectedFile) {
        setShowResults(false);
        setEditableApplications([]);
        setInputValue("");
        setDebouncedSearchTerm("");
        setSaveOverallError(null);
        await processFile(selectedFile);
      }
    },
    [selectedFile, processFile]
  );

  const handleApplicationFieldChange = useCallback(
    (appId: string | number, field: keyof GeminiExtractedApplication, value: string) => {
      setEditableApplications(prevApps =>
        prevApps.map(app =>
          app.id === appId ? { ...app, [field]: value, saveError: null, saveSuccess: false } : app
        )
      );
    },
    []
  );

  const handleSelectedVaccineChange = useCallback(
    (appId: string | number, event: SelectChangeEvent<string>) => {
      const newVaccineId = event.target.value || null;
      setEditableApplications(prevApps =>
        prevApps.map(app =>
          app.id === appId
            ? // Clear the dose when vaccine changes, let useEffect handle pre-selection
              {
                ...app,
                selectedVaccineId: newVaccineId,
                selectedDoseId: null,
                saveError: null,
                saveSuccess: false,
              }
            : app
        )
      );
    },
    []
  );

  const handleDoseChange = useCallback(
    (appId: string | number, event: SelectChangeEvent<string>) => {
      const newDoseId = event.target.value || null;
      setEditableApplications(prevApps =>
        prevApps.map(app =>
          app.id === appId
            ? { ...app, selectedDoseId: newDoseId, saveError: null, saveSuccess: false }
            : app
        )
      );
    },
    []
  );

  const handleToggleReviewed = useCallback((idToToggle: string | number) => {
    setEditableApplications(prevApps =>
      prevApps.map(app => (app.id === idToToggle ? { ...app, isReviewed: !app.isReviewed } : app))
    );
  }, []);

  const handleRemoveApplication = useCallback((idToRemove: string | number) => {
    setEditableApplications(prev => prev.filter(app => app.id !== idToRemove));
  }, []);

  const handleAddApplication = useCallback(() => {
    setEditableApplications(prev => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        vaccine_name: "",
        application_date: "",
        original_application_date: undefined,
        manufacturer: "",
        original_manufacturer: undefined,
        batch_number: "",
        original_batch_number: undefined,
        expiry_date: "",
        original_expiry_date: undefined,
        application_location: "",
        original_application_location: undefined,
        application_registry: "",
        original_application_registry: undefined,
        applicator_name: "",
        original_applicator_name: undefined,
        is_existing_record: false,
        closest_known_active_vaccine: DEFAULT_VALUE_FOR_MISSING_FIELD,
        suggested_dose: DEFAULT_VALUE_FOR_MISSING_FIELD,
        isReviewed: false,
        selectedVaccineId: null,
        selectedDoseId: null,
        saveError: null,
        saveSuccess: false,
      },
    ]);
    setInputValue("");
    setDebouncedSearchTerm("");
  }, []);

  const [callSaveApplications] = useMutation(SAVE_EXTRACTED_VACCINE_APPLICATIONS_MUTATION, {
    // Add the refetchQueries option to the useMutation hook itself
    refetchQueries: [
      {
        query: patientQuery,
        variables: {
          id: patientId,
          withShots: true,
          withNonImmunizedDiseases: true,
          withFullProfile: true,
        },
      },
      // You can add more queries to refetch here if needed
      // { query: anotherQuery, variables: { ... } }
    ],
    // This makes the refetch happen automatically on successful mutation,
    // without needing to specify it in the handleConfirmAndSave call.
  });
  const showSuccessMessage = useSuccessMessage();

  const handleConfirmAndSave = useCallback(async () => {
    setIsSaving(true);
    setSaveOverallError(null);
    setEditableApplications(apps =>
      apps.map(app => ({ ...app, saveError: null, saveSuccess: false }))
    );

    const applicationsToSave = editableApplications.map(app => {
      const observationsParts: string[] = [];
      if (app.vaccine_name && app.vaccine_name !== DEFAULT_VALUE_FOR_MISSING_FIELD) {
        const selectedVaccine = systemVaccines.find(sv => sv.id === app.selectedVaccineId);
        if (
          (selectedVaccine &&
            selectedVaccine.name.toLowerCase() !== app.vaccine_name.toLowerCase()) ||
          !selectedVaccine
        ) {
          observationsParts.push(`Nome original da carteirinha: ${app.vaccine_name}`);
        }
      }
      if (app.expiry_date && app.expiry_date !== DEFAULT_VALUE_FOR_MISSING_FIELD)
        observationsParts.push(`Validade do lote: ${app.expiry_date}`);
      if (app.application_location && app.application_location !== DEFAULT_VALUE_FOR_MISSING_FIELD)
        observationsParts.push(`Local: ${app.application_location}`);
      if (app.application_registry && app.application_registry !== DEFAULT_VALUE_FOR_MISSING_FIELD)
        observationsParts.push(`Registro: ${app.application_registry}`);
      if (app.applicator_name && app.applicator_name !== DEFAULT_VALUE_FOR_MISSING_FIELD)
        observationsParts.push(`Aplicador: ${app.applicator_name}`);
      if (app.is_existing_record)
        observationsParts.push("Identificado como registro já existente no sistema.");

      return {
        vaccineId: app.selectedVaccineId,
        applicationDate: formatDateToYYYYMMDD(app.application_date),
        doseId: app.selectedDoseId, // Pass the selected dose ID
        manufacturerName:
          app.manufacturer === DEFAULT_VALUE_FOR_MISSING_FIELD ? "" : app.manufacturer,
        batchNumber: app.batch_number === DEFAULT_VALUE_FOR_MISSING_FIELD ? "" : app.batch_number,
        observations: observationsParts.join(" | "),
      };
    });

    const invalidAppIndex = applicationsToSave.findIndex(
      app => !app.vaccineId || !app.applicationDate
    );
    if (invalidAppIndex !== -1) {
      const appWithError = editableApplications[invalidAppIndex];
      if (appWithError) {
        const errorMsg = `Aplicação #${invalidAppIndex + 1} (${
          appWithError.vaccine_name || "Nome não preenchido"
        }): Por favor, selecione uma vacina do sistema e informe a data de aplicação.`;
        setSaveOverallError(errorMsg);
        setEditableApplications(prevApps =>
          prevApps.map((app, idx) =>
            idx === invalidAppIndex
              ? { ...app, saveError: "Vacina do sistema e data de aplicação são obrigatórias." }
              : app
          )
        );
      } else {
        const genericErrorMsg = `Erro de validação na Aplicação #${
          invalidAppIndex + 1
        }: Dados inválidos.`;
        setSaveOverallError(genericErrorMsg);
        setEditableApplications(prevApps =>
          prevApps.map((app, idx) =>
            idx === invalidAppIndex
              ? { ...app, saveError: "Erro interno ao validar esta aplicação." }
              : app
          )
        );
        console.error("CRITICAL: appWithError was undefined for a valid-seeming index.", {
          invalidAppIndex,
          editableApplications,
        });
      }
      setIsSaving(false);
      return;
    }

    try {
      const { data } = await callSaveApplications({
        variables: { input: { patientId, applications: applicationsToSave } },
      });
      const payload = data?.saveExtractedVaccineApplications?.payload;
      if (payload) {
        const allSuccessful = payload.overallSuccess;
        setEditableApplications(prevApps =>
          prevApps.map((app, index) => {
            const result = payload.processedApplications.find((pa: any) => pa.inputIndex === index);
            return result
              ? {
                  ...app,
                  saveSuccess: result.success,
                  saveError: result.success
                    ? null
                    : result.errors?.join(", ") || "Falha ao salvar.",
                }
              : app;
          })
        );
        if (!allSuccessful) {
          const firstError =
            payload.processedApplications.find((pa: any) => !pa.success)?.errors?.join(", ") ||
            "Algumas aplicações falharam ao salvar.";
          setSaveOverallError(
            `Falha ao salvar uma ou mais aplicações. Verifique os erros individuais. Primeira falha: ${firstError}`
          );
        } else {
          const successfulSaves = payload.processedApplications.filter((pa: any) => pa.success)
            .length;
          showSuccessMessage(`${successfulSaves} Aplicações salvas com sucesso!`, {
            autoHideDuration: 5000,
            anchorOrigin: {
              vertical: "bottom",
              horizontal: "left",
            },
            // persist: false, // Default is false, so it auto-hides
            // action: null, // Explicitly no action, though default is usually none
          });
          if (onClose) onClose();
        }
      } else {
        setSaveOverallError("Resposta inesperada do servidor ao salvar.");
      }
    } catch (err) {
      console.error("Erro ao salvar aplicações:", err);
      let message = "Erro desconhecido ao salvar.";
      if (err instanceof ApolloError) {
        message =
          err.graphQLErrors.length > 0
            ? err.graphQLErrors.map(e => e.message).join("; ")
            : err.networkError
            ? `Erro de rede: ${err.networkError.message}`
            : err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setSaveOverallError(message);
    } finally {
      setIsSaving(false);
    }
  }, [
    editableApplications,
    patientId,
    callSaveApplications,
    onClose,
    systemVaccines,
    showSuccessMessage,
  ]);

  const filteredApplications = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return editableApplications;
    const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();
    return editableApplications.filter(app => {
      const {
        id,
        isReviewed,
        saveError,
        saveSuccess,
        selectedVaccineId,
        ...searchableAppFields
      } = app;
      const selectedVaccineName =
        systemVaccines.find(sv => sv.id === selectedVaccineId)?.name || "";
      return (
        Object.values(searchableAppFields).some(value =>
          String(value).toLowerCase().includes(lowerCaseSearchTerm)
        ) || selectedVaccineName.toLowerCase().includes(lowerCaseSearchTerm)
      );
    });
  }, [editableApplications, debouncedSearchTerm, systemVaccines]);

  // Moved handleSearchInputChange inside the component
  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleSearchKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.preventDefault();
  }, []);

  const extractedButNoAppsToShow =
    showResults &&
    !isExtracting &&
    !processError &&
    editableApplications.length === 0 &&
    !debouncedSearchTerm.trim();

  return (
    <form
      onSubmit={handleSubmitFileExtraction}
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      {/* Top Section: Instructions & File Input with Action Buttons */}
      <Box sx={{ mb: 1, flexShrink: 0 }}>
        {!showResults && (
          <Typography variant="body1" gutterBottom sx={{ mb: 1 }}>
            Selecione uma imagem da carteira de vacinação para extrair os dados.
          </Typography>
        )}
        <Grid container spacing={1} alignItems="center">
          <Grid item xs={12} sm>
            <TextField
              type="file"
              onChange={handleFileChange}
              fullWidth
              variant="outlined"
              size="small"
              inputProps={{ accept: "image/png, image/jpeg, image/webp, image/heic, image/heif" }}
              helperText={
                selectedFile
                  ? `Arquivo: ${selectedFile.name}`
                  : "Formatos suportados: PNG, JPG, WEBP, HEIC, HEIF."
              }
              error={!!processError && !isExtracting}
              disabled={isExtracting || isSaving}
            />
          </Grid>
          <Grid
            item
            xs={12}
            sm="auto"
            sx={{
              paddingTop: "30px",
              paddingBottom: "16.5px",
              paddingLeft: "10px",
              paddingRight: "10px",
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              justifyContent={{ xs: "flex-end", sm: "flex-end" }}
              sx={{ width: "100%" }}
              alignItems="center"
            >
              <Button
                type="submit"
                variant="contained"
                disabled={isExtracting || isSaving || !selectedFile}
                size="medium"
              >
                {isExtracting ? "Processando..." : "Extrair Dados"}
              </Button>
            </Stack>
          </Grid>
        </Grid>
        {isExtracting && (
          <Box sx={{ display: "flex", alignItems: "center", my: 1 }}>
            <CircularProgress size={24} sx={{ mr: 1 }} />{" "}
            <Typography>Processando imagem com IA...</Typography>
          </Box>
        )}
        {processError && !isExtracting && (
          <Alert severity="error" sx={{ my: 1 }}>
            Erro ao extrair dados:{" "}
            {Array.isArray(processError) ? processError.join(", ") : String(processError)}
          </Alert>
        )}
      </Box>

      {saveOverallError && !isSaving && (
        <Alert severity="error" sx={{ my: 1, flexShrink: 0 }}>
          {saveOverallError}
        </Alert>
      )}

      {showResults && !isExtracting && !processError && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 0.5, sm: 1 },
            mt: 1,
            flexGrow: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography variant="h6" gutterBottom sx={{ mb: 1, px: 1, flexShrink: 0 }}>
            Verifique e Edite os Dados Extraídos ({filteredApplications.length} de{" "}
            {editableApplications.length}):
          </Typography>
          <TextField
            label="Buscar nas aplicações extraídas"
            variant="outlined"
            size="small"
            fullWidth
            value={inputValue} // Correct: Bind to inputValue for immediate feedback
            onChange={handleSearchInputChange} // Correct: Use the new handler
            sx={{ mb: 1, px: 1, flexShrink: 0 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            onKeyDown={handleSearchKeyDown} // Keep if you want to prevent form submission on Enter
            disabled={isExtracting || isSaving || activeVaccinesLoading}
          />
          {activeVaccinesLoading && (
            <Typography sx={{ my: 1, textAlign: "center", flexShrink: 0 }}>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Carregando vacinas...
            </Typography>
          )}
          {activeVaccinesError && (
            <Alert severity="warning" sx={{ my: 1, mx: 1, flexShrink: 0 }}>
              Erro ao carregar vacinas: {activeVaccinesError.message}
            </Alert>
          )}

          <Box sx={{ flexGrow: 1, overflowY: "auto", pr: { xs: 0, sm: 0.5 }, mt: 1 }}>
            {!activeVaccinesLoading && filteredApplications.length > 0 ? (
              <List dense disablePadding sx={{ pt: 0.5 }}>
                {filteredApplications.map((app, idx) => (
                  <EditableApplicationItem
                    key={app.id}
                    app={app}
                    displayIndex={idx + 1}
                    systemVaccines={systemVaccines}
                    activeVaccinesLoading={activeVaccinesLoading}
                    isSavingGlobally={isSaving}
                    onFieldChange={handleApplicationFieldChange}
                    onVaccineSelectChange={handleSelectedVaccineChange}
                    onToggleReviewed={handleToggleReviewed}
                    onRemove={handleRemoveApplication}
                    onDoseSelectChange={handleDoseChange} // Pass the new handler
                    showDivider={idx < filteredApplications.length - 1}
                  />
                ))}
              </List>
            ) : (
              !activeVaccinesLoading && (
                <Typography sx={{ my: 2, textAlign: "center" }}>
                  {isExtracting
                    ? "Aguarde..."
                    : debouncedSearchTerm.trim()
                    ? `Nenhuma aplicação encontrada para "${debouncedSearchTerm}".`
                    : "Nenhuma aplicação para editar. Extraia dados ou adicione manualmente."}
                </Typography>
              )
            )}
          </Box>
          <Button
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleAddApplication}
            variant="outlined"
            size="small"
            sx={{ mt: 1, display: "block", mx: "auto", flexShrink: 0 }}
            disabled={isExtracting || isSaving || activeVaccinesLoading}
          >
            Adicionar Aplicação Manualmente
          </Button>
        </Paper>
      )}

      {extractedButNoAppsToShow && (
        <Typography sx={{ mt: 2, textAlign: "center", flexShrink: 0 }}>
          Nenhuma aplicação de vacina foi extraída da imagem. Você pode adicionar manualmente.
        </Typography>
      )}

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        sx={{
          mt: "auto",
          pt: 2,
          borderTop: theme => `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}
      >
        <Button
          onClick={onClose}
          disabled={isExtracting || isSaving}
          variant="outlined"
          color="inherit"
        >
          Cancelar
        </Button>
        {editableApplications.length > 0 && !isExtracting && (
          <Button
            onClick={handleConfirmAndSave}
            variant="contained"
            color="primary"
            disabled={
              isSaving || isExtracting || editableApplications.length === 0 || activeVaccinesLoading
            }
          >
            {isSaving ? "Salvando..." : "Confirmar e Salvar Dados"}
          </Button>
        )}
      </Stack>
    </form>
  );
};
