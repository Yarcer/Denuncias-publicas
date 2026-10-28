import { ReportPriority } from '@prisma/client';

const urgentTerms = [
  'incendio activo',
  'persona herida',
  'personas heridas',
  'herido',
  'herida',
  'riesgo de derrumbe',
  'derrumbe inminente',
  'persona atrapada',
  'explosion',
  'riesgo de vida',
  'ahogamiento',
  'electrocucion',
];

const highPriorityTerms = [
  'riesgo',
  'grave',
  'peligro',
  'dano estructural',
  'colapso',
  'violencia',
  'accidente',
  'fuga de gas',
  'cable caido',
  'cable electrico',
  'inundacion',
];

export function determineReportPriority(
  title: string,
  description: string,
  isAnonymous: boolean,
): ReportPriority {
  if (isAnonymous) return ReportPriority.BAJA;

  const reportText = `${title} ${description}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (urgentTerms.some((term) => reportText.includes(term))) {
    return ReportPriority.URGENTE;
  }
  if (highPriorityTerms.some((term) => reportText.includes(term))) {
    return ReportPriority.ALTA;
  }
  return ReportPriority.MEDIA;
}
