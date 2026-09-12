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

  await prisma.user.upsert({
    where: { email: 'admin@denuncias.local' },
    update: { passwordHash: adminPassword, role: 'ADMINISTRADOR', status: 'ACTIVO' },
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
    update: { passwordHash: entityPassword, role: 'ENTE_PUBLICO', status: 'ACTIVO' },
    create: {
      email: 'ente@denuncias.local',
      passwordHash: entityPassword,
      firstName: 'Ente',
      lastName: 'Demo',
      entityName: 'Municipalidad Demo',
      role: 'ENTE_PUBLICO',
    },
  });

  const categories = [
    { name: 'Infraestructura', type: 'URBANO' },
    { name: 'Alteración del orden público', type: 'POLICIAL' },
    { name: 'Limpieza en la vía pública', type: 'URBANO' },
    { name: 'Baches o calles en mal estado', type: 'URBANO' },
    { name: 'Semáforos dañados o fuera de funcionamiento', type: 'URBANO' },
    { name: 'Señalización dañada o faltante', type: 'URBANO' },
    { name: 'Luminarias públicas dañadas', type: 'URBANO' },
    { name: 'Alcantarillas tapadas o dañadas', type: 'URBANO' },
    { name: 'Acumulación excesiva de basura', type: 'URBANO' },
    { name: 'Contenedores llenos o dañados', type: 'URBANO' },
    { name: 'Contenedores faltantes', type: 'URBANO' },
    { name: 'Presencia de escombros', type: 'URBANO' },
    { name: 'Animales sueltos', type: 'URBANO' },
    { name: 'Ruidos molestos', type: 'URBANO' },
    { name: 'Obstrucción de la vía pública', type: 'URBANO' },
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