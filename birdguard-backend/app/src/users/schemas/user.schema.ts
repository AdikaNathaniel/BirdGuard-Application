import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserType } from '../../auth/user-type.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  // lowercase: true normalizes on save, so "User@Example.com" and
  // "user@example.com" are treated as the same account by the unique
  // index rather than colliding only sometimes depending on casing.
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: String, enum: UserType, default: UserType.CUSTOMER })
  userType: UserType;
}

export const UserSchema = SchemaFactory.createForClass(User);
