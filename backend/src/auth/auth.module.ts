import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { IpAbuseProtectionService } from '../common/services/ip-abuse-protection.service';
import { AnonymousAccountCleanupService } from './anonymous-account-cleanup.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    ConfigModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn: (configService.get<string>('jwt.expiresIn') ??
            '1h') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy,
    IpAbuseProtectionService,
    AnonymousAccountCleanupService,
  ],

  exports: [AuthService],
})
export class AuthModule {}
