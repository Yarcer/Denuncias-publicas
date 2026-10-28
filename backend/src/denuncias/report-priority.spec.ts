import { ReportPriority } from '@prisma/client';
import { determineReportPriority } from './report-priority';

describe('determineReportPriority', () => {
  it('marks immediate threats to life as urgent regardless of accents or case', () => {
    expect(
      determineReportPriority(
        'Riesgo de DERRUMBE',
        'Hay personas atrapadas en el edificio.',
        false,
      ),
    ).toBe(ReportPriority.URGENTE);
  });

  it('marks serious risks as high priority', () => {
    expect(
      determineReportPriority(
        'Cables caídos',
        'Hay peligro en la calle.',
        false,
      ),
    ).toBe(ReportPriority.ALTA);
  });

  it('uses medium priority when no risk terms are present', () => {
    expect(
      determineReportPriority(
        'Luminaria apagada',
        'La calle está oscura.',
        false,
      ),
    ).toBe(ReportPriority.MEDIA);
  });

  it('assigns low priority to anonymous reports', () => {
    expect(
      determineReportPriority('Incendio activo', 'Persona herida.', true),
    ).toBe(ReportPriority.BAJA);
  });
});
