import { ReactNode, useCallback } from "react";

import { OptionsObject, useSnackbar, VariantType } from "notistack";

const useNotificationMessage = (variant: VariantType) => {
  const { enqueueSnackbar } = useSnackbar();
  return useCallback(
    (message: string | ReactNode, config: OptionsObject | undefined = {}) =>
      enqueueSnackbar(message, { variant, ...config }),
    [enqueueSnackbar, variant]
  );
};

export const useSuccessMessage = () => useNotificationMessage("success");

export const useErrorMessage = () => useNotificationMessage("error");
