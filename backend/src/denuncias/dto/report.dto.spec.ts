import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReportDto, UpdateReportDto } from './report.dto';

describe('report priority input', () => {
  it('rejects priority when a citizen creates a report', async () => {
    const errors = await validate(
      plainToInstance(CreateReportDto, { priority: 'URGENTE' }),
      { whitelist: true, forbidNonWhitelisted: true },
    );

    expect(errors.some((error) => error.property === 'priority')).toBe(true);
  });

  it('rejects priority when a citizen updates a report', async () => {
    const errors = await validate(
      plainToInstance(UpdateReportDto, { priority: 'URGENTE' }),
      { whitelist: true, forbidNonWhitelisted: true },
    );

    expect(errors.some((error) => error.property === 'priority')).toBe(true);
  });
});
