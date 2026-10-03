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

  // Manual pan/tilt control (Settings page). Each press moves one servo a
  // fixed step and returns the new { pan, tilt } angles; no parameters, so
  // the client can only ever pick one of these fixed moves.
  @Get('position')
  getServoPosition() {
    return this.deviceService.getServoPosition();
  }

  @Post('pan/left')
  async panLeft() {
    return this.deviceService.stepServo('pan', -1);
  }

  @Post('pan/right')
  async panRight() {
    return this.deviceService.stepServo('pan', 1);
  }

  @Post('tilt/up')
  async tiltUp() {
    return this.deviceService.stepServo('tilt', 1);
  }

  @Post('tilt/down')
  async tiltDown() {
    return this.deviceService.stepServo('tilt', -1);
  }

  @Post('tilt/recenter')
  async tiltRecenter() {
    return this.deviceService.recenterServo('tilt');
  }

  // Laser: relay (GPIO17) + PWM pin (GPIO12), always switched together.
  @Post('laser/on')
  async laserOn() {
    return this.deviceService.laserOn();
  }

  @Post('laser/off')
  async laserOff() {
    return this.deviceService.laserOff();
  }
}
