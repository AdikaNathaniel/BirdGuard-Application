import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeviceService } from './device.service';
import { StartServoSweepDto } from './dto/start-servo-sweep.dto';

// Requires a valid JWT -- every route here just forwards to DeviceService,
// which holds the Pi's SSH credentials and is the only place a raw
// command ever gets constructed (see device/commands.ts). This controller
// never accepts or forwards a free-text command from the app.
@Controller('device')
@UseGuards(JwtAuthGuard)
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post('detector/start')
  async startDetector() {
    return this.deviceService.startDetector();
  }

  @Post('detector/stop')
  async stopDetector() {
    return this.deviceService.stopDetector();
  }

  @Get('detector/status')
  async getDetectorStatus() {
    return this.deviceService.getDetectorStatus();
  }

  // Settings page: field-of-view sweep. `dto` is already validated by the
  // global ValidationPipe (main.ts) against StartServoSweepDto's bounds
  // before this method ever runs.
  @Post('servo/start')
  async startServoSweep(@Body() dto: StartServoSweepDto) {
    return this.deviceService.startServoSweep(dto.angle1, dto.seconds1, dto.angle2, dto.seconds2, dto.channel);
  }

  @Post('servo/stop')
  async stopServoSweep() {
    return this.deviceService.stopServoSweep();
  }

  @Get('servo/status')
  async getServoSweepStatus() {
    return this.deviceService.getServoSweepStatus();
  }

  // Separate tilt servo (channel 8) -- two fixed-position actions, no
  // parameters and no running process to start/stop, so just one route
  // per action rather than the start/stop/status trio above.
  @Post('tilt/down')
  async tiltDown() {
    return this.deviceService.tiltDown();
  }

  @Post('tilt/recenter')
  async tiltRecenter() {
    return this.deviceService.tiltRecenter();
  }

  // Laser (GPIO12, driven directly by the Pi -- not the PCA9685). Same
  // fixed, fire-and-forget shape as the tilt routes above.
  @Post('laser/on')
  async laserOn() {
    return this.deviceService.laserOn();
  }

  @Post('laser/off')
  async laserOff() {
    return this.deviceService.laserOff();
  }
}
