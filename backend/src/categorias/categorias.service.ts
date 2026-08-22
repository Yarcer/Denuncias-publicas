import { Injectable } from '@nestjs/common';

@Injectable()
export class CategoriasService {
  async findAll() {
    return {
      items: [
        { id: 'cat-1', name: 'Seguridad vial', type: 'URBANO' },
        { id: 'cat-2', name: 'Incendio', type: 'BOMBEROS' },
      ],
      count: 2,
    };
  }

  async findOne(id: string) {
    return { id, name: 'Categoría ejemplo', type: 'URBANO' };
  }

  async create(data: Record<string, unknown>) {
    return { id: 'new-category-id', ...data };
  }

  async update(id: string, data: Record<string, unknown>) {
    return { id, ...data };
  }

  async remove(id: string) {
    return { id, deleted: true };
  }
}
