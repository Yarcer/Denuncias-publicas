import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ReportType } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

async function seedDemoUsers() {
  const adminPassword = await argon2.hash('Admin123!');
  const entityPassword = await argon2.hash('Ente123!');
  const staffPassword = await argon2.hash('Funcionario123!');

  await prisma.user.upsert({
    where: { email: 'admin@denuncias.local' },
    update: {
      passwordHash: adminPassword,
      role: 'ADMINISTRADOR',
      status: 'ACTIVO',
    },
    create: {
      email: 'admin@denuncias.local',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'Demo',
      role: 'ADMINISTRADOR',
    },
  });

  await prisma.user.upsert({
    where: { email: 'ente@denuncias.local' },
    update: {
      passwordHash: entityPassword,
      role: 'ENTE_PUBLICO',
      status: 'ACTIVO',
    },
    create: {
      email: 'ente@denuncias.local',
      passwordHash: entityPassword,
      firstName: 'Ente',
      lastName: 'Demo',
      entityName: 'Municipalidad Demo',
      role: 'ENTE_PUBLICO',
    },
  });

  await prisma.user.upsert({
    where: { email: 'funcionario@denuncias.local' },
    update: {
      passwordHash: staffPassword,
      role: 'ENTE_PUBLICO',
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
      role: 'ENTE_PUBLICO',
    },
  });
}

async function seedCategories() {
  const demoResponsibleEntity =
    process.env.NODE_ENV === 'production' ? null : 'Municipalidad Demo';
  const categories = [
    { name: 'Infraestructura', type: ReportType.URBANO },
    { name: 'Limpieza', type: ReportType.URBANO },
    { name: 'Convivencia', type: ReportType.URBANO },
  ];

  for (const category of categories) {
    const slug = category.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    await prisma.category.upsert({
      where: { id: slug },
      update: {
        type: category.type,
        responsibleEntity: demoResponsibleEntity,
      },
      create: {
        id: slug,
        name: category.name,
        type: category.type,
        responsibleEntity: demoResponsibleEntity,
      },
    });
  }
}

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    await seedDemoUsers();
  }
  await seedCategories();
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
