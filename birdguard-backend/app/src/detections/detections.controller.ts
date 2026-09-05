import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Detection, DetectionDocument } from './schemas/detection.schema';

// Requires a valid JWT -- purely a read-through to the detections
// collection, which the Pi writes to directly, bypassing the backend
// entirely.
@Controller('detections')
@UseGuards(JwtAuthGuard)
export class DetectionsController {
  constructor(
    @InjectModel(Detection.name) private readonly detectionModel: Model<DetectionDocument>,
  ) {}

  @Get()
  async getDetections(@Query('limit') limit?: string, @Query('before') before?: string) {
    // Clamped to 1-200 regardless of what the caller asks for -- a
    // malformed or malicious `limit` value can't force an unbounded
    // query against the collection.
    const parsedLimit = limit ? Number(limit) : 50;
    const safeLimit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 50, 1), 200);

    // Cursor-based pagination: `before` (an ISO timestamp) selects
    // everything older than that timestamp, so paging through results is
    // stable even if new detections keep being inserted while the user
    // scrolls. The app passes the oldest currently-loaded detection's
    // timestamp to fetch the next older page.
    const filter = before ? { detectedAt: { $lt: new Date(before) } } : {};

    const detections = await this.detectionModel
      .find(filter)
      .sort({ detectedAt: -1 })
      .limit(safeLimit)
      .lean();

    return { success: true, detections };
  }
}
