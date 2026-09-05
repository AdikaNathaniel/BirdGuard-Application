import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DetectionDocument = HydratedDocument<Detection>;

// One document per detection *event* (a person newly entering frame, i.e.
// the same moment the laser turns on) -- not one per video frame, which
// would flood the collection with near-duplicates every ~100ms while
// someone stays in view.
@Schema({ timestamps: true })
export class Detection {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  confidence: number;

  @Prop({ required: true, default: Date.now })
  detectedAt: Date;

  @Prop({
    type: {
      x1: Number,
      y1: Number,
      x2: Number,
      y2: Number,
    },
    required: false,
  })
  bbox?: { x1: number; y1: number; x2: number; y2: number };
}

export const DetectionSchema = SchemaFactory.createForClass(Detection);
