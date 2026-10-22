import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

async function main() {
  const adminPassword = await argon2.hash('Admin123!');
  const entityPassword = await argon2.hash('Ente123!');
  const staffPassword = await argon2.hash('Funcionario123!');

  await prisma.user.upsert({
    where: { email: 'admin@denuncias.local' },
    update: { passwordHash: adminPassword, role: 'SUPERADMINISTRADOR', status: 'ACTIVO' },
    create: {
      email: 'admin@denuncias.local',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'Demo',
      role: 'SUPERADMINISTRADOR',
    },
  });

  await prisma.user.upsert({
    where: { email: 'ente@denuncias.local' },
    update: { passwordHash: entityPassword, role: 'FUNCIONARIO', status: 'ACTIVO' },
    create: {
      email: 'ente@denuncias.local',
      passwordHash: entityPassword,
      firstName: 'Ente',
      lastName: 'Demo',
      entityName: 'Municipalidad Demo',
      role: 'FUNCIONARIO',
    },
  });

  await prisma.user.upsert({
    where: { email: 'funcionario@denuncias.local' },
    update: {
      passwordHash: staffPassword,
      role: 'FUNCIONARIO',
      status: 'ACTIVO',
      entityName: 'Municipalidad Demo',
      jurisdiction: 'Melo',
    },
    create: {
      email: 'funcionario@denuncias.local',
      passwordHash: staffPassword,
      firstName: 'Funcionario',
      lastName: 'Demo',
      entityName: 'Municipalidad Demo',
      jurisdiction: 'Melo',
      role: 'FUNCIONARIO',
    },
  });

  const categories = [
  { name: 'Infraestructura', type: 'URBANO' },
  { name: 'Limpieza', type: 'URBANO' },
  { name: 'Convivencia', type: 'URBANO' },
];

  for (const category of categories) {
    const slug = category.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    await prisma.category.upsert({
      where: { id: slug },
      update: { type: category.type as any },
      create: {
        id: slug,
        name: category.name,
        type: category.type as any,
      },
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });