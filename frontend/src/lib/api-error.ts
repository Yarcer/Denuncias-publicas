import { isAxiosError } from 'axios';

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError<{ message?: unknown }>(error)) {
    return error instanceof Error ? `${fallback} (${error.message})` : fallback;
  }

  const message = error.response?.data?.message;
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(', ');
  }

  if (error.response) {
    return `${fallback} (HTTP ${error.response.status}: ${error.message})`;
  }
  return `${fallback} (${error.message})`;
}
