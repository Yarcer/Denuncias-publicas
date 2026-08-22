import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { DenunciasModule } from './denuncias/denuncias.module';
import { CategoriasModule } from './categorias/categorias.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import configuration from './config/configurations';
import { validate } from './config/env.validation';

@Module({
  imports: [
    // Configuración global
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    
    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: 60,
            limit: 100, // 100 requests por minuto
          },
        ],
      }),
    }),
    
    // Módulos de la aplicación
    PrismaModule,
    AuthModule,
    HealthModule,
    DenunciasModule,
    CategoriasModule,
    UsuariosModule,
  ],
})
export class AppModule {}