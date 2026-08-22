import { Injectable } from '@nestjs/common';

@Injectable()
export class UsuariosService {
  async findAll() {
    return {
      items: [
        { id: 'user-1', email: 'ciudadano@example.com', role: 'CIUDADANO' },
        { id: 'user-2', email: 'ente@example.com', role: 'ENTE_PUBLICO' },
      ],
      count: 2,
    };
  }

  async findOne(id: string) {
    return { id, email: 'usuario@example.com', role: 'CIUDADANO' };
  }

  async create(data: Record<string, unknown>) {
    return { id: 'new-user-id', ...data };
  }

  async update(id: string, data: Record<string, unknown>) {
    return { id, ...data };
  }
}
