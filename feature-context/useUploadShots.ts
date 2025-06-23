// /home/gnavarro/Development/netvacinas-frontend/src/components/UploadShots/useUploadShots.ts
import { useCallback, useEffect, useState } from "react";

import { ApolloError, useMutation } from "@apollo/client";

import { PROCESS_BASE64_FILE_MUTATION } from "../../data/queries";

import {
  GeminiVaccinationCardData,
  ProcessBase64FileInput,
  ProcessBase64FileMutationData,
  ProcessBase64FileMutationVars,
} from "./types";

interface UseUploadShotsProps {
  patientId: string;
  onUploadSuccess?: (response: GeminiVaccinationCardData | null) => void;
  onUploadError?: (errorMessages: string[] | null, rawError?: Error) => void;
}

interface UseUploadShotsReturn {
  isProcessing: boolean;
  error: string[] | null;
  processFile: (file: File) => Promise<void>;
  extractedData: GeminiVaccinationCardData | null;
}

export const useUploadShots = ({
  patientId,
  onUploadSuccess,
  onUploadError,
}: UseUploadShotsProps): UseUploadShotsReturn => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string[] | null>(null);
  const [extractedData, setExtractedData] = useState<GeminiVaccinationCardData | null>(null);

  const [callProcessBase64File, { loading: mutationLoading }] = useMutation<
    ProcessBase64FileMutationData,
    ProcessBase64FileMutationVars
  >(PROCESS_BASE64_FILE_MUTATION);

  const processFile = useCallback(
    async (file: File): Promise<void> => {
      if (!patientId) {
        // Should ideally not happen if prop is required
        const errMsg = ["ID do paciente não fornecido para o processamento."];
        console.error(errMsg[0]);
        setError(errMsg);
        onUploadError?.(errMsg, new Error(errMsg[0]));
        return;
      }
      if (!file) {
        const errMsg = ["Nenhum arquivo selecionado."];
        setError(errMsg);
        onUploadError?.(errMsg, new Error(errMsg[0]));
        return;
      }

      setIsProcessing(true);
      setError(null);
      setExtractedData(null); // Clear previous data

      // 1. Read file and convert to Base64
      const reader = new FileReader();
      reader.readAsDataURL(file); // Reads as Base64 Data URL

      reader.onload = async () => {
        const base64ContentWithPrefix = reader.result as string; // e.g., "data:image/png;base64,iVBORw0KGgo..."

        // The backend mutation strips the prefix, so sending it as is is fine.
        // Or, if you prefer to strip it client-side:
        // const base64Content = base64ContentWithPrefix.split(',')[1];

        const inputArgs: ProcessBase64FileInput = {
          fileContentBase64: base64ContentWithPrefix,
          originalFilename: file.name,
          contentType: file.type,
          patientId: patientId,
        };

        try {
          console.log(
            "Calling ProcessBase64File mutation for patient:",
            patientId,
            "with file:",
            inputArgs.originalFilename,
            inputArgs.contentType
          );
          const result = await callProcessBase64File({
            variables: { input: inputArgs },
          });

          // Check for GraphQL errors returned in the response body
          if (result.errors && result.errors.length > 0) {
            const errorMessages = result.errors.map(e => e.message);
            console.error("GraphQL errors from response:", errorMessages);
            setError(errorMessages);
            // Construct a new Error object for the onUploadError callback
            const rawError = new Error(errorMessages.join("; "));
            // You can optionally add more properties from result.errors[0] if needed
            // For example, if result.errors[0].extensions?.code exists:
            // (rawError as any).code = result.errors[0].extensions?.code;
            onUploadError?.(errorMessages, rawError);
            setIsProcessing(false); // Ensure processing is stopped
            return;
          }

          const payload = result.data?.processBase64File?.payload;

          if (payload?.success && payload.geminiResponse) {
            console.log("Processamento bem-sucedido:", payload.geminiResponse);
            setExtractedData(payload.geminiResponse);
            onUploadSuccess?.(payload.geminiResponse);
          } else {
            const backendErrors = payload?.errors || [
              "Erro desconhecido no processamento do backend.",
            ];
            console.error("Falha no processamento do backend:", backendErrors);
            setError(backendErrors);
            // For backend errors, we might not have a rawError object in the same way
            onUploadError?.(backendErrors, new Error(backendErrors.join("; ")));
          }
        } catch (err) {
          // This catch block handles network errors or other exceptions from Apollo Client
          console.error("Erro ao chamar a mutation (network or other client error):", err);
          let errorMessages: string[] = ["Ocorreu um erro inesperado."];
          let rawCaughtError: Error = new Error(errorMessages[0]);

          if (err instanceof ApolloError) {
            // ApolloError has a `graphQLErrors` array and a `networkError`
            if (err.graphQLErrors.length > 0) {
              errorMessages = err.graphQLErrors.map(e => e.message);
              rawCaughtError = new Error(errorMessages.join("; "));
              // (rawCaughtError as any).graphQLErrors = err.graphQLErrors; // Optionally attach original errors
            } else if (err.networkError) {
              errorMessages = [err.networkError.message || "Erro de rede."];
              rawCaughtError = err.networkError;
            } else {
              errorMessages = [err.message];
              rawCaughtError = err;
            }
          } else if (err instanceof Error) {
            errorMessages = [err.message];
            rawCaughtError = err;
          }

          setError(errorMessages);
          onUploadError?.(errorMessages, rawCaughtError);
        } finally {
          setIsProcessing(false);
        }
      };

      reader.onerror = fileReaderError => {
        console.error("Erro ao ler o arquivo:", fileReaderError);
        const errMsg = ["Erro ao ler o arquivo selecionado."];
        setError(errMsg);
        onUploadError?.(errMsg, new Error("FileReader error"));
        setIsProcessing(false);
      };
    },
    [callProcessBase64File, onUploadSuccess, onUploadError, patientId]
  );

  // Update isProcessing based on mutationLoading as well
  // This makes sure the UI reflects loading state from Apollo
  useEffect(() => {
    if (mutationLoading) {
      setIsProcessing(true);
    }
    // The `finally` block in `processFile` now handles setIsProcessing(false)
    // However, if the component unmounts while mutationLoading is true,
    // this effect might still be useful or could be removed if `finally` is robust.
    // For simplicity, let's rely on the finally block.
    // If `mutationLoading` becomes false, and `processFile` hasn't hit its `finally` yet,
    // `isProcessing` might flicker. The `finally` block is the most reliable place.
  }, [mutationLoading]);

  return { isProcessing, error, processFile, extractedData };
};
