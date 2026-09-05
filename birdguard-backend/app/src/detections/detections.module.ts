import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { DetectionsController } from './detections.controller';
import { Detection, DetectionSchema } from './schemas/detection.schema';

@Module({
  imports: [AuthModule, MongooseModule.forFeature([{ name: Detection.name, schema: DetectionSchema }])],
  controllers: [DetectionsController],
})
export class DetectionsModule {}
