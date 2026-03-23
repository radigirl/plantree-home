export const MEAL_STATUS_LABELS: Record<string, string> = {
  'to-prepare': 'To prepare',
  'in-progress': 'In progress',
  'ready-to-serve': 'Ready',
};

export function getNextStatus(status: string): string | null {
  switch (status) {
    case 'to-prepare':
      return 'in-progress';
    case 'in-progress':
      return 'ready-to-serve';
    case 'ready-to-serve':
      return 'to-prepare';
    default:
      return null;
  }
}

export function getStatusLabel(status: string): string {
  return MEAL_STATUS_LABELS[status] || status;
}