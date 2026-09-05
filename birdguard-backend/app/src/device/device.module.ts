import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';

@Module({
  imports: [AuthModule],
  controllers: [DeviceController],
  providers: [DeviceService],
})
export class DeviceModule {}
