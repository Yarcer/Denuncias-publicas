import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class DenunciasService {
  async findAll(status?: string) {
    return {
      items: [],
      count: 0,
      filters: { status: status ?? 'all' },
    };
  }

  async findOne(id: string) {
    return {
      id,
      title: 'Denuncia de ejemplo',
      description: 'Listado base para la entidad de denuncias.',
      status: 'PENDIENTE',
    };
  }

  async create(data: Record<string, unknown>) {
    return {
      id: 'demo-report-id',
      ...data,
      status: 'PENDIENTE',
      createdAt: new Date().toISOString(),
    };
  }

  async update(id: string, data: Record<string, unknown>) {
    return {
      id,
      ...data,
      updatedAt: new Date().toISOString(),
    };
  }

  async remove(id: string) {
    return {
      id,
      deleted: true,
      deletedAt: new Date().toISOString(),
    };
  }
}
