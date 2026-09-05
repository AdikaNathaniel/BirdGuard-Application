import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { DetectionsModule } from './detections/detections.module';
import { DeviceModule } from './device/device.module';

// Single consolidated process: one HTTP server, one Mongo connection,
// shared by all three feature modules below. Previously these ran as four
// separate NestJS processes (api-gateway + auth-service + device-service +
// detection-service) talking over internal TCP microservices -- that TCP
// layer is gone now, so each module's controller calls its service
// directly via normal dependency injection. The module boundaries
// themselves are unchanged; only the process/transport layer was removed.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
    }),
    AuthModule,
    DeviceModule,
    DetectionsModule,
  ],
})
export class AppModule {}
