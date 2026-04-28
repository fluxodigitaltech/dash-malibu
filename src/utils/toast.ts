import { toast } from "sonner";

export type ToastId = string | number;

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showLoading = (message: string): ToastId => {
  return toast.loading(message);
};

export const dismissToast = (toastId?: ToastId) => {
  toast.dismiss(toastId);
};